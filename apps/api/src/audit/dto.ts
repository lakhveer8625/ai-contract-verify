import { IsArray, IsOptional, IsString, MaxLength, ValidateNested, ArrayMaxSize, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class ContractInputDto {
  @IsString()
  @MaxLength(260)
  fileName!: string;

  @IsString()
  @MaxLength(500_000)
  source!: string;
}

export class CreateAuditDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ContractInputDto)
  contracts!: ContractInputDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  repositoryUrl?: string;
}
