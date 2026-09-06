import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  async create(@Body() dto: CreateVendorDto) {
    const vendor = await this.vendorsService.create(dto);
    return {
      status: 0,
      message: `Vendor '${vendor.vendor_name}' registered successfully`,
      data: vendor,
    };
  }

  @Get()
  async findAll() {
    const vendors = await this.vendorsService.findAll();
    return {
      status: 0,
      message: `Found ${vendors.length} vendors`,
      data: vendors,
    };
  }

  @Get(':name')
  async findOne(@Param('name') name: string) {
    const vendor = await this.vendorsService.findOne(name);
    return { status: 0, data: vendor };
  }

  @Put(':name')
  async update(@Param('name') name: string, @Body() dto: UpdateVendorDto) {
    const vendor = await this.vendorsService.update(name, dto);
    return {
      status: 0,
      message: `Vendor '${name}' updated successfully`,
      data: vendor,
    };
  }

  @Delete(':name')
  async remove(@Param('name') name: string) {
    const result = await this.vendorsService.remove(name);
    return { status: 0, ...result };
  }

  @Post('cache/refresh')
  async refreshCache() {
    await this.vendorsService.refreshCache();
    return { status: 0, message: 'Vendor cache refreshed' };
  }
}
