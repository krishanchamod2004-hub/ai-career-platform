'use client';

import * as React from 'react';
import { ExternalLink, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import {
  AI_KEY_PREFIXES,
  AI_PROVIDER_KEY_URLS,
  AI_PROVIDER_LABELS,
  AiProvider,
  DEFAULT_AI_MODELS,
  getModelOptions,
} from '@ai-career/shared';
import { Button } from '@/components/ui/button';
import { CheckboxField } from '@/components/ui/checkbox-field';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useAiKeyStore } from '@/stores/ai-key-store';

export interface ApiKeyDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after the key is stored, so a caller can resume the action it blocked. */
  onSaved?: () => void;
  /** Explains why the dialog opened (e.g. a rejected key). */
  notice?: string | null;
}

/**
 * Collects the user's own provider key.
 *
 * Two properties the copy makes explicit, because users are right to be wary of
 * pasting a key into a web app:
 * - the key is sent with the evaluate request and never stored server-side;
 * - "remember" means sessionStorage, so closing the tab discards it.
 */
export function ApiKeyDialog({ open, onClose, onSaved, notice }: ApiKeyDialogProps) {
  const storedProvider = useAiKeyStore((state) => state.provider);
  const storedModel = useAiKeyStore((state) => state.model);
  const storedRemember = useAiKeyStore((state) => state.remember);
  const hasStoredKey = useAiKeyStore((state) => Boolean(state.apiKey));
  const setCredentials = useAiKeyStore((state) => state.setCredentials);
  const clearKey = useAiKeyStore((state) => state.clear);

  const [provider, setProvider] = React.useState<AiProvider>(storedProvider);
  const [model, setModel] = React.useState(storedModel);
  const [apiKey, setApiKey] = React.useState('');
  const [remember, setRemember] = React.useState(storedRemember);
  const [revealed, setRevealed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Re-sync when the dialog is reopened: the key input always starts empty so a
  // stored credential is never rendered back into the DOM.
  React.useEffect(() => {
    if (open) {
      setProvider(storedProvider);
      setModel(storedModel);
      setApiKey('');
      setRemember(storedRemember);
      setRevealed(false);
      setError(null);
    }
  }, [open, storedProvider, storedModel, storedRemember]);

  const modelOptions = getModelOptions(provider);

  const handleProviderChange = (next: AiProvider) => {
    setProvider(next);
    setModel(DEFAULT_AI_MODELS[next]);
    setError(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = apiKey.trim();

    if (trimmed.length < 20) {
      setError('That key looks too short. Paste the full key from your provider dashboard.');
      return;
    }
    if (!trimmed.startsWith(AI_KEY_PREFIXES[provider])) {
      setError(
        `${AI_PROVIDER_LABELS[provider]} keys start with "${AI_KEY_PREFIXES[provider]}". Check the provider selection.`,
      );
      return;
    }

    setCredentials({ provider, apiKey: trimmed, model, remember });
    setApiKey('');
    onSaved?.();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Your AI provider key"
      description="Evaluations run on your own Anthropic or OpenAI account, so you control the model and the spend."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {notice ? (
          <p
            role="alert"
            className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400"
          >
            {notice}
          </p>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="ai-provider">Provider</Label>
          <Select
            id="ai-provider"
            value={provider}
            onChange={(event) => handleProviderChange(event.target.value as AiProvider)}
          >
            {Object.values(AiProvider).map((option) => (
              <option key={option} value={option}>
                {AI_PROVIDER_LABELS[option]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ai-model">Model</Label>
          <Select id="ai-model" value={model} onChange={(event) => setModel(event.target.value)}>
            {modelOptions.map((option) => (
              <option key={option.model} value={option.model}>
                {option.label}
                {option.hint ? ` — ${option.hint}` : ''}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Cheaper models grade noticeably faster; the rubric is the same either way.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ai-api-key">API key</Label>
          <div className="flex gap-2">
            <Input
              id="ai-api-key"
              type={revealed ? 'text' : 'password'}
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
                setError(null);
              }}
              placeholder={`${AI_KEY_PREFIXES[provider]}…`}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'ai-api-key-error' : 'ai-api-key-hint'}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setRevealed((value) => !value)}
              aria-label={revealed ? 'Hide API key' : 'Show API key'}
            >
              {revealed ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </div>

          {error ? (
            <p id="ai-api-key-error" role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : (
            <p id="ai-api-key-hint" className="text-xs text-muted-foreground">
              <a
                href={AI_PROVIDER_KEY_URLS[provider]}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-primary underline"
              >
                Create a key in the {AI_PROVIDER_LABELS[provider]} console
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </p>
          )}
        </div>

        <CheckboxField
          label="Remember for this browser session"
          hint="Stored in sessionStorage and cleared when you close the tab. Leave unchecked to keep it in memory for this page only."
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />

        <p className="flex gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
          <span>
            Your key is sent with each evaluation request and forwarded straight to the provider. It
            is never written to our database and never appears in logs — only the vendor name and
            model id are recorded, so you can audit what produced a grade.
          </span>
        </p>

        <div className="flex justify-end gap-2 pt-1">
          {hasStoredKey ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                clearKey();
                onClose();
              }}
            >
              Forget stored key
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            <KeyRound className="mr-1 h-4 w-4" aria-hidden="true" />
            Save key
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
