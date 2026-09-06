import { Controller, Get, Logger } from '@nestjs/common';
import { VendorsService } from '../vendors/vendors.service';
import { TemplatesService } from '../templates/templates.service';

@Controller('dashboard')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(
    private readonly vendorsService: VendorsService,
    private readonly templatesService: TemplatesService,
  ) {}

  @Get('stats')
  async getStats() {
    try {
      const vendors = await this.vendorsService.findAll();
      const totalVendors = vendors ? vendors.length : 0;

      const templatesCount = await this.templatesService.getTemplateCount();

      // Simulated analytics data since we don't have Grafana linked yet
      const apiCallsPerMin = Math.floor(Math.random() * (1200 - 800) + 800);

      return {
        status: 0,
        message: 'Dashboard stats fetched successfully',
        data: {
          totalVendors: totalVendors.toString(),
          activeTemplates: templatesCount.toString(),
          apiCallsPerMin,
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching dashboard stats: ${error.message}`);
      return {
        status: 1,
        message: 'Failed to fetch dashboard stats',
        data: {
          totalVendors: '0',
          activeTemplates: '0',
          apiCallsPerMin: 0,
        },
      };
    }
  }
}
