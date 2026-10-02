import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpsertAccrualDto {
  @IsInt()
  @Min(0)
  whiteMinor: number;

  @IsInt()
  @Min(0)
  blackMinor: number;

  @IsOptional()
  @IsString()
  note?: string;
}
