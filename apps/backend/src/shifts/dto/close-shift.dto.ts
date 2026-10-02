import { IsDateString } from 'class-validator';

export class CloseShiftDto {
  @IsDateString()
  endDate: string;
}
