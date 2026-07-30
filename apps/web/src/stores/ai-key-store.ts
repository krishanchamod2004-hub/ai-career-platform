import { create } from 'zustand';
import { AiProvider, DEFAULT_AI_MODELS, type AiCredentials } from '@ai-career/shared';

/**
 * sessionStorage, never localStorage: the key is cleared when the tab closes.
 * Persistence is opt-in per user ("remember for this session"); the default keeps
 * the key in memory only, so a page refresh discards it.
 */
const STORAGE_KEY = 'ai-career:ai-credentials';

interface PersistedCredentials {
  provider: AiProvider;
  model: string;
  apiKey: string;
}

interface AiKeyState {
  provider: AiProvider;
  model: string;
  /** Null means "no key this session" — the UI prompts for one. */
  apiKey: string | null;
  /** Whether the key is mirrored into sessionStorage. */
  remember: boolean;
  /** False until `hydrate()` has run, so SSR and the client agree on first paint. */
  isHydrated: boolean;

  setCredentials: (credentials: AiCredentials & { remember?: boolean }) => void;
  setProvider: (provider: AiProvider) => void;
  setModel: (model: string) => void;
  clear: () => void;
  hydrate: () => void;
}

function readSession(): PersistedCredentials | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<PersistedCredentials>;
    if (
      typeof parsed.apiKey !== 'string' ||
      !parsed.provider ||
      !Object.values(AiProvider).includes(parsed.provider)
    ) {
      return null;
    }
    return {
      provider: parsed.provider,
      model: parsed.model || DEFAULT_AI_MODELS[parsed.provider],
      apiKey: parsed.apiKey,
    };
  } catch {
    return null;
  }
}

function writeSession(credentials: PersistedCredentials | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (credentials) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Private-browsing quota errors must not break the evaluate flow; the key
    // simply stays in memory for this page view.
  }
}

/**
 * Holds the user's own LLM credentials for the current session.
 *
 * The platform never sees a stored key: it is attached to outbound evaluate
 * requests as a header and the API forwards it without persisting it.
 */
export const useAiKeyStore = create<AiKeyState>((set, get) => ({
  provider: AiProvider.ANTHROPIC,
  model: DEFAULT_AI_MODELS[AiProvider.ANTHROPIC],
  apiKey: null,
  remember: false,
  isHydrated: false,

  setCredentials: ({ provider, apiKey, model, remember = false }) => {
    const resolvedModel = model?.trim() || DEFAULT_AI_MODELS[provider];
    set({ provider, model: resolvedModel, apiKey, remember });
    writeSession(remember ? { provider, model: resolvedModel, apiKey } : null);
  },

  setProvider: (provider) => {
    // Switching vendor invalidates both the key and the model selection.
    set({ provider, model: DEFAULT_AI_MODELS[provider], apiKey: null, remember: false });
    writeSession(null);
  },

  setModel: (model) => {
    const { provider, apiKey, remember } = get();
    set({ model });
    if (remember && apiKey) {
      writeSession({ provider, model, apiKey });
    }
  },

  clear: () => {
    set({ apiKey: null, remember: false });
    writeSession(null);
  },

  hydrate: () => {
    if (get().isHydrated) {
      return;
    }
    const stored = readSession();
    set(
      stored
        ? { ...stored, remember: true, isHydrated: true }
        : { isHydrated: true },
    );
  },
}));

/** Credentials in the shape the evaluate request expects, or null when unset. */
export function selectAiCredentials(state: AiKeyState): AiCredentials | null {
  return state.apiKey
    ? { provider: state.provider, apiKey: state.apiKey, model: state.model }
    : null;
}
