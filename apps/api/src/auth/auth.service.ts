import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { AuthEmailService } from './auth-email.service';
import { jwtConstants } from './auth.constants';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateEntityDto } from './dto/update-entity.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { EntityRecord } from './entities/entity.entity';
import { SafeUser, UserEntity } from './entities/user.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginRateLimiter } from './login-rate-limiter';

interface UserRow {
  id: string;
  entity_id: string;
  first_name: string;
  last_name: string | null;
  full_name: string;
  email: string;
  password_hash: string;
  phone: string | null;
  job_role: string | null;
  role: string;
  created_at: Date | string;
}

interface EntityRow {
  id: string;
  name_ar: string;
  name_en: string | null;
  cr_number: string;
  sector: string;
  city: string;
  region: string | null;
  employee_count_bracket: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  unified_national_number: string | null;
  created_at: Date | string;
}

interface PasswordResetTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date | string;
  consumed_at: Date | string | null;
  created_at: Date | string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly passwordResetTtlMinutes = Number(
    process.env.PASSWORD_RESET_TTL_MINUTES ?? 60,
  );

  constructor(
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
    private readonly authEmailService: AuthEmailService,
    private readonly loginRateLimiter: LoginRateLimiter,
  ) {}

  async register(registerDto: RegisterDto) {
    const entityDto = registerDto.entity;
    const userDto = registerDto.user;
    const normalizedEmail = userDto.email.toLowerCase().trim();

    const existingUser = await this.findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const existingEntity = await this.findEntityByCrNumber(entityDto.crNumber.trim());
    if (existingEntity) {
      throw new BadRequestException('An organization with this CR number already exists');
    }

    const entityId = uuidv4();
    await this.databaseService.query(
      `INSERT INTO entities (
        id, name_ar, name_en, cr_number, sector, city, region,
        employee_count_bracket, contact_email, contact_phone,
        unified_national_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        entityId,
        entityDto.nameAr.trim(),
        entityDto.nameEn?.trim() || null,
        entityDto.crNumber.trim(),
        entityDto.sector,
        entityDto.city.trim(),
        entityDto.region?.trim() || null,
        entityDto.employeeCountBracket || null,
        entityDto.contactEmail?.trim() || null,
        entityDto.contactPhone?.trim() || null,
        entityDto.unifiedNationalNumber?.trim() || null,
      ],
    );

    const userId = uuidv4();
    const firstName = userDto.firstName.trim();
    const lastName = userDto.lastName?.trim() || null;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    await this.databaseService.query(
      `INSERT INTO users (
        id, entity_id, first_name, last_name, full_name, email,
        password_hash, phone, job_role, role
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        userId,
        entityId,
        firstName,
        lastName,
        fullName,
        normalizedEmail,
        this.hashPassword(userDto.password),
        userDto.phone?.trim() || null,
        userDto.jobRole?.trim() || null,
        'admin',
      ],
    );

    const user = (await this.findUserById(userId))!;
    const entity = (await this.findEntityById(entityId))!;

    return this.buildAuthResponse(user, entity);
  }

  async login(loginDto: LoginDto) {
    const normalizedEmail = loginDto.email.toLowerCase().trim();

    if (this.loginRateLimiter.isLocked(normalizedEmail)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.findUserByEmail(normalizedEmail);

    if (!user || !this.verifyPassword(loginDto.password, user.password)) {
      this.loginRateLimiter.recordFailure(normalizedEmail);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.loginRateLimiter.recordSuccess(normalizedEmail);
    const entity = (await this.findEntityById(user.entityId))!;

    return this.buildAuthResponse(user, entity);
  }

  async requestPasswordReset(forgotPasswordDto: ForgotPasswordDto) {
    const normalizedEmail = forgotPasswordDto.email.toLowerCase().trim();
    const user = await this.findUserByEmail(normalizedEmail);

    if (!user) {
      return {
        message:
          'If an account exists for that email address, a reset link has been sent.',
      };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(rawToken);
    const expiresAt = new Date(
      Date.now() + this.passwordResetTtlMinutes * 60 * 1000,
    ).toISOString();

    await this.invalidatePasswordResetTokens(user.id);
    await this.databaseService.query(
      `INSERT INTO password_reset_tokens (
        id, user_id, token_hash, expires_at
      ) VALUES ($1, $2, $3, $4)`,
      [uuidv4(), user.id, tokenHash, expiresAt],
    );

    await this.authEmailService.sendPasswordResetEmail({
      email: user.email,
      fullName: user.fullName,
      resetToken: rawToken,
      expiresInMinutes: this.passwordResetTtlMinutes,
    });

    this.logger.log(`Password reset requested for ${user.email}`);

    return {
      message:
        'If an account exists for that email address, a reset link has been sent.',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const tokenHash = this.hashResetToken(resetPasswordDto.token.trim());
    const tokenRecord = await this.findPasswordResetToken(tokenHash);

    if (!tokenRecord) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    const user = await this.findUserById(tokenRecord.user_id);

    if (!user) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    await this.databaseService.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [this.hashPassword(resetPasswordDto.password), user.id],
    );
    await this.invalidatePasswordResetTokens(user.id);

    this.logger.log(`Password reset completed for ${user.email}`);

    return {
      message: 'Password updated successfully. You can now sign in.',
    };
  }

  async validateUser(userId: string) {
    return this.findUserById(userId);
  }

  async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.findUserById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const entity = (await this.findEntityById(user.entityId))!;
    return this.toSafeUser(user, entity);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<SafeUser> {
    const user = await this.findUserById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (dto.firstName !== undefined) {
      fields.push(`first_name = $${paramIndex++}`);
      values.push(dto.firstName.trim());
    }

    if (dto.lastName !== undefined) {
      fields.push(`last_name = $${paramIndex++}`);
      values.push(dto.lastName.trim() || null);
    }

    if (dto.phone !== undefined) {
      fields.push(`phone = $${paramIndex++}`);
      values.push(dto.phone.trim() || null);
    }

    if (dto.jobRole !== undefined) {
      fields.push(`job_role = $${paramIndex++}`);
      values.push(dto.jobRole.trim() || null);
    }

    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      const newFirst = dto.firstName?.trim() ?? user.firstName;
      const newLast = dto.lastName !== undefined ? (dto.lastName.trim() || null) : user.lastName;
      const newFullName = [newFirst, newLast].filter(Boolean).join(' ');
      fields.push(`full_name = $${paramIndex++}`);
      values.push(newFullName);
    }

    if (fields.length === 0) {
      const entity = (await this.findEntityById(user.entityId))!;
      return this.toSafeUser(user, entity);
    }

    values.push(userId);
    await this.databaseService.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values,
    );

    const updatedUser = (await this.findUserById(userId))!;
    const entity = (await this.findEntityById(updatedUser.entityId))!;
    return this.toSafeUser(updatedUser, entity);
  }

  async updateEntity(userId: string, dto: UpdateEntityDto): Promise<EntityRecord> {
    const user = await this.findUserById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.role !== 'admin') {
      throw new ForbiddenException('Only organization admins can update entity details');
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const stringFields: Array<[keyof UpdateEntityDto, string]> = [
      ['nameAr', 'name_ar'],
      ['nameEn', 'name_en'],
      ['sector', 'sector'],
      ['city', 'city'],
      ['region', 'region'],
      ['employeeCountBracket', 'employee_count_bracket'],
      ['contactEmail', 'contact_email'],
      ['contactPhone', 'contact_phone'],
      ['unifiedNationalNumber', 'unified_national_number'],
    ];

    for (const [dtoKey, dbCol] of stringFields) {
      const val = dto[dtoKey];
      if (val !== undefined) {
        fields.push(`${dbCol} = $${paramIndex++}`);
        values.push(typeof val === 'string' ? val.trim() || null : null);
      }
    }

    if (fields.length === 0) {
      return (await this.findEntityById(user.entityId))!;
    }

    values.push(user.entityId);
    await this.databaseService.query(
      `UPDATE entities SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values,
    );

    return (await this.findEntityById(user.entityId))!;
  }

  // --- private helpers ---

  private buildAuthResponse(user: UserEntity, entity: EntityRecord) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };

    return {
      user: this.toSafeUser(user, entity),
      accessToken: this.jwtService.sign(payload, {
        secret: jwtConstants.secret,
        expiresIn: jwtConstants.expiresIn,
      }),
    };
  }

  private toSafeUser(user: UserEntity, entity: EntityRecord): SafeUser {
    const { password, ...rest } = user;
    return { ...rest, entity };
  }

  private async findUserByEmail(email: string) {
    const result = await this.databaseService.query<UserRow>(
      `SELECT id, entity_id, first_name, last_name, full_name, email,
              password_hash, phone, job_role, role, created_at
       FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0] ? this.mapRowToUser(result.rows[0]) : null;
  }

  private async findUserById(userId: string) {
    const result = await this.databaseService.query<UserRow>(
      `SELECT id, entity_id, first_name, last_name, full_name, email,
              password_hash, phone, job_role, role, created_at
       FROM users WHERE id = $1`,
      [userId],
    );
    return result.rows[0] ? this.mapRowToUser(result.rows[0]) : null;
  }

  private async findEntityById(entityId: string) {
    const result = await this.databaseService.query<EntityRow>(
      `SELECT id, name_ar, name_en, cr_number, sector, city, region,
              employee_count_bracket, contact_email, contact_phone,
              unified_national_number, created_at
       FROM entities WHERE id = $1`,
      [entityId],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  private async findEntityByCrNumber(crNumber: string) {
    const result = await this.databaseService.query<EntityRow>(
      'SELECT id FROM entities WHERE cr_number = $1',
      [crNumber],
    );
    return result.rows[0] ?? null;
  }

  private async findPasswordResetToken(tokenHash: string) {
    const result = await this.databaseService.query<PasswordResetTokenRow>(
      `SELECT id, user_id, token_hash, expires_at, consumed_at, created_at
       FROM password_reset_tokens
       WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  private async invalidatePasswordResetTokens(userId: string) {
    await this.databaseService.query(
      `UPDATE password_reset_tokens SET consumed_at = NOW()
       WHERE user_id = $1 AND consumed_at IS NULL`,
      [userId],
    );
  }

  private mapRowToUser(row: UserRow): UserEntity {
    return {
      id: row.id,
      entityId: row.entity_id,
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: row.full_name,
      email: row.email,
      password: row.password_hash,
      phone: row.phone,
      jobRole: row.job_role,
      role: row.role,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
    };
  }

  private mapRowToEntity(row: EntityRow): EntityRecord {
    return {
      id: row.id,
      nameAr: row.name_ar,
      nameEn: row.name_en,
      crNumber: row.cr_number,
      sector: row.sector,
      city: row.city,
      region: row.region,
      employeeCountBracket: row.employee_count_bracket,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      unifiedNationalNumber: row.unified_national_number,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
    };
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derivedKey}`;
  }

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private verifyPassword(password: string, storedPassword: string) {
    const [salt, hash] = storedPassword.split(':');

    if (!salt || !hash) {
      return false;
    }

    const derivedBuffer = scryptSync(password, salt, 64);
    const hashBuffer = Buffer.from(hash, 'hex');

    if (derivedBuffer.length !== hashBuffer.length) {
      return false;
    }

    return timingSafeEqual(derivedBuffer, hashBuffer);
  }
}
