import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import {
  PayChannel,
  PaymentMethod,
  PaymentType,
} from '../../database/models/payment.model';

export class CreatePaymentDto {
  @Matches(/^\d{4}-\d{2}$/, { message: 'period должен быть в формате YYYY-MM' })
  period: string;

  @IsOptional()
  @IsEnum(PayChannel)
  channel?: PayChannel;

  @IsEnum(PaymentType)
  type: PaymentType;

  @IsInt()
  @Min(1)
  amountMinor: number;

  @IsDateString()
  paidAt: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  note?: string;
}
