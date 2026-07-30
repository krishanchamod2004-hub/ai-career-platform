# Onboarding Product Tour - Implementation Guide

This document describes the professional onboarding tour system for the AI Career Platform, built with driver.js.

## Overview

The onboarding tour is a **5-step interactive walkthrough** that automatically triggers for first-time users after they sign in. It guides them through key platform features with a modern, SaaS-grade aesthetic.

### Key Features

- **Auto-trigger**: Launches automatically for users who haven't completed it (`hasCompletedOnboarding: false`)
- **Cross-device persistence**: Tour completion is tracked in the database via backend API
- **Theme-aware**: Custom styling matches the platform's dark/light mode design system
- **NO emojis**: Professional, clean aesthetic throughout all tour content
- **Dismissible**: Users can skip or close the tour at any time
- **Progress tracking**: Shows step count (e.g., "1 of 5")

## Architecture

### Database Layer
**Model**: `User` (apps/api/prisma/schema.prisma)
```prisma
model User {
  // ...existing fields
  hasCompletedOnboarding Boolean @default(false) @map("has_completed_onboarding")
}
```

**Migration**: `20260730223802_add_onboarding_tracking`
- Adds `has_completed_onboarding` column to `users` table
- Default value: `false`

### Backend API
**Endpoint**: `PATCH /api/users/onboarding-complete`
- **Authentication**: Requires Bearer token
- **Authorization**: Marks the authenticated user's onboarding as complete
- **Response**: `{ "message": "Onboarding marked as complete" }`

**Implementation**:
- `UsersController.markOnboardingComplete()` - HTTP endpoint
- `UsersService.markOnboardingComplete(userId)` - Database update

### Frontend Components

#### 1. OnboardingTourProvider Context
**Location**: `apps/web/src/contexts/onboarding-tour-context.tsx`

**Responsibilities**:
- Initializes driver.js with tour configuration
- Auto-triggers tour for first-time users (checks `user.hasCompletedOnboarding`)
- Calls backend API on tour completion/dismissal
- Updates local auth state to prevent re-triggering

**Hook**: `useOnboardingTour()`
```typescript
const { startTour, stopTour, isActive } = useOnboardingTour();
```

#### 2. Tour Target Elements
**Location**: `apps/web/src/components/dashboard/dashboard-sidebar.tsx`

**Data attributes**:
- `data-tour="resumes"` - AI Resume Builder / ATS Score Checker
- `data-tour="find-jobs"` - Job Match Scraper
- `data-tour="upgrade"` - Pro Upgrade button

### Tour Steps Definition

The tour follows this logical flow:

| Step | Target | Title | Description |
|------|--------|-------|-------------|
| 1 | Center modal | Welcome to AI Career Platform | Let's take a quick tour to help you land your dream job. This will only take a minute. |
| 2 | `[data-tour="resumes"]` | AI Resume Builder | Start here to generate a tailored, ATS-friendly resume that gets past applicant tracking systems. |
| 3 | `[data-tour="resumes"]` | ATS Score Checker | Upload your existing resume here to check its ATS compatibility score and get actionable improvement suggestions. |
| 4 | `[data-tour="find-jobs"]` | Job Match Scraper | Find live job listings perfectly matched to your skills. Our scraper aggregates opportunities from multiple sources. |
| 5 | `[data-tour="upgrade"]` | Pro Upgrade | Unlock unlimited features and priority support here. Upgrade to access advanced analytics and premium job listings. |

**Note**: Steps 2 and 3 both target the same element (`resumes`) but provide different context. This is intentional to showcase multiple features accessible from one navigation item.

## Styling & Theming

### Custom CSS
**Location**: `apps/web/src/app/globals.css`

The tour uses custom CSS variables to match the platform's design tokens:

```css
.driver-popover {
  background: hsl(var(--popover));
  color: hsl(var(--popover-foreground));
  border: 1px solid hsl(var(--border));
  /* ... */
}
```

