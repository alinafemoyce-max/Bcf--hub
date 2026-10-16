import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clearState, emptyState, loadState, saveState, storageAvailable } from '../lib/storage';
import type { AppState, Profile, QuizAnswers } from '../lib/types';

interface Store {
  state: AppState;
  canSave: boolean;
  setProfile: (p: Profile | null) => void;
  toggleSaved: (slug: string) => boolean;
  togglePlanItem: (slug: string, id: string) => void;
  setQuiz: (q: QuizAnswers | null) => void;
  reset: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [canSave] = useState(storageAvailable);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    saveState(state);
  }, [state]);

  // Keep several open tabs in step.
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key === null || e.key === 'nextstep:v1') setState(loadState());
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);

  const setProfile = useCallback((profile: Profile | null) => setState((s) => ({ ...s, profile })), []);
  const toggleSaved = useCallback((slug: string) => {
    let added = false;
    setState((s) => {
      added = !s.saved.includes(slug);
      return { ...s, saved: added ? [...s.saved, slug] : s.saved.filter((x) => x !== slug) };
    });
    return added;
  }, []);
  const togglePlanItem = useCallback(
    (slug: string, id: string) =>
      setState((s) => {
        const cur = new Set(s.plans[slug] ?? []);
        if (cur.has(id)) cur.delete(id);
        else cur.add(id);
        return { ...s, plans: { ...s.plans, [slug]: [...cur] } };
      }),
    []
  );
  const setQuiz = useCallback((quiz: QuizAnswers | null) => setState((s) => ({ ...s, quiz })), []);
  const reset = useCallback(() => {
    clearState();
    setState(emptyState());
  }, []);

  const value = useMemo(() => ({ state, canSave, setProfile, toggleSaved, togglePlanItem, setQuiz, reset }), [state, canSave, setProfile, toggleSaved, togglePlanItem, setQuiz, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
