import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { RedisService } from '../../modules/redis/redis.service';
import type { AuthenticatedUser } from '../../modules/auth/interfaces/jwt-payload.interface';

const ACTIVITY_THROTTLE_SECONDS = 300;

/**
 * Records `User.lastActiveAt` for authenticated requests — the signal behind
 * "active users" analytics. A Redis key throttles writes to at most one per user
 * per 5 minutes so hot endpoints don't turn every read into a DB write.
 */
@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;

    if (user?.id) {
      void this.touch(user.id);
    }

    return next.handle();
  }

  private async touch(userId: string): Promise<void> {
    try {
      const key = `activity:${userId}`;
      const wasSet = await this.redis
        .getClient()
        .set(key, '1', 'EX', ACTIVITY_THROTTLE_SECONDS, 'NX');
      if (wasSet !== 'OK') {
        return;
      }
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() },
      });
    } catch {
      // Activity tracking is best-effort telemetry; never fail the request over it.
    }
  }
}
