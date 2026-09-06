import { Controller, Get, Post, Body, HttpCode } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get('fetch')
  async fetchAll() {
    const templates = await this.templatesService.findAll();
    return {
      status: 200,
      templates: templates,
    };
  }

  @Post('insert')
  @HttpCode(200)
  async create(@Body() dto: CreateTemplateDto) {
    const result = await this.templatesService.create(dto);
    return {
      status: 0,
      message: 'Template created successfully',
      data: result,
    };
  }

  @Post('delete')
  @HttpCode(200)
  async delete(@Body() body: any) {
    const { channel, feature, operation_performed, status, template_id } = body;
    await this.templatesService.remove(
      channel,
      feature,
      operation_performed,
      status,
      template_id,
    );
    return {
      status: 0,
      message: 'Template deleted successfully',
    };
  }
}
