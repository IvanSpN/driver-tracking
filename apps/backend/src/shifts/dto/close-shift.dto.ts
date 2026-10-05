import { IsDateString, Matches } from 'class-validator';

export class CloseShiftDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Дата окончания должна быть в формате ГГГГ-ММ-ДД',
  })
  @IsDateString(
    { strict: true },
    { message: 'Укажите корректную дату окончания' },
  )
  endDate: string;
}
