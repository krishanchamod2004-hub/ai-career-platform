'use client';

import * as React from 'react';
import { FileText, Loader2, Star, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useEntitlements } from '@/hooks/use-account';
import { getApiErrorMessage } from '@/hooks/use-evaluations';
import {
  useDeleteResume,
  useDownloadResume,
  useResumes,
  useUpdateResume,
  useUploadResume,
} from '@/hooks/use-resumes';
import { formatRelativeTime } from '@/lib/format';

export default function ResumesPage() {
  const { data: resumes, isLoading } = useResumes();
  const { data: entitlements } = useEntitlements();
  const upload = useUploadResume();
  const update = useUpdateResume();
  const remove = useDeleteResume();
  const download = useDownloadResume();

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const maxResumes = entitlements?.limits.maxResumes ?? null;
  const usedResumes = entitlements?.usage.resumes ?? resumes?.length ?? 0;
  const atLimit = maxResumes !== null && usedResumes >= maxResumes;

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    setUploadError(null);
    upload.mutate(
      { file },
      {
        onError: (error) => setUploadError(getApiErrorMessage(error, 'Could not upload this resume.')),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FileText className="h-6 w-6 text-primary" aria-hidden="true" />
            Resumes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload resumes and check them against any job&apos;s ATS match score.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {maxResumes !== null ? `${usedResumes} / ${maxResumes} used` : `${usedResumes} uploaded`}
        </div>
      </header>

      <Card className="glass-card">
        <CardContent className="p-5">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={handleFileSelected}
            aria-label="Upload resume PDF"
          />
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Upload className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium">Upload a resume</p>
              <p className="text-sm text-muted-foreground">PDF only, up to 10MB</p>
            </div>
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={upload.isPending || atLimit}
            >
              {upload.isPending ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                  Uploading…
                </>
              ) : (
                'Choose file'
              )}
            </Button>
            {atLimit ? (
              <p className="text-xs text-muted-foreground">
                You&apos;ve reached your plan&apos;s resume limit ({maxResumes}). Upgrade for more.
              </p>
            ) : null}
            {uploadError ? (
              <p role="alert" className="text-xs text-destructive">
                {uploadError}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((key) => (
            <Card key={key} className="glass-card">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !resumes || resumes.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No resumes yet. Upload one to start checking ATS scores against jobs.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {resumes.map((resume) => (
            <Card key={resume.id} className="glass-card">
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{resume.title}</p>
                    {resume.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <Star className="h-3 w-3" aria-hidden="true" />
                        Default
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Uploaded {formatRelativeTime(resume.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!resume.isDefault ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ id: resume.id, isDefault: true })}
                    >
                      Set default
                    </Button>
                  ) : null}
                  {resume.fileUrl ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={download.isPending}
                      onClick={() => download.mutate({ id: resume.id, filename: resume.title })}
                    >
                      Download
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${resume.title}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(resume.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
