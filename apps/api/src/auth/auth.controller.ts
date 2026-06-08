import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateEntityDto } from './dto/update-entity.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { JwtAuthGuard } from './jwt-auth.guard';

type AuthenticatedRequest = Request & {
  user: JwtPayload;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(forgotPasswordDto);
  }

  @Post('reset-password')
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
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
