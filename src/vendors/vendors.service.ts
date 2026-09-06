import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { CassandraService } from '../database/cassandra.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

export interface VendorConfig {
  vendor_name: string;
  display_name: string;
  api_url: string;
  http_method: string;
  headers: Record<string, string>;
  auth_type: string;
  username?: string; // For basic auth
  password?: string; // For basic auth
  request_template: string;
  response_success_path: string;
  timeout_ms: number;
  channels: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class VendorsService implements OnModuleInit {
  private vendorCache = new Map<string, VendorConfig>();
  private readonly logger = new Logger(VendorsService.name);

  constructor(private cassandraService: CassandraService) {}

  async onModuleInit() {
    await this.refreshCache();
  }

  async refreshCache() {
    try {
      const result = await this.cassandraService.execute(
        'SELECT * FROM vendor_registry',
      );
      this.vendorCache.clear();
      for (const row of result.rows) {
        const config = this.rowToConfig(row);
        this.vendorCache.set(config.vendor_name, config);
      }
      this.logger.log(
        `✅ Vendor cache loaded (${this.vendorCache.size} vendors)`,
      );
    } catch (err) {
      this.logger.error('Failed to load vendor cache', err.message);
    }
  }

  private rowToConfig(row: any): VendorConfig {
    let headers: Record<string, string> = {};
    if (row.headers) {
      if (typeof row.headers.entries === 'function') {
        for (const [k, v] of row.headers.entries()) {
          headers[k] = v;
        }
      } else if (typeof row.headers === 'object') {
        headers = { ...row.headers };
      }
    }
    const channels: string[] = row.channels ? [...row.channels] : [];

    // For basic auth: extract username/password stored in headers map
    const username = headers['username'];
    const password = headers['password'];
    if (username) delete headers['username'];
    if (password) delete headers['password'];

    return {
      vendor_name: row.vendor_name,
      display_name: row.display_name || '',
      api_url: row.api_url || '',
      http_method: row.http_method || 'POST',
      headers,
      auth_type: row.auth_type || 'none',
      username,
      password,
      request_template: row.request_template || '',
      response_success_path: row.response_success_path || '',
      timeout_ms: row.timeout_ms || 30000,
      channels,
      is_active: row.is_active ?? true,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  getVendorFromCache(vendorName: string): VendorConfig | undefined {
    return this.vendorCache.get(vendorName);
  }

  async findAll(): Promise<VendorConfig[]> {
    const result = await this.cassandraService.execute(
      'SELECT * FROM vendor_registry',
    );
    return result.rows.map((row) => this.rowToConfig(row));
  }

  async findOne(vendorName: string): Promise<VendorConfig> {
    const result = await this.cassandraService.execute(
      'SELECT * FROM vendor_registry WHERE vendor_name = ?',
      [vendorName],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException(`Vendor '${vendorName}' not found`);
    }
    return this.rowToConfig(result.rows[0]);
  }

  async create(dto: CreateVendorDto): Promise<VendorConfig> {
    // Check if already exists
    const existing = await this.cassandraService.execute(
      'SELECT vendor_name FROM vendor_registry WHERE vendor_name = ?',
      [dto.vendor_name],
    );
    if (existing.rows.length > 0) {
      throw new ConflictException(`Vendor '${dto.vendor_name}' already exists`);
    }

    const now = new Date();
    const query = `
      INSERT INTO vendor_registry (
        vendor_name, display_name, api_url, http_method, headers,
        auth_type, request_template, response_success_path, timeout_ms,
        channels, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      dto.vendor_name,
      dto.display_name,
      dto.api_url,
      dto.http_method?.toUpperCase() || 'POST',
      dto.headers || {},
      dto.auth_type || 'none',
      dto.request_template || '',
      dto.response_success_path || '',
      dto.timeout_ms || 30000,
      dto.channels || [],
      dto.is_active ?? true,
      now,
      now,
    ];

    await this.cassandraService.execute(query, params);

    // Refresh cache
    await this.refreshCache();

    return this.findOne(dto.vendor_name);
  }

  async update(
    vendorName: string,
    dto: UpdateVendorDto,
  ): Promise<VendorConfig> {
    // Ensure vendor exists
    await this.findOne(vendorName);

    const updates: string[] = [];
    const params: any[] = [];

    if (dto.display_name !== undefined) {
      updates.push('display_name = ?');
      params.push(dto.display_name);
    }
    if (dto.api_url !== undefined) {
      updates.push('api_url = ?');
      params.push(dto.api_url);
    }
    if (dto.http_method !== undefined) {
      updates.push('http_method = ?');
      params.push(dto.http_method.toUpperCase());
    }
    if (dto.headers !== undefined) {
      updates.push('headers = ?');
      params.push(dto.headers);
    }
    if (dto.auth_type !== undefined) {
      updates.push('auth_type = ?');
      params.push(dto.auth_type);
    }
    if (dto.request_template !== undefined) {
      updates.push('request_template = ?');
      params.push(dto.request_template);
    }
    if (dto.response_success_path !== undefined) {
      updates.push('response_success_path = ?');
      params.push(dto.response_success_path);
    }
    if (dto.timeout_ms !== undefined) {
      updates.push('timeout_ms = ?');
      params.push(dto.timeout_ms);
    }
    if (dto.channels !== undefined) {
      updates.push('channels = ?');
      params.push(dto.channels);
    }
    if (dto.is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(dto.is_active);
    }

    updates.push('updated_at = ?');
    params.push(new Date());
    params.push(vendorName);

    const query = `UPDATE vendor_registry SET ${updates.join(', ')} WHERE vendor_name = ?`;
    await this.cassandraService.execute(query, params);

    await this.refreshCache();
    return this.findOne(vendorName);
  }

  async remove(vendorName: string): Promise<{ message: string }> {
    await this.findOne(vendorName); // Ensure exists
    await this.cassandraService.execute(
      'DELETE FROM vendor_registry WHERE vendor_name = ?',
      [vendorName],
    );
    await this.refreshCache();
    return { message: `Vendor '${vendorName}' deleted successfully` };
  }
}