**Features**:
- Matches light/dark mode automatically via CSS variables
- Professional shadows and rounded corners (12px border-radius)
- Smooth transitions on all interactive elements
- Primary color scheme for "Next" button
- Muted colors for "Previous" and "Close" buttons

### Design Principles
1. **No emojis** - Strictly professional text throughout
2. **Minimalist** - Clean, uncluttered popovers
3. **Accessible** - High contrast, readable font sizes
4. **Consistent** - Matches existing platform button and card styles

## Integration Points

### 1. Dashboard Layout
**File**: `apps/web/src/app/(dashboard)/dashboard/layout.tsx`

```tsx
import { OnboardingTourProvider } from '@/contexts/onboarding-tour-context';

export default function DashboardLayout({ children }) {
  return (
    <RequireAuth>
      <OnboardingTourProvider>
        {/* Dashboard content */}
      </OnboardingTourProvider>
    </RequireAuth>
  );
}
```

### 2. Shared Types
**File**: `packages/shared/src/types/user.ts`

```typescript
export interface User {
  // ...existing fields
  hasCompletedOnboarding?: boolean;
}
```

### 3. Auth Service
**File**: `apps/api/src/modules/auth/auth.service.ts`

The `toSharedUser()` method includes `hasCompletedOnboarding` when transforming Prisma user objects to API responses.

### 4. Frontend API Service
**File**: `apps/web/src/services/users-api.ts`

```typescript
export const usersApi = {
  markOnboardingComplete: async (): Promise<MessageResponse> => {
    const { data } = await apiClient.patch('/users/onboarding-complete');
    return data;
  },
};
```

## User Flow

1. **User signs in** (first time or `hasCompletedOnboarding: false`)
2. **Dashboard loads** → OnboardingTourProvider mounts
3. **800ms delay** → Tour auto-triggers (gives DOM time to render)
4. **User progresses** through 5 steps:
   - Can click "Next" to advance
   - Can click "Previous" to go back
   - Can click "Close" (X) to dismiss at any time
5. **Tour completes** (reaches end or user dismisses)
6. **API call**: `PATCH /users/onboarding-complete`
7. **Local state update**: `user.hasCompletedOnboarding = true`
8. **Tour never shows again** (cross-device persistence via database)

## Configuration Options

### Auto-trigger Delay
**Location**: `onboarding-tour-context.tsx` (line ~139)

```typescript
const timer = setTimeout(() => {
  startTour();
}, 800); // Adjust delay in milliseconds
```

### Driver.js Options
**Location**: `onboarding-tour-context.tsx` (driverConfig)

```typescript
const driverConfig: Config = {
  showProgress: true,               // "1 of 5" progress indicator
  showButtons: ['next', 'previous', 'close'], // Available buttons
  steps: [...],                     // Tour step definitions
  onDestroyStarted: async () => {   // Called on completion/dismiss
    await markComplete();
  },
};
```

**Customization examples**:
- Remove "Previous" button: `showButtons: ['next', 'close']`
- Disable progress: `showProgress: false`
- Change button labels: Add `nextBtnText`, `prevBtnText`, `doneBtnText`

### Adding New Steps

1. **Add tour target** to the UI element:
   ```tsx
   <Link href="/new-feature" data-tour="new-feature">
     New Feature
   </Link>
   ```

2. **Add step definition** in `onboarding-tour-context.tsx`:
   ```typescript
   {
     element: '[data-tour="new-feature"]',
     popover: {
       title: 'New Feature',
       description: 'Description of what this feature does.',
       side: 'right',
       align: 'start',
     },
   }
   ```

3. **Update step count** in documentation if necessary

## Testing

### Manual Testing Flow

1. **Reset onboarding status** for test user:
   ```sql
   UPDATE users SET has_completed_onboarding = false WHERE email = 'test@example.com';
   ```

2. **Log in** as that user

3. **Verify** tour auto-triggers after ~800ms

4. **Test progression**:
   - Click "Next" through all steps
   - Verify each element highlights correctly
   - Check popover positioning (should not clip off-screen)

