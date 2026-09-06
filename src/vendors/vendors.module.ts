import { Module } from '@nestjs/common';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { VendorDispatcherService } from './vendor-dispatcher.service';

@Module({
  controllers: [VendorsController],
  providers: [VendorsService, VendorDispatcherService],
  exports: [VendorsService, VendorDispatcherService],
})
export class VendorsModule {}
