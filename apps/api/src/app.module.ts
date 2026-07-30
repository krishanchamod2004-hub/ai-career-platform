import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { MailModule } from './modules/mail/mail.module';
import { QueueModule } from './modules/queue/queue.module';
import { BillingModule } from './modules/billing/billing.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { SavedJobsModule } from './modules/saved-jobs/saved-jobs.module';
import { JobAlertsModule } from './modules/job-alerts/job-alerts.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { ResumesModule } from './modules/resumes/resumes.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AdminModule } from './modules/admin/admin.module';
import { WorkersModule } from './modules/workers/workers.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PlanFeatureGuard } from './common/guards/plan-feature.guard';
import { ActivityInterceptor } from './common/interceptors/activity.interceptor';

/**
 * Set RUN_WORKERS_IN_API=true to consume queues inside the API process.
 * Convenient for local development; in production run the dedicated worker
 * (src/worker.ts) so ingestion load cannot degrade API latency.
 */
const runWorkersInApi = process.env.RUN_WORKERS_IN_API === 'true';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    RedisModule,
    MailModule,
    QueueModule,
    BillingModule,
    AuthModule,
    UsersModule,
    HealthModule,
    JobsModule,
    CompaniesModule,
    SavedJobsModule,
    JobAlertsModule,
    ApplicationsModule,
    NotificationsModule,
    EvaluationsModule,
    ResumesModule,
    AnalyticsModule,
    AdminModule,
    ...(runWorkersInApi ? [WorkersModule] : []),
  ],
  providers: [
    // Guard order matters: authenticate, then check role, then check plan.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PlanFeatureGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ActivityInterceptor },
  ],
})
export class AppModule {}
