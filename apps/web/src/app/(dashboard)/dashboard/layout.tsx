import { RequireAuth } from '@/components/auth/require-auth';
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar';
import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar';
import { OnboardingTourProvider } from '@/contexts/onboarding-tour-context';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <OnboardingTourProvider>
        <div className="flex min-h-screen bg-background">
          <DashboardSidebar />
          <div className="flex flex-1 flex-col">
            <DashboardTopbar />
            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </OnboardingTourProvider>
    </RequireAuth>
  );
}
