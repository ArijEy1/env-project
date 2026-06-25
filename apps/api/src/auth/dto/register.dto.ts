import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
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

export class RegisterEntityDto {
  @IsString()
  @MinLength(2)
  nameAr!: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsString()
  @MinLength(5)
  crNumber!: string;

  @IsString()
  @IsIn(SECTORS)
  sector!: string;

  @IsString()
  @IsIn([...ENTITY_TYPES])
  entityType!: string;

  @IsString()
  @IsIn([...EXPOSURE_LEVELS])
  environmentalExposure!: string;

  @IsString()
  @MinLength(1)
  city!: string;

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

export class RegisterUserDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  jobRole?: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  password!: string;
}

export class RegisterDto {
  @ValidateNested()
  @Type(() => RegisterEntityDto)
  entity!: RegisterEntityDto;

  @ValidateNested()
  @Type(() => RegisterUserDto)
  user!: RegisterUserDto;
}
