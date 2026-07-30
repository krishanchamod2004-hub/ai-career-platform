'use client';

import * as React from 'react';
import { driver, type Driver, type Config } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuthStore } from '@/stores/auth-store';
import { usersApi } from '@/services/users-api';

interface OnboardingTourContextValue {
  startTour: () => void;
  stopTour: () => void;
  isActive: boolean;
}

const OnboardingTourContext = React.createContext<OnboardingTourContextValue | undefined>(
  undefined,
);

interface OnboardingTourProviderProps {
  children: React.ReactNode;
}

export function OnboardingTourProvider({ children }: OnboardingTourProviderProps) {
  const user = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const [isActive, setIsActive] = React.useState(false);
  const driverRef = React.useRef<Driver | null>(null);

  const markComplete = React.useCallback(async () => {
    try {
      await usersApi.markOnboardingComplete();
      // Update local user state to prevent tour from re-triggering
      if (user) {
        setAuth({ ...user, hasCompletedOnboarding: true }, useAuthStore.getState().accessToken!);
      }
    } catch (error) {
      console.error('Failed to mark onboarding complete:', error);
    }
  }, [user, setAuth]);

  const driverConfig: Config = React.useMemo(
    () => ({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      steps: [
        {
          popover: {
            title: 'Welcome to AI Career Platform',
            description:
              'Let\'s take a quick tour to help you land your dream job. This will only take a minute.',
            side: 'bottom',
            align: 'center',
          },
        },
        {
          element: '[data-tour="resumes"]',
          popover: {
            title: 'AI Resume Builder',
            description:
              'Start here to generate a tailored, ATS-friendly resume that gets past applicant tracking systems.',
            side: 'right',
            align: 'start',
          },
        },
        {
          element: '[data-tour="resumes"]',
          popover: {
            title: 'ATS Score Checker',
            description:
              'Upload your existing resume here to check its ATS compatibility score and get actionable improvement suggestions.',
            side: 'right',
            align: 'start',
          },
        },
        {
          element: '[data-tour="find-jobs"]',
          popover: {
            title: 'Job Match Scraper',
            description:
              'Find live job listings perfectly matched to your skills. Our scraper aggregates opportunities from multiple sources.',
            side: 'right',
            align: 'start',
          },
        },
        {
          element: '[data-tour="upgrade"]',
          popover: {
            title: 'Pro Upgrade',
            description:
              'Unlock unlimited features and priority support here. Upgrade to access advanced analytics and premium job listings.',
            side: 'right',
            align: 'start',
          },
        },
      ],
      onDestroyStarted: async () => {
        setIsActive(false);
        await markComplete();
        driverRef.current?.destroy();
      },
      onPopoverRender: (popover) => {
        // Add custom styling to match platform theme
        const popoverElement = popover.wrapper;
        popoverElement.style.borderRadius = '12px';
        popoverElement.style.boxShadow =
          '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
      },
    }),
    [markComplete],
  );

  const startTour = React.useCallback(() => {
    if (!driverRef.current) {
      driverRef.current = driver(driverConfig);
    }
    setIsActive(true);
    driverRef.current.drive();
  }, [driverConfig]);

  const stopTour = React.useCallback(() => {
    setIsActive(false);
    driverRef.current?.destroy();
    driverRef.current = null;
  }, []);

  // Auto-trigger tour for first-time users
  React.useEffect(() => {
    if (user && user.hasCompletedOnboarding === false && !isActive) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startTour();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [user, isActive, startTour]);

  const value = React.useMemo(
    () => ({
      startTour,
      stopTour,
      isActive,
    }),
    [startTour, stopTour, isActive],
  );

  return <OnboardingTourContext.Provider value={value}>{children}</OnboardingTourContext.Provider>;
}

export function useOnboardingTour() {
  const context = React.useContext(OnboardingTourContext);
  if (!context) {
    throw new Error('useOnboardingTour must be used within OnboardingTourProvider');
  }
  return context;
}
