import { Module } from '@nestjs/common';
import { AdapterRegistry } from './adapters/adapter.registry';
import { GreenhouseAdapter } from './adapters/greenhouse.adapter';
import { LeverAdapter } from './adapters/lever.adapter';
import { RemoteOkAdapter } from './adapters/remoteok.adapter';
import {
  GlassdoorAdapter,
  IndeedAdapter,
  LinkedInAdapter,
  ZipRecruiterAdapter,
} from './adapters/jobspy.adapter';
import { JobSpyClient } from './adapters/jobspy.client';
import { ScraperHttpClient } from './adapters/scraper-http.client';
import { JobParserService } from './parsers/job-parser.service';
import { DataCleanerService } from './services/data-cleaner.service';
import { DedupeService } from './services/dedupe.service';
import { JobIngestionService } from './services/job-ingestion.service';
import { JobSourcesService } from './services/job-sources.service';
import { ScraperLogService } from './services/scraper-log.service';
import { ScraperService } from './services/scraper.service';

/**
 * Ingestion domain: adapters, parsers, cleaning/dedupe, persistence, and source
 * management. Deliberately contains no queue consumers — those live in
 * WorkersModule so the API process can import this module (for admin endpoints)
 * without turning itself into a worker.
 */
@Module({
  providers: [
    ScraperHttpClient,
    GreenhouseAdapter,
    LeverAdapter,
    RemoteOkAdapter,
    // JobSpy sidecar-backed boards (services/jobspy).
    JobSpyClient,
    LinkedInAdapter,
    IndeedAdapter,
    GlassdoorAdapter,
    ZipRecruiterAdapter,
    AdapterRegistry,
    JobParserService,
    DataCleanerService,
    DedupeService,
    JobIngestionService,
    ScraperLogService,
    ScraperService,
    JobSourcesService,
  ],
  exports: [
    ScraperService,
    JobSourcesService,
    ScraperLogService,
    AdapterRegistry,
    JobParserService,
    DataCleanerService,
    DedupeService,
    JobIngestionService,
    JobSpyClient,
  ],
})
export class ScraperModule {}
