import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { VendorsModule } from '../vendors/vendors.module';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [VendorsModule, TemplatesModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
