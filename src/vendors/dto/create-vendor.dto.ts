import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsObject,
} from 'class-validator';

export class CreateVendorDto {
  @IsString()
  vendor_name: string;

  @IsString()
  display_name: string;

  @IsString()
  api_url: string;

  @IsString()
  http_method: string; // 'GET' or 'POST'

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @IsString()
  @IsOptional()
  auth_type?: string; // 'none', 'basic', 'apikey', 'bearer'

  @IsString()
  @IsOptional()
  request_template?: string; // JSON template with {{placeholders}}

  @IsString()
  @IsOptional()
  response_success_path?: string;

  @IsNumber()
  @IsOptional()
  timeout_ms?: number;

  @IsArray()
  @IsOptional()
  channels?: string[]; // ['SMS', 'EMAIL', 'PUSH', 'WAPP']

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
