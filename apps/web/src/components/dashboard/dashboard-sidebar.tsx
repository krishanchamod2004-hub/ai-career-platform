'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  BellRing,
  Bookmark,
  Briefcase,
  FileText,
  LayoutDashboard,
  Search,
  Settings,
  Shield,
  Sparkles,
  User,
} from 'lucide-react';
import { UserRole } from '@ai-career/shared';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useUnreadCount } from '@/hooks/use-account';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/jobs', label: 'Find jobs', icon: Search, tourId: 'find-jobs' },
  { href: '/saved-jobs', label: 'Saved jobs', icon: Bookmark },
  { href: '/dashboard/applications', label: 'Applications', icon: Briefcase },
  { href: '/dashboard/evaluations', label: 'AI evaluations', icon: Sparkles },
  { href: '/dashboard/alerts', label: 'Job alerts', icon: BellRing },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell, showBadge: true },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  { href: '/dashboard/admin', label: 'Admin', icon: Shield, adminOnly: true },
  { href: '/dashboard/resumes', label: 'Resumes', icon: FileText, tourId: 'resumes' },
  { href: '/pricing', label: 'Upgrade to Pro', icon: Sparkles, tourId: 'upgrade', highlight: true },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, disabled: true },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const { data: unread } = useUnreadCount();

  return (
    <aside className="hidden w-64 flex-col border-r bg-card/40 backdrop-blur-xl md:flex">
      <div className="flex h-16 items-center gap-2 border-b px-6 font-semibold">
        <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
        AI Career Platform
      </div>
      <nav className="flex-1 space-y-1 p-4" aria-label="Dashboard">
        {navItems
          .filter((item) => !item.adminOnly || user?.role === UserRole.ADMIN)
          .map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.disabled ? '#' : item.href}
                data-tour={item.tourId}
                aria-disabled={item.disabled}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : item.highlight
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  item.disabled && 'pointer-events-none opacity-40',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
                {item.showBadge && unread?.unread ? (
                  <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {unread.unread > 9 ? '9+' : unread.unread}
                  </span>
                ) : null}
                {item.disabled && (
                  <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    Soon
                  </span>
                )}
              </Link>
            );
          })}
      </nav>
    </aside>
  );
}
