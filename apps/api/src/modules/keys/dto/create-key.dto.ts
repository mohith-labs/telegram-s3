import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class CreateKeyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, string[]>;
}
