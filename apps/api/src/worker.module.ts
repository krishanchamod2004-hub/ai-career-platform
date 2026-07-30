import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { MailModule } from './modules/mail/mail.module';
import { QueueModule } from './modules/queue/queue.module';
import { BillingModule } from './modules/billing/billing.module';
import { WorkersModule } from './modules/workers/workers.module';

/**
 * Root module for the background worker process.
 *
 * Deliberately excludes HTTP concerns (controllers, guards, Swagger): the worker
 * has no public surface. It shares the same Prisma/Redis/Mail infrastructure and
 * the same domain services as the API, so business rules cannot diverge.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    RedisModule,
    MailModule,
    QueueModule,
    BillingModule,
    WorkersModule,
  ],
})
export class WorkerAppModule {}
