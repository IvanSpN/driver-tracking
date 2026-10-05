import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpsertAccrualDto {
  @IsInt()
  @Min(0)
  amountMinor: number;

  @IsOptional()
  @IsString()
  note?: string;
}
