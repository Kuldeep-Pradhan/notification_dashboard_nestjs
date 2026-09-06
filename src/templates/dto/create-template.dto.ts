import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  channel: string;

  @IsString()
  feature: string;

  @IsString()
  operation_performed: string;

  @IsString()
  status: string;

  @IsString()
  template_id: string;

  @IsString()
  content: string;

  @IsObject()
  @IsOptional()
  criteria?: Record<string, string>;

  @IsBoolean()
  @IsOptional()
  is_default?: boolean;

  @IsString()
  @IsOptional()
  params?: string;

  @IsObject()
  @IsOptional()
  vendor_ref_config?: Record<string, any>;
}
