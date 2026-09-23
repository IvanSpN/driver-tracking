import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDriverDto {
  @IsString()
  @MinLength(1)
  lastName: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsBoolean()
  isOfficial: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
