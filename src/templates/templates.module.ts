import { Module } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TemplateFilterService } from './template-filter.service';
import { TemplatesController } from './templates.controller';

@Module({
  controllers: [TemplatesController],
  providers: [TemplatesService, TemplateFilterService],
  exports: [TemplatesService, TemplateFilterService],
})
export class TemplatesModule {}
