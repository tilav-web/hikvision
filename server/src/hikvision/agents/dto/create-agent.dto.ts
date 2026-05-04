import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAgentDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  hostInfo?: string;
}
