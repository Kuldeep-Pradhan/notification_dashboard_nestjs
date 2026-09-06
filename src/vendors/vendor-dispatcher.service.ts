import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import { VendorsService, VendorConfig } from './vendors.service';
import * as https from 'https';

const httpsAgent = new https.Agent({ keepAlive: true });

export interface DispatchPayload {
  vendor_name: string;
  channel: string;
  notification_data: Record<string, any>;
  template_data: Record<string, any>;
}

export interface DispatchResult {
  status: number;
  vendor_name: string;
  channel: string;
  message: string;
  vendor_response?: any;
  request_payload?: string;
  errorMessage?: string;
}

@Injectable()
export class VendorDispatcherService {
  private readonly logger = new Logger(VendorDispatcherService.name);

  constructor(private vendorsService: VendorsService) {}

  async dispatch(payload: DispatchPayload): Promise<DispatchResult> {
    const vendorConfig = this.vendorsService.getVendorFromCache(
      payload.vendor_name,
    );

    if (!vendorConfig) {
      this.logger.warn(`Vendor '${payload.vendor_name}' not found in registry`);
      return {
        status: -1,
        vendor_name: payload.vendor_name,
        channel: payload.channel,
        message: 'Vendor not found in registry',
        errorMessage: `No vendor config found for '${payload.vendor_name}'`,
      };
    }

    if (!vendorConfig.is_active) {
      return {
        status: -1,
        vendor_name: payload.vendor_name,
        channel: payload.channel,
        message: 'Vendor is inactive',
        errorMessage: `Vendor '${payload.vendor_name}' is currently disabled`,
      };
    }

    return this.executeGenericHttp(vendorConfig, payload);
  }

