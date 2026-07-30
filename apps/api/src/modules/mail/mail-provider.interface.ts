/**
 * Abstraction over email delivery so the placeholder console-logger implementation
 * can later be swapped for a real provider (SES, SendGrid, Postmark, etc.)
 * without touching call sites in the Auth module.
 */
export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export abstract class MailProvider {
  abstract send(message: MailMessage): Promise<void>;
}
