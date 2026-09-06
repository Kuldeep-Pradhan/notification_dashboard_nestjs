import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cassandra from 'cassandra-driver';

@Injectable()
export class CassandraService implements OnModuleInit, OnModuleDestroy {
  private client: cassandra.Client;
  private readonly logger = new Logger(CassandraService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('CASSANDRA_HOST', '127.0.0.1');
    const port = this.configService.get<number>('CASSANDRA_PORT', 9042);
    const datacenter = this.configService.get<string>(
      'CASSANDRA_DATACENTER',
      'datacenter1',
    );
    const keyspace = this.configService.get<string>(
      'CASSANDRA_KEYSPACE',
      'notification_keyspace',
    );
    const username = this.configService.get<string>('CASSANDRA_USERNAME');
    const password = this.configService.get<string>('CASSANDRA_PASSWORD');

    this.client = new cassandra.Client({
      contactPoints: [host],
      localDataCenter: datacenter,
      keyspace,
      ...(username && password
        ? {
            authProvider: new cassandra.auth.PlainTextAuthProvider(
              username,
              password,
            ),
          }
        : {}),
      protocolOptions: { port },
      pooling: {
        coreConnectionsPerHost: {
          [cassandra.types.distance.local]: 2,
          [cassandra.types.distance.remote]: 1,
        },
      },
      socketOptions: { connectTimeout: 30000, readTimeout: 30000 },
    });

    try {
      await this.client.connect();
      this.logger.log(
        `✅ Connected to Cassandra at ${host}:${port} (keyspace: ${keyspace})`,
      );
      await this.ensureTables();
    } catch (err) {
      this.logger.error('❌ Failed to connect to Cassandra', err.message);
    }
  }

  async onModuleDestroy() {
    await this.client?.shutdown();
    this.logger.log('Cassandra connection closed');
  }

  async execute(
    query: string,
    params?: any[],
    options?: cassandra.QueryOptions,
  ): Promise<cassandra.types.ResultSet> {
    return this.client.execute(query, params, { prepare: true, ...options });
  }

  getClient(): cassandra.Client {
    return this.client;
  }

  /** Create required tables if they don't exist */
  private async ensureTables() {
    const queries = [
      `CREATE TABLE IF NOT EXISTS vendor_registry (
        vendor_name text PRIMARY KEY,
        display_name text,
        api_url text,
        http_method text,
        headers map<text, text>,
        auth_type text,
        request_template text,
        response_success_path text,
        timeout_ms int,
        channels set<text>,
        is_active boolean,
        created_at timestamp,
        updated_at timestamp
      )`,
      `CREATE TABLE IF NOT EXISTS notification_template_master (
        channel text,
        feature text,
        operation_performed text,
        status text,
        template_id text,
        content text,
        criteria text,
        is_default boolean,
        vendor_ref_config map<text, text>,
        PRIMARY KEY (channel, feature, operation_performed, status, template_id)
      )`,
      `CREATE TABLE IF NOT EXISTS notification_participants (
        user_name text,
        feature text,
        operation_performed text,
        status text,
        status_code int,
        channel_opted text,
        PRIMARY KEY (user_name, feature, operation_performed, status, status_code)
      )`,
      `CREATE TABLE IF NOT EXISTS notification_send_log (
        bucket text,
        created_at timestamp,
        log_id uuid,
        vendor_name text,
        template_id text,
        channel text,
        recipient text,
        send_status boolean,
        reason text,
        request_payload text,
        vendor_response text,
        PRIMARY KEY (bucket, created_at, log_id)
      ) WITH CLUSTERING ORDER BY (created_at DESC)`,
    ];

    for (const q of queries) {
      try {
        await this.client.execute(q);
      } catch (err) {
        this.logger.warn(`Table creation skipped: ${err.message}`);
      }
    }
    this.logger.log('📦 Database tables ensured');
  }
}
