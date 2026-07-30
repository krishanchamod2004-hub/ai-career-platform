import {
  AlertFrequency,
  ApplicationStatus,
  ExperienceLevel,
  JobType,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  WorkLocationType,
} from '../enums';
import type { JobListItem } from './job';

export interface Application {
  id: string;
  userId: string;
  jobId: string | null;
  status: ApplicationStatus;
  /** Snapshots keep the tracker readable even if the source job is archived. */
  jobTitle: string;
  companyName: string;
  jobUrl: string | null;
  location: string | null;
  salaryNote: string | null;
  resumeUrl: string | null;
  coverLetter: string | null;
  notes: string | null;
  appliedAt: string | null;
  nextActionAt: string | null;
  nextActionNote: string | null;
  boardOrder: number;
  createdAt: string;
  updatedAt: string;
  job?: JobListItem | null;
  events?: ApplicationEvent[];
}

export interface ApplicationEvent {
  id: string;
  applicationId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  note: string | null;
  createdAt: string;
}

export type ApplicationBoard = Record<ApplicationStatus, Application[]>;

export interface ApplicationStats {
  total: number;
  byStatus: Record<ApplicationStatus, number>;
  /** Applied -> Interview conversion, as a 0–1 ratio. */
  interviewRate: number;
  offerRate: number;
  responseRate: number;
  avgDaysToInterview: number | null;
  appliedLast7Days: number;
  appliedLast30Days: number;
}

export interface JobAlert {
  id: string;
  userId: string;
  name: string;
  keywords: string[];
  locations: string[];
  jobTypes: JobType[];
  workModels: WorkLocationType[];
  experienceLevels: ExperienceLevel[];
  skills: string[];
  salaryMin: number | null;
  isRemoteOnly: boolean;
  frequency: AlertFrequency;
  channels: NotificationChannel[];
  isActive: boolean;
  lastSentAt: string | null;
  lastMatchedJobAt: string | null;
  matchCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  title: string;
  body: string;
  /** Free-form payload: job ids, alert id, deep-link path, etc. */
  data: Record<string, unknown> | null;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface UnreadCount {
  unread: number;
}
