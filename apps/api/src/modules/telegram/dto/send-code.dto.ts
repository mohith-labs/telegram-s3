import { IsNumber, IsString, IsNotEmpty } from 'class-validator';

export class SendCodeDto {
  @IsNumber()
  apiId: number;

  @IsString()
  @IsNotEmpty()
  apiHash: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}
