'use client';

import * as React from 'react';
import Link from 'next/link';
import { FileSearch, Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { ApiKeyDialog } from '@/components/evaluations/api-key-dialog';
import { AtsScoreCard, AtsScoreCardSkeleton } from '@/components/resumes/ats-score-card';
import { getAiErrorCode, getApiErrorMessage } from '@/hooks/use-evaluations';
import { useAtsScore, useResumes, useRunAtsScore } from '@/hooks/use-resumes';
import { useAiKeyStore } from '@/stores/ai-key-store';

export interface CheckAtsScoreButtonProps {
  jobId: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
}

/**
 * "Check ATS Score" entry point for a job. Mirrors EvaluateJobButton's
 * key-prompt-on-demand flow, plus one extra step: picking which resume to
 * grade when the user has more than one (defaults to their default resume).
 */
export function CheckAtsScoreButton({ jobId, variant = 'secondary', size, className }: CheckAtsScoreButtonProps) {
  const { data: resumes } = useResumes();
  const [isResultOpen, setIsResultOpen] = React.useState(false);
  const [isKeyDialogOpen, setIsKeyDialogOpen] = React.useState(false);
  const [selectedResumeId, setSelectedResumeId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const pendingRunRef = React.useRef(false);

  const hasKey = useAiKeyStore((state) => Boolean(state.apiKey));
  const runAtsScore = useRunAtsScore();
  const activeResumeId = selectedResumeId ?? runAtsScore.data?.resumeId ?? null;
  const { data: storedScore } = useAtsScore(activeResumeId ?? undefined, jobId);
  const score = runAtsScore.data ?? storedScore;

  React.useEffect(() => {
    if (!selectedResumeId && resumes && resumes.length > 0) {
      setSelectedResumeId(resumes.find((resume) => resume.isDefault)?.id ?? resumes[0].id);
    }
  }, [resumes, selectedResumeId]);

  const run = React.useCallback(
    (resumeId: string) => {
      runAtsScore.mutate(
        { resumeId, jobId },
        {
          onError: (error) => {
            if (getAiErrorCode(error) === 'AI_KEY_REJECTED') {
              setNotice(getApiErrorMessage(error, 'Your provider rejected that key.'));
              setIsKeyDialogOpen(true);
            }
          },
        },
      );
    },
    [runAtsScore, jobId],
  );

  const handleClick = () => {
    setIsResultOpen(true);
    if (!selectedResumeId) {
      return; // No resumes yet — the dialog itself prompts to upload one.
    }
    if (!hasKey) {
      pendingRunRef.current = true;
      setNotice(null);
      setIsKeyDialogOpen(true);
      return;
    }
    if (!score) {
      run(selectedResumeId);
    }
  };

  const handleKeySaved = () => {
    if (pendingRunRef.current && selectedResumeId) {
      pendingRunRef.current = false;
      run(selectedResumeId);
    }
  };

  const errorMessage = runAtsScore.isError
    ? getApiErrorMessage(runAtsScore.error, 'Could not check your resume against this job.')
    : null;

  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} onClick={handleClick}>
        <FileSearch className="mr-1 h-4 w-4" aria-hidden="true" />
        Check ATS score
      </Button>

      <Dialog
        open={isResultOpen}
        onClose={() => setIsResultOpen(false)}
        title="ATS match score"
        description="How well your resume matches this job's requirements."
      >
        {!resumes || resumes.length === 0 ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              Upload a resume first to check it against this job.
            </p>
            <Button asChild>
              <Link href="/dashboard/resumes">Upload a resume</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {resumes.length > 1 ? (
              <Select
                value={selectedResumeId ?? undefined}
                onChange={(event) => {
                  setSelectedResumeId(event.target.value);
                  if (hasKey) {
                    run(event.target.value);
                  }
                }}
                aria-label="Resume to check"
              >
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.title}
                    {resume.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </Select>
            ) : null}

            {runAtsScore.isPending ? (
              <AtsScoreCardSkeleton />
            ) : score ? (
              <AtsScoreCard score={score} />
            ) : errorMessage ? (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage}
              </p>
            ) : (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
              </div>
            )}

            {score ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={runAtsScore.isPending || !selectedResumeId}
                onClick={() => selectedResumeId && run(selectedResumeId)}
              >
                {runAtsScore.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                Re-check
              </Button>
            ) : null}
          </div>
        )}
      </Dialog>

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
