import { Injectable, Logger } from '@nestjs/common';
import { MailMessage, MailProvider } from './mail-provider.interface';

/**
 * Placeholder mail provider — logs emails to the console instead of sending them.
 * Replace with a real provider (SES/SendGrid/Postmark) in a later phase by
 * implementing MailProvider and swapping the binding in MailModule.
 */
@Injectable()
export class ConsoleMailProvider extends MailProvider {
  private readonly logger = new Logger('MailService');

  async send(message: MailMessage): Promise<void> {
    this.logger.log('--- [PLACEHOLDER EMAIL] ---');
    this.logger.log(`To: ${message.to}`);
    this.logger.log(`Subject: ${message.subject}`);
    this.logger.log(`Body:\n${message.text ?? message.html}`);
    this.logger.log('---------------------------');
    return Promise.resolve();
  }
}
