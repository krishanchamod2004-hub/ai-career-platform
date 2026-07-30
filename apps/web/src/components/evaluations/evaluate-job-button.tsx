'use client';

import * as React from 'react';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { ApiKeyDialog } from '@/components/evaluations/api-key-dialog';
import {
  getAiErrorCode,
  getApiErrorMessage,
  useEvaluateJob,
  useHydrateAiKey,
} from '@/hooks/use-evaluations';
import { useAiKeyStore } from '@/stores/ai-key-store';

export interface EvaluateJobButtonProps {
  jobId: string;
  /** True when a stored evaluation exists — switches the label to "Re-evaluate". */
  hasEvaluation?: boolean;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  /** Render the error inline (detail pages) rather than only as a tooltip. */
  showError?: boolean;
}

/**
 * Runs an evaluation, prompting for a key first when the session has none.
 *
 * The key prompt is deliberately inline rather than a separate settings page: the
 * user is asked for a credential at the moment they ask for the feature, and the
 * evaluation resumes automatically once they provide it.
 */
export function EvaluateJobButton({
  jobId,
  hasEvaluation,
  variant = 'secondary',
  size,
  className,
  showError = true,
}: EvaluateJobButtonProps) {
  useHydrateAiKey();
  const hasKey = useAiKeyStore((state) => Boolean(state.apiKey));
  const evaluate = useEvaluateJob();

  const [isKeyDialogOpen, setIsKeyDialogOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  // Set when the user is asked for a key mid-action, so the run resumes on save.
  const pendingRunRef = React.useRef(false);

  const run = React.useCallback(() => {
    evaluate.mutate(
      { jobId, force: hasEvaluation },
      {
        onError: (error) => {
          if (getAiErrorCode(error) === 'AI_KEY_REJECTED') {
            setNotice(getApiErrorMessage(error, 'Your provider rejected that key.'));
            setIsKeyDialogOpen(true);
          }
        },
      },
    );
  }, [evaluate, jobId, hasEvaluation]);

  const handleClick = () => {
    if (!hasKey) {
      pendingRunRef.current = true;
      setNotice(null);
      setIsKeyDialogOpen(true);
      return;
    }
    run();
  };

  const handleKeySaved = () => {
    if (pendingRunRef.current) {
      pendingRunRef.current = false;
      run();
    }
  };

  const errorMessage =
    showError && evaluate.isError
      ? getApiErrorMessage(evaluate.error, 'Could not evaluate this job.')
      : null;

  return (
    <>
      <div className={className}>
        <Button
          type="button"
          variant={variant}
          size={size}
          onClick={handleClick}
          disabled={evaluate.isPending}
          className="w-full"
        >
          {evaluate.isPending ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
              Evaluating…
            </>
          ) : hasEvaluation ? (
            <>
              <RefreshCw className="mr-1 h-4 w-4" aria-hidden="true" />
              Re-evaluate
            </>
          ) : (
            <>
              <Sparkles className="mr-1 h-4 w-4" aria-hidden="true" />
              Evaluate with AI
            </>
          )}
        </Button>

        {errorMessage ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {errorMessage}
          </p>
        ) : null}
      </div>

      <ApiKeyDialog
        open={isKeyDialogOpen}
        notice={notice}
        onClose={() => {
          pendingRunRef.current = false;
          setIsKeyDialogOpen(false);
        }}
        onSaved={handleKeySaved}
      />
    </>
  );
}
