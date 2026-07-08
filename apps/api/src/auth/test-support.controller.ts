import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * DEV / E2E ONLY. Exposes the OTP that would otherwise be delivered by email so
 * the Playwright suite can drive the full sign-up → verify flow.
 *
 * Both the store (AuthService.peekDevOtp) and this endpoint are inert unless
 * `NODE_ENV !== 'production'` AND `E2E_TEST_MODE === 'true'`. In production the
 * endpoint always 404s and the underlying store is never populated.
 */
@Controller('test')
export class TestSupportController {
  constructor(private readonly authService: AuthService) {}

  @Get('otp')
  getOtp(@Query('email') email?: string) {
    const code = email ? this.authService.peekDevOtp(email) : null;
    if (!code) {
      throw new NotFoundException('No OTP available for that email.');
    }
    return { email, code };
  }
}
