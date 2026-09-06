import { Injectable, Logger } from '@nestjs/common';
import { TemplateCacheService } from '../cache/template-cache.service';
import { CassandraService } from '../database/cassandra.service';

export interface FilterInput {
  feature_name: string;
  operation_performed: string;
  status: string;
  optedTemplateString: string;
}

export interface FilterResult {
  status: number;
  finalSendTemplateIDs: any[];
  message: string;
  errorMessage: string;
}

@Injectable()
export class TemplateFilterService {
  private readonly logger = new Logger(TemplateFilterService.name);

  constructor(
    private cacheService: TemplateCacheService,
    private cassandraService: CassandraService,
  ) {}

  /**
   * Filter templates using cache first, fallback to direct DB
   * Replicates legacy universalFinalTemplateFilterWithCache + universalFinalTemplateFilterDirectDBOps
   */
  async filterTemplates(input: FilterInput): Promise<FilterResult> {
    const cache = this.cacheService.getCache();

    if (cache) {
      return this.filterFromStructured(cache, input);
    }

    // Fallback: direct DB query
    this.logger.warn('Cache miss — falling back to direct DB Operations');
    return this.filterFromDB(input);
  }

  private filterFromStructured(
    structuredData: any,
    input: FilterInput,
  ): FilterResult {
    const fosData =
      structuredData?.[input.feature_name]?.[input.operation_performed]?.[
        input.status
      ];

    if (!fosData) {
      return {
        status: 1,
        finalSendTemplateIDs: [],
        message: 'Unable to send notification',
        errorMessage: `Missing FOS: ${input.feature_name}/${input.operation_performed}/${input.status}`,
      };
    }

    return this.applyFiltering(fosData, input.optedTemplateString);
  }

  private async filterFromDB(input: FilterInput): Promise<FilterResult> {
    try {
      const result = await this.cassandraService.execute(
        `SELECT * FROM notification_template_master WHERE feature = ? AND operation_performed = ? AND status = ? ALLOW FILTERING`,
        [input.feature_name, input.operation_performed, input.status],
      );

      if (result.rows.length === 0) {
        return {
          status: 1,
          finalSendTemplateIDs: [],
          message: 'No templates found',
          errorMessage: 'data is not available',
        };
      }

      // Convert rows array to object keyed by template_id (like cache format)
      const fosData: Record<string, any> = {};
      for (const row of result.rows) {
        let vendorRefConfig: Record<string, string> = {};
        if (row.vendor_ref_config) {
          if (typeof row.vendor_ref_config.entries === 'function') {
            for (const [k, v] of row.vendor_ref_config.entries()) {
              vendorRefConfig[k] = v;
            }
          } else if (typeof row.vendor_ref_config === 'object') {
            vendorRefConfig = { ...row.vendor_ref_config };
          }
        }
        fosData[row.template_id] = {
          ...row,
          vendor_ref_config: vendorRefConfig,
        };
      }

      return this.applyFiltering(fosData, input.optedTemplateString);
    } catch (err) {
      return {
        status: -1,
        finalSendTemplateIDs: [],
        message: 'Database error',
        errorMessage: err.message,
      };
    }
  }

  /**
   * Core filtering logic matching legacy behavior:
   * 1. Parse channel_opted string (e.g. "SMS:S001|EMAIL:E001")
   * 2. Match opted template IDs against available templates
   * 3. Fall back to is_default templates for channels not explicitly opted
   * 4. Deduplicate by event_name
   */
  private applyFiltering(
    fosData: Record<string, any>,
    optedTemplateString: string,
  ): FilterResult {
    const templateIDs: string[] = [];
    const channelNames: string[] = [];

    if (optedTemplateString) {
      const parts = optedTemplateString.split('|');
      for (const part of parts) {
        const [channel, templateId] = part.split(':').map((s) => s.trim());
        if (channel) channelNames.push(channel);
        if (templateId) templateIDs.push(templateId);
      }
    }

    const prepareObject: Record<string, any> = {};

    for (const key of Object.keys(fosData)) {
      const row = fosData[key];

      if (templateIDs.includes(row.template_id)) {
        const eventName = row.vendor_ref_config?.event_name || row.template_id;
        prepareObject[eventName] = row;
      } else if (row.is_default && !channelNames.includes(row.channel)) {
        const eventName = row.vendor_ref_config?.event_name || row.template_id;
        prepareObject[eventName] = row;
      }
    }

    const finalTemplates = Object.values(prepareObject);

    return {
      status: 0,
      finalSendTemplateIDs: finalTemplates,
      message: `Filtered ${finalTemplates.length} templates`,
      errorMessage: '',
    };
  }
}
