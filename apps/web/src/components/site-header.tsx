'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Bookmark, Briefcase, LayoutDashboard, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuthStore } from '@/stores/auth-store';
import { useUnreadCount } from '@/hooks/use-account';
import { cn } from '@/lib/utils';

const links = [
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/saved-jobs', label: 'Saved', icon: Bookmark, requiresAuth: true },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresAuth: true },
];

/** Header for the public job-discovery pages (/jobs, /jobs/[id], /saved-jobs). */
export function SiteHeader() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const { data: unread } = useUnreadCount();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="hidden sm:inline">AI Career Platform</span>
        </Link>

        <nav className="flex flex-1 items-center gap-1" aria-label="Main">
          {links
            .filter((link) => !link.requiresAuth || user)
            .map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {link.label}
                </Link>
              );
            })}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <Link
              href="/dashboard/notifications"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              aria-label={`Notifications${unread?.unread ? `, ${unread.unread} unread` : ''}`}
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              {unread?.unread ? (
                <Badge
                  variant="destructive"
                  className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1"
                >
                  {unread.unread > 9 ? '9+' : unread.unread}
                </Badge>
              ) : null}
            </Link>
          ) : null}
          <ThemeToggle />
          {user ? null : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
