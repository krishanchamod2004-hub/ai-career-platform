import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { JobAlertsController } from './job-alerts.controller';
import { JobAlertsService } from './job-alerts.service';

@Module({
  imports: [NotificationsModule],
  controllers: [JobAlertsController],
  providers: [JobAlertsService],
  exports: [JobAlertsService],
})
export class JobAlertsModule {}
