import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { VendorsModule } from '../vendors/vendors.module';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [VendorsModule, TemplatesModule],
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class NotificationModule {}
