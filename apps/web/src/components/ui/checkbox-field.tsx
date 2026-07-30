import * as React from 'react';
import { cn } from '@/lib/utils';

/** Accessible checkbox row: the whole label is clickable and focus is visible. */
export interface CheckboxFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
  hint?: React.ReactNode;
}

export const CheckboxField = React.forwardRef<HTMLInputElement, CheckboxFieldProps>(
  ({ className, label, hint, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className={cn('flex items-start gap-2', className)}>
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-input text-primary accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...props}
        />
        <label htmlFor={inputId} className="cursor-pointer select-none text-sm leading-tight">
          {label}
          {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
        </label>
      </div>
    );
  },
);
CheckboxField.displayName = 'CheckboxField';
