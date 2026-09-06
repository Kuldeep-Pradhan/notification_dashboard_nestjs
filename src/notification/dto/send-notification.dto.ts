import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class NotificationDataDto {
  @IsString()
  @IsOptional()
  mobile_number?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsObject()
  @IsOptional()
  params?: Record<string, string>;

  @IsObject()
  @IsOptional()
  transaction_data?: Record<string, any>;
}

export class SendNotificationDto {
  @IsString()
  @IsNotEmpty()
  user_name: string;

  @IsString()
  @IsNotEmpty()
  feature: string;

  @IsString()
  @IsNotEmpty()
  operation_performed: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsNumber()
  @IsOptional()
  status_code?: number;

  @ValidateNested()
  @Type(() => NotificationDataDto)
  @IsNotEmpty()
  notification_data: NotificationDataDto;
}
