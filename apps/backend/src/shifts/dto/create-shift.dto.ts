import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateShiftDto {
  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
