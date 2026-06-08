import {
  BadRequestException,
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
import { SafeUser, UserEntity } from './entities/user.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';

interface UserRow {
  id: string;
  first_name: string;
  last_name: string | null;
  full_name: string;
  email: string;
  password_hash: string;
  phone: string | null;
  country_code: string | null;
  entity: string | null;
  job_role: string | null;
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
  ) {}

  async register(registerDto: RegisterDto) {
    const normalizedEmail = registerDto.email.toLowerCase().trim();
    const existingUser = await this.findUserByEmail(normalizedEmail);

    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const newUser: UserEntity = {
      id: uuidv4(),
      firstName: registerDto.firstName.trim(),
      lastName: registerDto.lastName?.trim() || null,
      fullName: registerDto.fullName.trim(),
      email: normalizedEmail,
      password: this.hashPassword(registerDto.password),
      phone: registerDto.phone?.trim() || null,
      countryCode: registerDto.countryCode?.trim() || null,
      entity: registerDto.entity?.trim() || null,
      jobRole: registerDto.jobRole?.trim() || null,
      createdAt: new Date().toISOString(),
    };

    await this.databaseService.query(
      `INSERT INTO users (
        id,
        first_name,
        last_name,
        full_name,
        email,
        password_hash,
        phone,
        country_code,
        entity,
        job_role,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        newUser.id,
        newUser.firstName,
        newUser.lastName,
        newUser.fullName,
        newUser.email,
        newUser.password,
        newUser.phone,
        newUser.countryCode,
        newUser.entity,
        newUser.jobRole,
        newUser.createdAt,
      ],
    );

    return this.buildAuthResponse(newUser);
  }

  async login(loginDto: LoginDto) {
    const normalizedEmail = loginDto.email.toLowerCase().trim();
    const user = await this.findUserByEmail(normalizedEmail);

    if (!user || !this.verifyPassword(loginDto.password, user.password)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
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
        id,
        user_id,
        token_hash,
        expires_at
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
    const user = await this.validateUser(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.toSafeUser(user);
  }

  private buildAuthResponse(user: UserEntity) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
    };

    return {
      user: this.toSafeUser(user),
      accessToken: this.jwtService.sign(payload, {
        secret: jwtConstants.secret,
        expiresIn: jwtConstants.expiresIn,
      }),
    };
  }

  private toSafeUser(user: UserEntity): SafeUser {
    const { password, ...safeUser } = user;
    return safeUser;
  }

  private async findUserByEmail(email: string) {
    const result = await this.databaseService.query<UserRow>(
      `SELECT
        id,
        first_name,
        last_name,
        full_name,
        email,
        password_hash,
        phone,
        country_code,
        entity,
        job_role,
        created_at
      FROM users
      WHERE email = $1`,
      [email],
    );

    return result.rows[0] ? this.mapRowToUser(result.rows[0]) : null;
  }

  private async findUserById(userId: string) {
    const result = await this.databaseService.query<UserRow>(
      `SELECT
        id,
        first_name,
        last_name,
        full_name,
        email,
        password_hash,
        phone,
        country_code,
        entity,
        job_role,
        created_at
      FROM users
      WHERE id = $1`,
      [userId],
    );

    return result.rows[0] ? this.mapRowToUser(result.rows[0]) : null;
  }

  private async findPasswordResetToken(tokenHash: string) {
    const result = await this.databaseService.query<PasswordResetTokenRow>(
      `SELECT
        id,
        user_id,
        token_hash,
        expires_at,
        consumed_at,
        created_at
      FROM password_reset_tokens
      WHERE token_hash = $1
        AND consumed_at IS NULL
        AND expires_at > NOW()
      LIMIT 1`,
      [tokenHash],
    );

    return result.rows[0] ?? null;
  }

  private async invalidatePasswordResetTokens(userId: string) {
    await this.databaseService.query(
      `UPDATE password_reset_tokens
      SET consumed_at = NOW()
      WHERE user_id = $1
        AND consumed_at IS NULL`,
      [userId],
    );
  }

  private mapRowToUser(row: UserRow): UserEntity {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: row.full_name,
      email: row.email,
      password: row.password_hash,
      phone: row.phone,
      countryCode: row.country_code,
      entity: row.entity,
      jobRole: row.job_role,
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
