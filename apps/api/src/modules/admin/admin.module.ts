import { Module } from '@nestjs/common';
import { ScraperModule } from '../scraper/scraper.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AdminController } from './admin.controller';
import { AdminScraperController } from './admin-scraper.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [ScraperModule, AnalyticsModule],
  controllers: [AdminController, AdminScraperController],
  providers: [AdminService],
})
export class AdminModule {}
