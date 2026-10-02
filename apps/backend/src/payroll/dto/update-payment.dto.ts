import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { PayChannel, PaymentMethod, PaymentType } from '../../database/models/payment.model';

export class UpdatePaymentDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'period должен быть в формате YYYY-MM' })
  period?: string;

  @IsOptional()
  @IsEnum(PayChannel)
  channel?: PayChannel;

  @IsOptional()
  @IsEnum(PaymentType)
  type?: PaymentType;

  @IsOptional()
  @IsInt()
  @Min(1)
  amountMinor?: number;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  note?: string;
}
