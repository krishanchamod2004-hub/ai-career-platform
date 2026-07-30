import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailProvider } from './mail-provider.interface';
import { ConsoleMailProvider } from './console-mail.provider';

@Module({
  providers: [
    MailService,
    {
      provide: MailProvider,
      useClass: ConsoleMailProvider,
    },
  ],
  exports: [MailService],
})
export class MailModule {}
