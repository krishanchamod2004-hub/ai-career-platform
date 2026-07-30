import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailProvider } from './mail-provider.interface';

/**
 * High-level mail service used by application modules (e.g. Auth).
 * Contains templated messages; delegates actual delivery to the injected MailProvider.
 */
@Injectable()
export class MailService {
  private readonly webUrl: string;

  constructor(
    private readonly mailProvider: MailProvider,
    private readonly config: ConfigService,
  ) {
    this.webUrl = this.config.get<string>('WEB_URL', 'http://localhost:3000');
  }

  async sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
    const verifyUrl = `${this.webUrl}/verify-email?token=${token}`;
    await this.mailProvider.send({
      to,
      subject: 'Verify your email — AI Career Platform',
      html: `<p>Hi ${name},</p><p>Please verify your email by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`,
      text: `Hi ${name}, verify your email: ${verifyUrl} (expires in 24 hours)`,
    });
  }

  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
    const resetUrl = `${this.webUrl}/reset-password?token=${token}`;
    await this.mailProvider.send({
      to,
      subject: 'Reset your password — AI Career Platform',
      html: `<p>Hi ${name},</p><p>Reset your password using the link below:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour. If you did not request this, ignore this email.</p>`,
      text: `Hi ${name}, reset your password: ${resetUrl} (expires in 1 hour)`,
    });
  }

  /**
   * Generic transactional email used by the notification worker (job alerts,
   * matching jobs, application reminders). Content is composed upstream so this
   * layer stays a thin template around whatever the notification says.
   */
  async sendNotificationEmail(params: {
    to: string;
    name: string;
    subject: string;
    body: string;
    /** Relative app path to link to, e.g. `/jobs?alert=123`. */
    ctaPath?: string;
  }): Promise<void> {
    const ctaUrl = params.ctaPath
      ? `${this.webUrl}${params.ctaPath.startsWith('/') ? '' : '/'}${params.ctaPath}`
      : null;
    const bodyHtml = escapeHtml(params.body).replace(/\n/g, '<br />');

    await this.mailProvider.send({
      to: params.to,
      subject: params.subject,
      html: [
        `<p>Hi ${escapeHtml(params.name)},</p>`,
        `<p>${bodyHtml}</p>`,
        ctaUrl ? `<p><a href="${ctaUrl}">${ctaUrl}</a></p>` : '',
        '<p style="color:#888;font-size:12px">You are receiving this because of your notification settings on AI Career Platform.</p>',
      ].join(''),
      text: `Hi ${params.name},\n\n${params.body}${ctaUrl ? `\n\n${ctaUrl}` : ''}`,
    });
  }
}

/** Prevents notification content (job titles, company names) from breaking the HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
