'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, LogOut, User as UserIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ApiKeyDialog } from '@/components/evaluations/api-key-dialog';
import { useHydrateAiKey } from '@/hooks/use-evaluations';
import { useAiKeyStore } from '@/stores/ai-key-store';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/services/auth-api';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function DashboardTopbar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  useHydrateAiKey();
  const hasAiKey = useAiKeyStore((s) => Boolean(s.apiKey));
  const [isKeyDialogOpen, setIsKeyDialogOpen] = React.useState(false);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      clearAuth();
      router.push('/login');
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background/80 px-6 backdrop-blur-xl">
      <h1 className="text-lg font-semibold">Dashboard</h1>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{user ? getInitials(user.name) : <UserIcon className="h-4 w-4" />}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">{user?.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsKeyDialogOpen(true)}>
              <KeyRound className="mr-2 h-4 w-4" />
              {hasAiKey ? 'Change AI key' : 'Add AI key'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ApiKeyDialog open={isKeyDialogOpen} onClose={() => setIsKeyDialogOpen(false)} />
    </header>
  );
}
