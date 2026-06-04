import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { jwtConstants } from './auth.constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SafeUser, UserEntity } from './entities/user.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly users: UserEntity[] = [];

  constructor(private readonly jwtService: JwtService) {}

  register(registerDto: RegisterDto) {
    const normalizedEmail = registerDto.email.toLowerCase().trim();
    const existingUser = this.users.find((user) => user.email === normalizedEmail);

    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const newUser: UserEntity = {
      id: uuidv4(),
      fullName: registerDto.fullName.trim(),
      email: normalizedEmail,
      password: this.hashPassword(registerDto.password),
      createdAt: new Date().toISOString(),
    };

    this.users.push(newUser);

    return this.buildAuthResponse(newUser);
  }

  login(loginDto: LoginDto) {
    const normalizedEmail = loginDto.email.toLowerCase().trim();
    const user = this.users.find((entry) => entry.email === normalizedEmail);

    if (!user || !this.verifyPassword(loginDto.password, user.password)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  validateUser(userId: string) {
    return this.users.find((user) => user.id === userId) ?? null;
  }

  getProfile(userId: string): SafeUser {
    const user = this.validateUser(userId);

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

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derivedKey}`;
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