5. **Test dismissal**:
   - Click "Close" (X) button mid-tour
   - Verify API call in Network tab: `PATCH /users/onboarding-complete`
   - Check database: `has_completed_onboarding` should be `true`

6. **Test persistence**:
   - Refresh page → Tour should NOT re-trigger
   - Log out and log back in → Tour should NOT re-trigger

### Edge Cases

- **Non-existent target**: If `data-tour` element doesn't exist, driver.js skips that step
- **Multiple tabs**: Tour can run in multiple tabs simultaneously (each makes its own API call)
- **Network failure**: If API call fails, tour still completes locally (user won't see it again this session, but it may re-trigger on next login)

## Troubleshooting

### Tour doesn't auto-trigger
**Check**:
1. User's `hasCompletedOnboarding` is `false` in database
2. `OnboardingTourProvider` is rendered (check React DevTools)
3. No console errors (driver.js failed to initialize)
4. DOM elements with `data-tour` attributes exist

### Tour highlights wrong element
**Solution**: Verify `data-tour` attribute matches step's `element` selector exactly.

### Popover clips off-screen
**Solution**: Change `side` or `align` properties in step definition:
```typescript
popover: {
  side: 'left',  // Options: top, bottom, left, right
  align: 'center', // Options: start, center, end
}
```

### Styling doesn't match theme
**Check**: CSS custom properties in `globals.css` match your Tailwind theme config.

### API call fails silently
**Debug**:
1. Open browser DevTools → Network tab
2. Filter for `onboarding-complete`
3. Check response status (401 = not authenticated, 404 = route not found, etc.)

## Performance Considerations

- **Bundle size**: driver.js adds ~20KB gzipped (acceptable for the value it provides)
- **DOM ready check**: 800ms delay ensures targets are rendered before tour starts
- **API call throttling**: Only one call per tour completion (not per step)
- **State management**: Tour state lives in context (no Redux/Zustand overhead)

## Future Enhancements

Potential improvements for later phases:

1. **Analytics**: Track step completion rates and drop-off points
2. **Conditional steps**: Show different steps based on user role or plan tier
3. **Multi-language**: Internationalize tour content
4. **Video tooltips**: Embed short demo videos in popovers
5. **Spotlight animations**: Add entrance/exit animations for highlighted elements
6. **Keyboard navigation**: Support arrow keys and Escape

## Files Modified

### Backend
- `apps/api/prisma/schema.prisma` - Added `hasCompletedOnboarding` field
- `apps/api/prisma/migrations/20260730223802_add_onboarding_tracking/migration.sql` - Database migration
- `apps/api/src/modules/users/users.controller.ts` - Added `PATCH /onboarding-complete` endpoint
- `apps/api/src/modules/users/users.service.ts` - Added `markOnboardingComplete()` method
- `apps/api/src/modules/auth/auth.service.ts` - Updated `toSharedUser()` to include new field

### Frontend
- `apps/web/src/contexts/onboarding-tour-context.tsx` - Main tour logic (NEW FILE)
- `apps/web/src/app/(dashboard)/dashboard/layout.tsx` - Integrated provider
- `apps/web/src/components/dashboard/dashboard-sidebar.tsx` - Added `data-tour` attributes
- `apps/web/src/app/globals.css` - Custom driver.js theme styles
- `apps/web/src/services/users-api.ts` - Added `markOnboardingComplete()` API call

### Shared
- `packages/shared/src/types/user.ts` - Added `hasCompletedOnboarding` to User interface

## Dependencies

**Added**: `driver.js@^1.8.0`

Driver.js is the most modern, lightweight product tour library with:
- Zero dependencies
- TypeScript support out of the box
- Excellent accessibility (keyboard navigation, ARIA labels)
- Framework-agnostic (works with any UI library)
- Active maintenance and regular updates

## Resources

- [driver.js Documentation](https://driverjs.com/)
- [driver.js GitHub](https://github.com/kamranahmedse/driver.js)
- [Interactive Demo](https://driverjs.com/docs/basic-example)

---

**Implementation Date**: July 30, 2026  
**Version**: 1.0.0  
**Status**: Production-ready
