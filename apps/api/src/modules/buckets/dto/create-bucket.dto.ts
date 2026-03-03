import { IsString, IsNotEmpty, Matches, Length } from 'class-validator';

export class CreateBucketDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 63)
  @Matches(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/, {
    message: 'Bucket name must be DNS-compatible: lowercase, numbers, hyphens, and periods',
  })
  name: string;
}
