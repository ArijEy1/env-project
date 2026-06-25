import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from 'crypto';
import bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { AuthEmailService } from './auth-email.service';
import { jwtConstants } from './auth.constants';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { UpdateEntityDto } from './dto/update-entity.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { EntityRecord } from './entities/entity.entity';
import { SafeUser, UserEntity } from './entities/user.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginRateLimiter } from './login-rate-limiter';

const BCRYPT_SALT_ROUNDS = 12;
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

interface PendingRegistrationPayload {
  entity: {
    nameAr: string;
    nameEn: string | null;
    crNumber: string;
    sector: string;
    city: string;
    region: string | null;
    employeeCountBracket: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    unifiedNationalNumber: string | null;
  };
  user: {
    firstName: string;
    lastName: string | null;
    fullName: string;
    email: string;
    phone: string | null;
    jobRole: string | null;
    passwordHash: string;
  };
}

interface PendingRegistrationRow {
  id: string;
  email: string;
  otp_hash: string;
  payload: PendingRegistrationPayload;
  expires_at: Date | string;
  attempts: number;
  last_sent_at: Date | string;
  created_at: Date | string;
}

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
    process.env.PASSWORD_RESET_TTL_MINUTES ?? 30,
  );

  constructor(
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
    private readonly authEmailService: AuthEmailService,
    private readonly loginRateLimiter: LoginRateLimiter,
  ) {}

  /**
   * Step 1 of sign-up: validates the payload, stashes it (with an already
   * bcrypt-hashed password) in pending_registrations, and emails a 6-digit OTP.
   * No entity/user rows are created until the OTP is verified.
   */
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

    const firstName = userDto.firstName.trim();
    const lastName = userDto.lastName?.trim() || null;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    const payload: PendingRegistrationPayload = {
      entity: {
        nameAr: entityDto.nameAr.trim(),
        nameEn: entityDto.nameEn?.trim() || null,
        crNumber: entityDto.crNumber.trim(),
        sector: entityDto.sector,
        city: entityDto.city.trim(),
        region: entityDto.region?.trim() || null,
        employeeCountBracket: entityDto.employeeCountBracket || null,
        contactEmail: entityDto.contactEmail?.trim() || null,
        contactPhone: entityDto.contactPhone?.trim() || null,
        unifiedNationalNumber: entityDto.unifiedNationalNumber?.trim() || null,
      },
      user: {
        firstName,
        lastName,
        fullName,
        email: normalizedEmail,
        phone: userDto.phone?.trim() || null,
        jobRole: userDto.jobRole?.trim() || null,
        // Hash now so the plaintext password is never persisted, even transiently.
        passwordHash: this.hashPassword(userDto.password),
      },
    };

    const code = this.generateOtp();
    const expiresAt = new Date(
      Date.now() + OTP_TTL_MINUTES * 60 * 1000,
    ).toISOString();

    // Upsert: re-registering with the same email replaces the pending entry and
    // resets the attempt counter.
    await this.databaseService.query(
      `INSERT INTO pending_registrations (id, email, otp_hash, payload, expires_at, attempts, last_sent_at)
       VALUES ($1, $2, $3, $4, $5, 0, NOW())
       ON CONFLICT (email) DO UPDATE
         SET otp_hash = EXCLUDED.otp_hash,
             payload = EXCLUDED.payload,
             expires_at = EXCLUDED.expires_at,
             attempts = 0,
             last_sent_at = NOW()`,
      [uuidv4(), normalizedEmail, this.hashOtp(code), JSON.stringify(payload), expiresAt],
    );

    await this.authEmailService.sendOtpEmail({
      email: normalizedEmail,
      fullName,
      code,
      expiresInMinutes: OTP_TTL_MINUTES,
    });

    this.logger.log(`OTP issued for pending registration ${normalizedEmail}`);

    return {
      message: 'A 6-digit verification code has been sent to your email address.',
      email: normalizedEmail,
      expiresInMinutes: OTP_TTL_MINUTES,
    };
  }

  /**
   * Step 2 of sign-up: verifies the OTP and, on success, atomically creates the
   * entity + admin user and returns an authenticated session.
   */
  async verifyOtp(dto: VerifyOtpDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const pending = await this.findPendingRegistration(normalizedEmail);

    if (!pending) {
      throw new BadRequestException('The verification code is invalid or has expired');
    }

    if (new Date(pending.expires_at).getTime() <= Date.now()) {
      await this.deletePendingRegistration(normalizedEmail);
      throw new BadRequestException('The verification code is invalid or has expired');
    }

    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      await this.deletePendingRegistration(normalizedEmail);
      throw new BadRequestException(
        'Too many incorrect attempts. Please start the registration again.',
      );
    }

    if (!this.otpMatches(pending.otp_hash, dto.code)) {
      await this.databaseService.query(
        'UPDATE pending_registrations SET attempts = attempts + 1 WHERE email = $1',
        [normalizedEmail],
      );
      throw new BadRequestException('The verification code is incorrect');
    }

    // Re-check uniqueness in case someone registered the same email/CR while
    // this OTP was outstanding.
    const existingUser = await this.findUserByEmail(normalizedEmail);
    if (existingUser) {
      await this.deletePendingRegistration(normalizedEmail);
      throw new BadRequestException('Email already exists');
    }
    const existingEntity = await this.findEntityByCrNumber(
      pending.payload.entity.crNumber,
    );
    if (existingEntity) {
      await this.deletePendingRegistration(normalizedEmail);
      throw new BadRequestException(
        'An organization with this CR number already exists',
      );
    }

    const authResponse = await this.createAccountFromPayload(pending.payload);
    await this.deletePendingRegistration(normalizedEmail);
    this.logger.log(`Registration completed via OTP for ${normalizedEmail}`);
    return authResponse;
  }

  /** Re-sends a fresh OTP for a pending registration, subject to a cooldown. */
  async resendOtp(dto: ResendOtpDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const genericMessage = {
      message:
        'If a registration is pending for that email, a new code has been sent.',
    };

    const pending = await this.findPendingRegistration(normalizedEmail);
    if (!pending) {
      // Don't reveal whether a pending registration exists.
      return genericMessage;
    }

    const sinceLastMs = Date.now() - new Date(pending.last_sent_at).getTime();
    if (sinceLastMs < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      const waitSeconds = Math.ceil(
        (OTP_RESEND_COOLDOWN_SECONDS * 1000 - sinceLastMs) / 1000,
      );
      throw new BadRequestException(
        `Please wait ${waitSeconds} seconds before requesting another code.`,
      );
    }

    const code = this.generateOtp();
    const expiresAt = new Date(
      Date.now() + OTP_TTL_MINUTES * 60 * 1000,
    ).toISOString();

    await this.databaseService.query(
      `UPDATE pending_registrations
       SET otp_hash = $1, expires_at = $2, attempts = 0, last_sent_at = NOW()
       WHERE email = $3`,
      [this.hashOtp(code), expiresAt, normalizedEmail],
    );

    await this.authEmailService.sendOtpEmail({
      email: normalizedEmail,
      fullName: pending.payload.user.fullName,
      code,
      expiresInMinutes: OTP_TTL_MINUTES,
    });

    return genericMessage;
  }

  private async createAccountFromPayload(payload: PendingRegistrationPayload) {
    const entityId = uuidv4();
    await this.databaseService.query(
      `INSERT INTO entities (
        id, name_ar, name_en, cr_number, sector, city, region,
        employee_count_bracket, contact_email, contact_phone,
        unified_national_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        entityId,
        payload.entity.nameAr,
        payload.entity.nameEn,
        payload.entity.crNumber,
        payload.entity.sector,
        payload.entity.city,
        payload.entity.region,
        payload.entity.employeeCountBracket,
        payload.entity.contactEmail,
        payload.entity.contactPhone,
        payload.entity.unifiedNationalNumber,
      ],
    );

    const userId = uuidv4();
    await this.databaseService.query(
      `INSERT INTO users (
        id, entity_id, first_name, last_name, full_name, email,
        password_hash, phone, job_role, role
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        userId,
        entityId,
        payload.user.firstName,
        payload.user.lastName,
        payload.user.fullName,
        payload.user.email,
        payload.user.passwordHash,
        payload.user.phone,
        payload.user.jobRole,
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

    // Transparent upgrade: re-hash legacy scrypt passwords to bcrypt on a
    // successful login so the store migrates without forcing a reset.
    if (this.isLegacyHash(user.password)) {
      const rehashed = this.hashPassword(loginDto.password);
      await this.databaseService.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [rehashed, user.id],
      );
      user.password = rehashed;
    }

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

  /**
   * Issues a fresh access token for an already-authenticated user. The frontend
   * calls this on activity so active sessions never expire mid-use (8h window),
   * while idle sessions still lapse. Re-reads the user so role/profile changes
   * propagate into the new token.
   */
  async refreshSession(userId: string) {
    const user = await this.findUserById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const entity = (await this.findEntityById(user.entityId))!;
    return this.buildAuthResponse(user, entity);
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
    // bcrypt with salt factor 12 (per spec). bcrypt embeds the salt + cost in
    // the output string, e.g. "$2a$12$...".
    return bcrypt.hashSync(password, BCRYPT_SALT_ROUNDS);
  }

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Cryptographically-random, uniform 6-digit code (e.g. "048213"). */
  private generateOtp(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hashOtp(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private otpMatches(storedHash: string, code: string): boolean {
    const expected = Buffer.from(storedHash, 'hex');
    const actual = Buffer.from(this.hashOtp(code), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private async findPendingRegistration(
    email: string,
  ): Promise<PendingRegistrationRow | null> {
    const result = await this.databaseService.query<PendingRegistrationRow>(
      `SELECT id, email, otp_hash, payload, expires_at, attempts, last_sent_at, created_at
       FROM pending_registrations WHERE email = $1`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  private async deletePendingRegistration(email: string) {
    await this.databaseService.query(
      'DELETE FROM pending_registrations WHERE email = $1',
      [email],
    );
  }

  /** A bcrypt hash starts with "$2"; anything else is a legacy scrypt value. */
  private isLegacyHash(storedPassword: string) {
    return !storedPassword.startsWith('$2');
  }

  private verifyPassword(password: string, storedPassword: string) {
    if (!this.isLegacyHash(storedPassword)) {
      return bcrypt.compareSync(password, storedPassword);
    }

    // Legacy scrypt "salt:hash" verification, kept so accounts created before
    // the bcrypt migration can still sign in (and get re-hashed on login).
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