  private async executeGenericHttp(
    config: VendorConfig,
    payload: DispatchPayload,
  ): Promise<DispatchResult> {
    let axiosConfig: AxiosRequestConfig | undefined;
    try {
      // ─────────────────────────────────────────────────
      // STEP 1: Merge all data sources for placeholder resolution
      // Priority (highest last, so it wins): template_data < notification_data
      // ─────────────────────────────────────────────────

      const mergedData: Record<string, any> = {
        ...payload.template_data,
        ...payload.notification_data,
      };

      let requestBody: any = null;
      let requestParams: Record<string, string> | undefined = undefined;
      const url = config.api_url;

      // ─────────────────────────────────────────────────
      // STEP 2: Build POST body or GET query params
      // ─────────────────────────────────────────────────
      if (config.http_method === 'POST') {
        if (config.request_template) {
          const resolved = this.resolvePlaceholders(
            config.request_template,
            mergedData,
          );
          try {
            requestBody = JSON.parse(resolved);
          } catch {
            // Not valid JSON — send as raw string (e.g. XML vendors)
            requestBody = resolved;
          }
        } else {
          requestBody = mergedData;
        }
      } else if (config.http_method === 'GET') {
        // request_template should be a query string ONLY:
        // e.g. "user={{username}}&pass={{password}}&to={{mobile_number}}&msg={{text}}"
        // axios will append it as ?key=val&key=val automatically
        if (config.request_template) {
          const resolved = this.resolvePlaceholders(
            config.request_template,
            mergedData,
          );
          requestParams = {};
          resolved.split('&').forEach((pair) => {
            const eqIdx = pair.indexOf('=');
            if (eqIdx > 0) {
              const key = pair.substring(0, eqIdx).trim();
              const val = pair.substring(eqIdx + 1).trim();
              requestParams![key] = val;
            }
          });
        }
      }

      // ─────────────────────────────────────────────────
      // STEP 3: Build Axios config with auth injection
      // ─────────────────────────────────────────────────
      const headers: Record<string, string> = { ...config.headers };

      axiosConfig = {
        method: config.http_method.toLowerCase() as any,
        url,
        headers,
        params: requestParams,
        timeout: config.timeout_ms || 30000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        httpsAgent,
      };

      // Inject Basic Auth if auth_type is 'basic'
      // Credentials are stored in the headers map as 'username' and 'password'
      // rowToConfig() already extracted them into config.username / config.password
      if (config.auth_type === 'basic' && config.username) {
        axiosConfig.auth = {
          username: config.username,
          password: config.password || '',
        };
        this.logger.log(
          `🔐 Basic Auth injected for vendor '${config.vendor_name}'`,
        );
      }

      if (config.http_method === 'POST' && requestBody !== null) {
        axiosConfig.data = requestBody;
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
      }

      this.logger.log(
        `📤 Dispatching to vendor '${config.vendor_name}' [${config.http_method} ${url}]`,
      );

      const response = await axios(axiosConfig);

      this.logger.log(
        `📥 Vendor '${config.vendor_name}' HTTP ${response.status}`,
      );

      // ─────────────────────────────────────────────────
      // STEP 4: Validate response using response_success_path
      // Supports dot-notation: "data.response.code", "result.status", etc.
      // ─────────────────────────────────────────────────
      if (config.response_success_path) {
        const successValue = this.getNestedValue(
          response.data,
          config.response_success_path,
        );

        if (!this.isSuccessValue(successValue)) {
          this.logger.warn(
            `⚠️ Vendor '${config.vendor_name}' HTTP 2xx but response check FAILED. ` +
              `Path='${config.response_success_path}', Got='${JSON.stringify(successValue)}'`,
          );
          return {
            status: -1,
            vendor_name: config.vendor_name,
            channel: payload.channel,
            message: 'Vendor returned a non-success response code',
            vendor_response: response.data,
            request_payload: JSON.stringify(axiosConfig),
            errorMessage: `Expected success at '${config.response_success_path}', got: ${JSON.stringify(successValue)}`,
          };
        }

        this.logger.log(
          `✅ Response check passed | '${config.response_success_path}' = '${JSON.stringify(successValue)}'`,
        );
      }

      return {
        status: 0,
        vendor_name: config.vendor_name,
        channel: payload.channel,
        message: 'Notification sent successfully',
        vendor_response: response.data,
        request_payload: JSON.stringify(axiosConfig),
      };
    } catch (error: any) {
      const errMsg =
        error?.response?.data?.error ||
        error?.response?.data?.description ||
        error?.response?.data?.message ||
        error.message;

      this.logger.error(
        `❌ Vendor '${config.vendor_name}' dispatch failed: ${errMsg}`,
      );

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return {
          status: -1,
          vendor_name: config.vendor_name,
          channel: payload.channel,
          message: 'Vendor API timeout',
          request_payload: axiosConfig ? JSON.stringify(axiosConfig) : '',
          errorMessage: errMsg,
        };
      }

      return {
        status: -1,
        vendor_name: config.vendor_name,
        channel: payload.channel,
        message: 'Error dispatching notification',
        request_payload: axiosConfig ? JSON.stringify(axiosConfig) : '',
        errorMessage: errMsg,
      };
    }
  }

  /**
   * Replace {{placeholder}} tokens with actual values.
   * Supports dot-notation: {{user.mobile}}, {{params.otp}}
   */
  private resolvePlaceholders(
    template: string,
    data: Record<string, any>,
  ): string {
    return template.replace(/\{\{(\w[\w.]*)\}\}/g, (_, key: string) => {
      const val = this.getNestedValue(data, key);
      return val !== undefined && val !== null ? String(val) : '';
    });
  }

  /**
   * Traverse an object using dot-notation path.
   * e.g. getNestedValue({a:{b:{c:42}}}, "a.b.c") => 42
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }

  /**
   * Smart success check for vendor response values.
   *
   * How different vendors signal success:
   *  - Raven         → { success: true }           path: "success"
   *  - NICT SMS      → { response: { code: 200 } } path: "response.code"
   *  - mCarbon       → { code: "000" }             path: "code"  (truthy string)
   *  - Some vendors  → { status: "OK" }            path: "status"
   *  - Some vendors  → { errorCode: 0 }            path: "errorCode" (falsy! avoid this path)
   */
  private isSuccessValue(value: any): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      // HTTP-style: 200-299 = success; also 1 is common "success code"
      return (value >= 200 && value < 300) || value === 1;
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      const successStrings = [
        'true',
        '1',
        'ok',
        'success',
        'sent',
        'submitted',
        'accepted',
      ];
      if (successStrings.includes(lower)) return true;
      // Numeric string e.g. "200"
      const num = Number(lower);
      if (!isNaN(num)) return (num >= 200 && num < 300) || num === 1;
      return false;
    }
    return Boolean(value);
  }
}
