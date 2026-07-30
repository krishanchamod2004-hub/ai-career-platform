'use client';

import { useQuery } from '@tanstack/react-query';
import { Github, Linkedin, Link as LinkIcon, MapPin, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/stores/auth-store';
import { usersApi } from '@/services/users-api';

export function ProfileCard() {
  const user = useAuthStore((s) => s.user);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: usersApi.getMyProfile,
  });

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{user?.name}</CardTitle>
        <CardDescription>{profile?.headline ?? 'No headline set yet'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{profile?.bio ?? 'No bio added yet.'}</p>

            {profile?.skills && profile.skills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}

            <Separator />

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {profile?.preferredLocations?.length ? profile.preferredLocations.join(', ') : 'No location preference'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wallet className="h-4 w-4" />
                {profile?.salaryExpectation
                  ? `$${profile.salaryExpectation.toLocaleString()} expected`
                  : 'No salary expectation set'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Github className="h-4 w-4" />
                {profile?.githubUrl ?? 'Not linked'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Linkedin className="h-4 w-4" />
                {profile?.linkedinUrl ?? 'Not linked'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
                <LinkIcon className="h-4 w-4" />
                {profile?.portfolioUrl ?? 'No portfolio linked'}
              </div>
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  );
}
