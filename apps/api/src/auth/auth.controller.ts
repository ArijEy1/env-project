import { Body, Controller, Get, Ip, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterRateLimiter } from './register-rate-limiter';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { UpdateEntityDto } from './dto/update-entity.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { JwtAuthGuard } from './jwt-auth.guard';

type AuthenticatedRequest = Request & {
  user: JwtPayload;
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly registerRateLimiter: RegisterRateLimiter,
  ) {}

  @Post('register')
  register(@Ip() ip: string, @Body() registerDto: RegisterDto) {
    this.registerRateLimiter.assertWithinLimit(ip);
    return this.authService.register(registerDto);
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('resend-otp')
  resendOtp(@Ip() ip: string, @Body() dto: ResendOtpDto) {
    // Rate-limited like register since it triggers an outbound email.
    this.registerRateLimiter.assertWithinLimit(ip);
    return this.authService.resendOtp(dto);
  }

  @Post('login')
  login(@Ip() ip: string, @Body() loginDto: LoginDto) {
    return this.authService.login(loginDto, ip);
  }

  @Post('forgot-password')
  forgotPassword(@Ip() ip: string, @Body() forgotPasswordDto: ForgotPasswordDto) {
    // Throttle to prevent reset-email flooding / token generation abuse.
    this.registerRateLimiter.assertWithinLimit(ip);
    return this.authService.requestPasswordReset(forgotPasswordDto);
  }

  @Post('reset-password')
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  refresh(@Req() req: AuthenticatedRequest) {
    return this.authService.refreshSession(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  updateProfile(@Req() req: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('entity')
  updateEntity(@Req() req: AuthenticatedRequest, @Body() dto: UpdateEntityDto) {
    return this.authService.updateEntity(req.user.sub, dto);
  }
}
