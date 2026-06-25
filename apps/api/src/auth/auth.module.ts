import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from '../database/database.module';
import { jwtConstants } from './auth.constants';
import { AuthEmailService } from './auth-email.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { LoginRateLimiter } from './login-rate-limiter';
import { RegisterRateLimiter } from './register-rate-limiter';

@Module({
  imports: [
    DatabaseModule,
    PassportModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: {
        expiresIn: jwtConstants.expiresIn,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthEmailService,
    JwtStrategy,
    LoginRateLimiter,
    RegisterRateLimiter,
  ],
  exports: [AuthService, AuthEmailService],
})
export class AuthModule {}
