import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('HbtChk')
  checkHeartBeat() {
    return {
      status: 0,
      message: 'Notification NestJS Service is running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
