import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CassandraService } from '../database/cassandra.service';

export interface StructuredTemplateData {
  [feature: string]: {
    [operation: string]: {
      [status: string]: {
        [templateId: string]: any;
      };
    };
  };
}

@Injectable()
export class TemplateCacheService implements OnModuleInit {
  private cache: StructuredTemplateData | null = null;
  private readonly logger = new Logger(TemplateCacheService.name);

  constructor(private cassandraService: CassandraService) {}

  async onModuleInit() {
    await this.loadCache();
  }

  async loadCache(): Promise<StructuredTemplateData> {
    try {
      const result = await this.cassandraService.execute(
        'SELECT * FROM notification_template_master',
      );

      const structuredData: StructuredTemplateData = {};

      for (const row of result.rows) {
        const feature = row.feature;
        const op = row.operation_performed;
        const status = row.status;
        const templateId = row.template_id;

        if (!structuredData[feature]) structuredData[feature] = {};
        if (!structuredData[feature][op]) structuredData[feature][op] = {};
        if (!structuredData[feature][op][status])
          structuredData[feature][op][status] = {};

        // Convert Cassandra Map to plain object for vendor_ref_config
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

        structuredData[feature][op][status][templateId] = {
          ...row,
          vendor_ref_config: vendorRefConfig,
        };
      }

      this.cache = structuredData;
      this.logger.log(
        `✅ Template cache loaded (${result.rows.length} templates)`,
      );
      return structuredData;
    } catch (err) {
      this.logger.error('Failed to load template cache', err.message);
      return {};
    }
  }

  getCache(): StructuredTemplateData | null {
    return this.cache;
  }

  getTemplatesForFOS(
    feature: string,
    operation: string,
    status: string,
  ): Record<string, any> | null {
    return this.cache?.[feature]?.[operation]?.[status] || null;
  }

  async resetCache(): Promise<{ status: string; templateCount: number }> {
    const data = await this.loadCache();
    let count = 0;
    for (const f in data) {
      for (const o in data[f]) {
        for (const s in data[f][o]) {
          count += Object.keys(data[f][o][s]).length;
        }
      }
    }
    return { status: 'cache_reset_success', templateCount: count };
  }
}
