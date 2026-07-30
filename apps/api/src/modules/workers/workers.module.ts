import { Module } from '@nestjs/common';
import { ScraperModule } from '../scraper/scraper.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ApplicationsModule } from '../applications/applications.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ScraperProcessor } from '../scraper/workers/scraper.processor';
import { ScraperSchedulerService } from '../scraper/scheduler/scraper-scheduler.service';
import { NotificationsProcessor } from './notifications.processor';
import { MaintenanceProcessor } from './maintenance.processor';

/**
 * All queue consumers plus the cron scheduler.
 *
 * Imported by `worker.ts` (dedicated worker process) and, optionally, by
 * AppModule when RUN_WORKERS_IN_API=true — convenient for local development
 * where running a second process is friction.
 */
@Module({
  imports: [ScraperModule, NotificationsModule, ApplicationsModule, AnalyticsModule],
  providers: [
    ScraperProcessor,
    NotificationsProcessor,
    MaintenanceProcessor,
    ScraperSchedulerService,
  ],
})
export class WorkersModule {}
