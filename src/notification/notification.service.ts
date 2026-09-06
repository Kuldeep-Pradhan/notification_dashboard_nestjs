import { Injectable, Logger } from '@nestjs/common';
import { CassandraService } from '../database/cassandra.service';
import { TemplateFilterService } from '../templates/template-filter.service';
import {
  VendorDispatcherService,
  DispatchResult,
} from '../vendors/vendor-dispatcher.service';
import { TemplateCacheService } from '../cache/template-cache.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { v4 as uuidv4 } from 'uuid';

// Notification data column number to name mapping (from template_generic_numbers_with_name.json)
const COLUMN_MAP: Record<string, string> = {
  '1': 'transaction_id',
  '2': 'user_id',
  '3': 'api_user_id',
  '4': 'user_name',
  '5': 'distributer_name',
  '6': 'master_name',
  '7': 'is_sl',
  '8': 'amount',
  '9': 'previous_amount',
  '10': 'balance_amount',
  '11': 'operation_performed',
  '12': 'transaction_type',
  '13': 'transaction_status_code',
  '14': 'status_desc',
  '15': 'status',
  '16': 'created_date_time',
  '17': 'updated_date_time',
  '18': 'rrn',
  '19': 'stan',
  '20': 'param_a',
  '21': 'param_b',
  '22': 'param_c',
  '23': 'origin_identifier',
  '24': 'iin',
  '25': 'User_role',
  '26': 'service_provider_id',
  '27': 'api_service_provider_id',
  '28': 'lat_long',
  '29': 'gateway',
  '30': 'additional_info_1',
  '31': 'additional_info_2',
  '32': 'ac_number',
  '33': 'transaction_ref_id',
  '34': 'credited_user',
  '35': 'from_user',
  '36': 'shop_name',
  '37': 'bank_name',
  '38': 'aadhaar_number',
  '39': 'consumer_number',
  '40': 'customer_name',
  '41': 'cusomer_mobile_number',
  '42': 'bene_name',
  '43': 'bene_mobile_number',
  '44': 'urn_number',
  '45': 'api_user_name',
  '46': 'hashvalue',
  '47': 'biller_name',
  '48': 'password',
  '49': 'url',
  '50': 'portal_url',
  '51': 'app_url',
  '52': 'admin_name',
  '53': 'subject',
  '54': 'sender_name',
  '55': 'regards',
  '56': 'policy_number',
  '57': 'register_number',
  otp: 'otp',
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private cassandraService: CassandraService,
    private templateFilterService: TemplateFilterService,
    private vendorDispatcher: VendorDispatcherService,
    private templateCacheService: TemplateCacheService,
  ) {}

  /**
   * Main sendNotification flow (non-transactional)
   * Replaces the deeply nested callback hell in sendNotificatons.js
   */
  async sendNotification(dto: SendNotificationDto) {
    const logID = Date.now();
    this.logger.log(
      `[${logID}] 📨 Notification send started: ${dto.feature}/${dto.operation_performed}/${dto.status}`,
    );

    // Step 1: Normalize params (convert column keys to named keys)
    const transactionData = this.normalizeParams(
      dto.notification_data.params ||
        dto.notification_data.transaction_data ||
        {},
    );

    // Step 2: Fetch participant data (channel_opted)
    const participantData = await this.fetchParticipantData(dto);
    const optedTemplateString = participantData?.channel_opted || '';

    this.logger.log(`[${logID}] Participant opted: "${optedTemplateString}"`);

    // Step 3: Filter templates
    const filterResult = await this.templateFilterService.filterTemplates({
      feature_name: dto.feature,
      operation_performed: dto.operation_performed,
      status: dto.status,
      optedTemplateString,
    });

    if (
      filterResult.status !== 0 ||
      filterResult.finalSendTemplateIDs.length === 0
    ) {
      this.logger.warn(
        `[${logID}] No templates matched: ${filterResult.errorMessage}`,
      );
      return {
        status: 1,
        message: 'Unable to send notification',
        errorInfo: filterResult.errorMessage || 'No matching templates found',
      };
    }

    this.logger.log(
      `[${logID}] ✅ ${filterResult.finalSendTemplateIDs.length} templates matched`,
    );

    // Step 4: Dispatch to each vendor
    const dispatchPromises: Promise<DispatchResult>[] =
      filterResult.finalSendTemplateIDs.map((template: any) => {
        const vendorName = template.vendor_ref_config?.vendor_name || '';
        const channel = template.channel || '';

        return this.vendorDispatcher.dispatch({
          vendor_name: vendorName,
          channel,
          notification_data: {
            ...dto.notification_data,
            ...transactionData,
          },
          template_data: template.vendor_ref_config || {},
        });
      });

    const sendResults = await Promise.allSettled(dispatchPromises);

    const sendArray = sendResults.map((result, idx) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        status: -1,
        vendor_name:
          filterResult.finalSendTemplateIDs[idx]?.vendor_ref_config
            ?.vendor_name || 'unknown',
        channel: filterResult.finalSendTemplateIDs[idx]?.channel || '',
        message: 'Dispatch failed',
        errorMessage: result.reason?.message || 'Unknown error',
        request_payload: '',
        vendor_response: '',
      };
    });

    const allSuccess = sendArray.every((r: any) => r.status === 0);
    this.logger.log(
      `[${logID}] 🏁 Notification send finished. All success: ${allSuccess}`,
    );

    // Create DB Logs
    const currentBucket = new Date().toISOString().split('T')[0]; // "2026-04-15"
    for (let i = 0; i < filterResult.finalSendTemplateIDs.length; i++) {
      const templateItem = filterResult.finalSendTemplateIDs[i];
      const resVal = sendArray[i];

      const query = `
        INSERT INTO notification_send_log 
          (bucket, created_at, log_id, vendor_name, template_id, channel, recipient, send_status, reason, request_payload, vendor_response) 
        VALUES (?, toTimestamp(now()), ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const queryParams = [
        currentBucket,
        uuidv4(),
        templateItem?.vendor_ref_config?.vendor_name || 'unknown',
        templateItem?.template_id || 'unknown',
        templateItem?.channel || 'unknown',
        dto.user_name || 'unknown',
        resVal?.status === 0,
        resVal?.errorMessage || resVal?.message || '',
        resVal?.request_payload || '',
        typeof resVal?.vendor_response === 'object'
          ? JSON.stringify(resVal.vendor_response)
          : resVal?.vendor_response || '',
      ];
      try {
        await this.cassandraService.execute(query, queryParams);
      } catch (logErr: any) {
        this.logger.error(
          `Cassandra Log error: ${logErr.message}`,
          logErr.stack,
        );
      }
    }

    return {
      status: allSuccess ? 0 : 1,
      message: allSuccess
        ? 'notification successfully sent'
        : 'some notifications failed',
      errorInfo: '',
      sendArray,
    };
  }

  /**
   * Cache reset endpoint
   */
  async resetCache() {
    return this.templateCacheService.resetCache();
  }

  /**
   * Convert numbered column keys to named keys using the canonical mapping
   */
  private normalizeParams(data: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};
    for (const key in data) {
      if (key.startsWith('column')) {
        const num = key.replace('column', '');
        const name = COLUMN_MAP[num] || key;
        normalized[name] = data[key];
      } else if (COLUMN_MAP[key]) {
        normalized[COLUMN_MAP[key]] = data[key];
      } else {
        normalized[key] = data[key];
      }
    }
    return normalized;
  }

  /**
   * Fetch participant channel preferences from Cassandra
   */
  private async fetchParticipantData(dto: SendNotificationDto): Promise<any> {
    try {
      const result = await this.cassandraService.execute(
        `SELECT * FROM notification_participants WHERE user_name = ? AND feature = ? AND operation_performed = ? AND status = ? ALLOW FILTERING`,
        [dto.user_name, dto.feature, dto.operation_performed, dto.status],
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (err) {
      this.logger.warn(`Participant fetch failed: ${err.message}`);
      return null;
    }
  }
}
