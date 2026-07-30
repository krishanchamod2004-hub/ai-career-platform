import { ProfileCard } from '@/components/dashboard/profile-card';

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Your Profile</h2>
        <p className="text-muted-foreground">
          This information helps us match you with the right jobs and generate tailored resumes.
        </p>
      </div>
      <ProfileCard />
    </div>
  );
}
