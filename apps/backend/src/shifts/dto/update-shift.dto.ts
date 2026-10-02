import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateShiftDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
