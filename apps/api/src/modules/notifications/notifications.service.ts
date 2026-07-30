import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  type Notification,
  type PaginatedResponse,
} from '@ai-career/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { QueueService } from '../queue/queue.service';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../../common/pagination/pagination.util';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
  /** Idempotency key; a repeated key is silently ignored. */
  dedupeKey?: string;
}

/**
 * Notification records + delivery.
 *
 * In-app notifications are the durable record; email delivery is queued so a
 * flaky mail provider never blocks (or duplicates) the triggering work. Swapping
 * ConsoleMailProvider for SES/Postmark requires no changes here.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly queue: QueueService,
  ) {}

  async list(
    userId: string,
    params: { page?: number; pageSize?: number; unreadOnly?: boolean },
  ): Promise<PaginatedResponse<Notification>> {
    const { page, pageSize } = normalizePagination(params.page, params.pageSize);
    const where: Prisma.NotificationWhereInput = {
      userId,
      channel: NotificationChannel.IN_APP,
      ...(params.unreadOnly ? { readAt: null } : {}),
    };

    const [rows, totalItems] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return buildPaginatedResponse(
      rows.map((row) => this.toNotification(row)),
      totalItems,
      page,
      pageSize,
    );
  }

  async unreadCount(userId: string): Promise<{ unread: number }> {
    const unread = await this.prisma.notification.count({
      where: { userId, channel: NotificationChannel.IN_APP, readAt: null },
    });
    return { unread };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: notification.readAt ?? new Date() },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  /**
   * Creates one record per requested channel and queues email delivery.
   * Returns the created records (empty when suppressed by the dedupe key).
   */
  async create(input: CreateNotificationInput) {
    const channels = input.channels?.length ? input.channels : [NotificationChannel.IN_APP];
    const created: Array<{ id: string; channel: NotificationChannel }> = [];

    for (const channel of channels) {
      const dedupeKey = input.dedupeKey ? `${input.dedupeKey}:${channel}` : undefined;

      try {
        const record = await this.prisma.notification.create({
          data: {
            userId: input.userId,
            type: input.type,
            channel,
            title: input.title.slice(0, 200),
            body: input.body.slice(0, 4000),
            data: input.data ? (input.data as object) : undefined,
            dedupeKey,
            // In-app records are immediately "delivered"; email waits on the queue.
            status:
              channel === NotificationChannel.IN_APP
                ? NotificationStatus.SENT
                : NotificationStatus.PENDING,
            sentAt: channel === NotificationChannel.IN_APP ? new Date() : null,
          },
          select: { id: true, channel: true },
        });

        created.push({ id: record.id, channel: record.channel as NotificationChannel });

        if (channel === NotificationChannel.EMAIL) {
          await this.queue.enqueueNotificationDelivery({ notificationId: record.id });
        }
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          this.logger.debug(`Suppressed duplicate notification (${dedupeKey})`);
          continue;
        }
        throw error;
      }
    }

    return created;
  }

  /** Worker entrypoint: performs the actual email send for a queued record. */
  async deliver(notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { user: { select: { email: true, name: true } } },
    });

    if (!notification || notification.status === NotificationStatus.SENT) {
      return;
    }

    try {
      const data = (notification.data ?? {}) as { url?: string };
      await this.mail.sendNotificationEmail({
        to: notification.user.email,
        name: notification.user.name,
        subject: notification.title,
        body: notification.body,
        ctaPath: data.url,
      });

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.SENT, sentAt: new Date(), error: null },
      });
    } catch (error) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FAILED,
          error: (error as Error).message.slice(0, 500),
        },
      });
      throw error;
    }
  }

  private toNotification(row: {
    id: string;
    userId: string;
    type: string;
    channel: string;
    status: string;
    title: string;
    body: string;
    data: Prisma.JsonValue | null;
    readAt: Date | null;
    sentAt: Date | null;
    createdAt: Date;
  }): Notification {
    return {
      id: row.id,
      userId: row.userId,
      type: row.type as NotificationType,
      channel: row.channel as NotificationChannel,
      status: row.status as NotificationStatus,
      title: row.title,
      body: row.body,
      data: (row.data ?? null) as Record<string, unknown> | null,
      readAt: row.readAt?.toISOString() ?? null,
      sentAt: row.sentAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
