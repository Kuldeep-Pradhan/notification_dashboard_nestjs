import { Injectable, Logger } from '@nestjs/common';
import { CassandraService } from '../database/cassandra.service';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(private cassandraService: CassandraService) {}

  async findAll() {
    const result = await this.cassandraService.execute(
      'SELECT * FROM notification_template_master LIMIT 500',
    );
    return result.rows;
  }

  async findByFOS(feature: string, operation: string, status: string) {
    const result = await this.cassandraService.execute(
      `SELECT * FROM notification_template_master WHERE feature = ? AND operation_performed = ? AND status = ? ALLOW FILTERING`,
      [feature, operation, status],
    );
    return result.rows;
  }

  async findByTemplateId(templateId: string) {
    const result = await this.cassandraService.execute(
      `SELECT * FROM notification_template_master WHERE template_id = ? ALLOW FILTERING`,
      [templateId],
    );
    return result.rows;
  }

  async getTemplateCount(): Promise<number> {
    const result = await this.cassandraService.execute(
      'SELECT count(*) as count FROM notification_template_master',
    );
    const count = result.rows[0]?.count;
    return typeof count === 'object'
      ? parseInt(count.low)
      : parseInt(count || '0');
  }

  async create(data: any) {
    const query = `
      INSERT INTO notification_template_master (
        channel, feature, operation_performed, status, template_id, content, criteria, is_default, params, vendor_ref_config
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      data.channel,
      data.feature,
      data.operation_performed,
      data.status,
      data.template_id,
      data.content,
      data.criteria || {},
      data.is_default || false,
      data.params || '',
      data.vendor_ref_config || {},
    ];
    await this.cassandraService.execute(query, params);
    return data;
  }

  async remove(
    channel: string,
    feature: string,
    operation: string,
    status: string,
    templateId: string,
  ) {
    const query = `
      DELETE FROM notification_template_master 
      WHERE channel = ? AND feature = ? AND operation_performed = ? AND status = ? AND template_id = ?
    `;
    await this.cassandraService.execute(query, [
      channel,
      feature,
      operation,
      status,
      templateId,
    ]);
    return { success: true };
  }
}
