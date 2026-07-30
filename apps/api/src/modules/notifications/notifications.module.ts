import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { JobMatchingService } from './job-matching.service';

@Module({
  imports: [MailModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, JobMatchingService],
  exports: [NotificationsService, JobMatchingService],
})
export class NotificationsModule {}
