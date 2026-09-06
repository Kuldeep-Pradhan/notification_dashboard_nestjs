import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';
import { VendorsModule } from './vendors/vendors.module';
import { TemplatesModule } from './templates/templates.module';
import { NotificationModule } from './notification/notification.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health/health.controller';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    CacheModule,
    VendorsModule,
    TemplatesModule,
    NotificationModule,
    DashboardModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
