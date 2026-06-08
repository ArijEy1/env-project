import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

interface PasswordResetEmailParams {
  email: string;
  fullName: string;
  resetToken: string;
  expiresInMinutes: number;
}

@Injectable()
export class AuthEmailService {
  private readonly logger = new Logger(AuthEmailService.name);
  private readonly appWebUrl = process.env.APP_WEB_URL ?? 'http://localhost:3000';
  private readonly smtpHost = process.env.SMTP_HOST;
  private readonly smtpPort = Number(process.env.SMTP_PORT ?? 587);
  private readonly smtpSecure = process.env.SMTP_SECURE === 'true';
  private readonly smtpUser = process.env.SMTP_USER;
  private readonly smtpPassword = process.env.SMTP_PASSWORD;
  private readonly smtpFrom = process.env.SMTP_FROM ?? 'no-reply@env-project.local';

  async sendPasswordResetEmail(params: PasswordResetEmailParams) {
    const resetUrl = new URL('/reset-password', this.appWebUrl);
    resetUrl.searchParams.set('token', params.resetToken);
    const escapedFullName = this.escapeHtml(params.fullName);
    const escapedResetUrl = this.escapeHtml(resetUrl.toString());

    const subject = 'Reset your password • Env Project';
    const text = [
      'ENV PROJECT',
      'Password reset request',
      '',
      `Hello ${params.fullName},`,
      '',
      'We received a request to reset your password.',
      `This link is valid for ${params.expiresInMinutes} minutes.`,
      '',
      'Reset your password here:',
      resetUrl.toString(),
      '',
      'If you did not request this change, you can safely ignore this email.',
      'Your current password will remain unchanged until you create a new one.',
      '',
      'Need help? Return to the platform and request a new reset link if this one expires.',
      '',
      'Env Project',
      this.appWebUrl,
      '',
      'If you did not request this change, you can ignore this email.',
    ].join('\n');

    const html = `
      <div style="margin: 0; padding: 24px 12px; background: #f3f5f4; font-family: Arial, Helvetica, sans-serif; color: #17302c;">
        <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #dfe8e4; box-shadow: 0 18px 48px rgba(15, 49, 45, 0.08);">
          <div style="padding: 28px 32px; background: linear-gradient(135deg, #0f3d48 0%, #0f6b5b 65%, #d8b16c 140%); color: #ffffff;">
            <div style="display: inline-block; padding: 6px 10px; border-radius: 999px; background: rgba(255,255,255,0.14); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;">Env Project</div>
            <h1 style="margin: 18px 0 10px; font-size: 28px; line-height: 1.2;">Reset your password</h1>
            <p style="margin: 0; max-width: 40ch; color: rgba(255,255,255,0.92); font-size: 15px; line-height: 1.7;">We received a request to reset your account password. Use the secure button below to continue.</p>
          </div>

          <div style="padding: 30px 32px 18px;">
            <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.7;">Hello ${escapedFullName},</p>
            <p style="margin: 0 0 18px; font-size: 15px; line-height: 1.7; color: #49635d;">For your security, this reset link expires in <strong style="color: #17302c;">${params.expiresInMinutes} minutes</strong>. If you did not request a password reset, you can safely ignore this message.</p>

            <div style="margin: 22px 0 24px; padding: 18px; border-radius: 16px; background: #f7fbf9; border: 1px solid #dbe7e2;">
              <p style="margin: 0 0 14px; font-size: 14px; color: #4d6761;">Choose a new password by clicking the button below:</p>
              <a href="${resetUrl.toString()}" style="display: inline-block; padding: 13px 20px; border-radius: 12px; background: #1a6a58; color: #ffffff; text-decoration: none; font-weight: 700;">Reset password</a>
            </div>

            <p style="margin: 0 0 10px; font-size: 14px; color: #4d6761;">If the button does not open, copy and paste this link into your browser:</p>
            <p style="margin: 0 0 20px; padding: 14px 16px; border-radius: 12px; background: #f3f7f5; border: 1px solid #e2ece7; word-break: break-word; font-size: 13px; line-height: 1.6;">
              <a href="${resetUrl.toString()}" style="color: #0f6b5b; text-decoration: none;">${escapedResetUrl}</a>
            </p>

            <div style="margin-top: 20px; padding-top: 18px; border-top: 1px solid #e7efeb; font-size: 13px; line-height: 1.7; color: #647a75;">
              <p style="margin: 0 0 10px;">If you did not request this change, your password stays the same until a new one is confirmed.</p>
              <p style="margin: 0;">Need another link? Go back to the sign-in page and submit a new reset request.</p>
            </div>
          </div>
        </div>
      </div>
    `;

    const transport = this.createTransport();

    if (!transport) {
      this.logger.warn(
        `SMTP is not configured. Password reset link for ${params.email}: ${resetUrl.toString()}`,
      );
      return;
    }

    await transport.sendMail({
      from: this.smtpFrom,
      to: params.email,
      subject,
      text,
      html,
    });
  }

  private createTransport() {
    if (!this.smtpHost) {
      return null;
    }

    return nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: this.smtpSecure,
      auth:
        this.smtpUser || this.smtpPassword
          ? {
              user: this.smtpUser,
              pass: this.smtpPassword,
            }
          : undefined,
    });
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}