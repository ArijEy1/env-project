import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ENTITY_TYPES, EXPOSURE_LEVELS } from '../profile-options';

const SECTORS = [
  'industrial',
  'oil_and_gas',
  'manufacturing',
  'construction',
  'mining',
  'services',
  'government',
  'healthcare',
  'education',
  'other',
];

const EMPLOYEE_BRACKETS = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+',
];

export class UpdateEntityDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nameAr?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  @IsIn(SECTORS)
  sector?: string;

  @IsOptional()
  @IsString()
  @IsIn([...ENTITY_TYPES])
  entityType?: string;

  @IsOptional()
  @IsString()
  @IsIn([...EXPOSURE_LEVELS])
  environmentalExposure?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  @IsIn(EMPLOYEE_BRACKETS)
  employeeCountBracket?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  unifiedNationalNumber?: string;
}
