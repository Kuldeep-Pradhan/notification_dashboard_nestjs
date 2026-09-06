import { Controller, Post, Get, Body, HttpCode } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { SendNotificationDto } from './dto/send-notification.dto';

@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Primary endpoint: /notification/sendNotification
   * Also mounted at /ISU/notification/sendNotification for backward compatibility
   */
  @Post('notification/sendNotification')
  @HttpCode(200)
  async sendNotification(@Body() dto: SendNotificationDto) {
    return this.notificationService.sendNotification(dto);
  }

  /** Backward-compatible alias */
  @Post('ISU/notification/sendNotification')
  @HttpCode(200)
  async sendNotificationISU(@Body() dto: SendNotificationDto) {
    return this.notificationService.sendNotification(dto);
  }

  /**
   * Transactional send — uses the same core logic
   * The distinction is in the request body (transaction_data vs params)
   */
  @Post('notification/sendTransactionalNotification')
  @HttpCode(200)
  async sendTransactional(@Body() dto: SendNotificationDto) {
    return this.notificationService.sendNotification(dto);
  }

  /** Cache reset */
  @Get('notification/admin/cacheReset')
  async cacheReset() {
    const result = await this.notificationService.resetCache();
    return { status: 200, result };
  }
}
