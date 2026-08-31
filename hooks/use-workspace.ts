'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Workspace } from '@/lib/domain';
import { DomainError } from '@/lib/domain';
import { createSample } from '@/lib/sample';
import { registerRunlineTools } from '@/lib/webmcp';
import type { ModelContext } from '@/lib/webmcp';

export function useWorkspace() {
  const [state, setState] = useState<Workspace>(createSample);
  const stateRef = useRef(state),
    busyRef = useRef(false);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [toolStatus, setToolStatus] = useState<
    'checking' | 'ready' | 'unavailable' | 'error'
  >('checking');
  const [calls, setCalls] = useState<
    { name: string; ok: boolean; time: string }[]
  >([]);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const apply = useCallback((next: Workspace) => {
    if (next.version >= stateRef.current.version) {
      stateRef.current = next;
      setState(next);
    }
    setReady(true);
    return next;
  }, []);
  const refresh = useCallback(async () => {
    const response = await fetch('/api/workspace', { cache: 'no-store' });
    const body = (await response.json()) as Workspace & {
      code?: string;
      error?: string;
    };
    if (!response.ok)
      throw new DomainError(
        body.code ?? 'LOAD_FAILED',
        body.error ?? 'Unable to load the workspace.',
      );
    return apply(body);
  }, [apply]);
  const dispatch = useCallback(
    async (input: Record<string, unknown>, expectedVersion?: number) => {
      if (busyRef.current)
        throw new DomainError(
          'BUSY',
          'Another change is being saved. Try again in a moment.',
        );
      busyRef.current = true;
      setBusy(true);
      setError('');
      try {
        const response = await fetch('/api/workspace', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Runline-Action': '1',
          },
          body: JSON.stringify({
            ...input,
            version: expectedVersion ?? stateRef.current.version,
          }),
        });
        const body = (await response.json()) as Workspace & {
          code?: string;
          error?: string;
        };
        if (!response.ok) {
          if (response.status === 409) await refresh();
          throw new DomainError(
            body.code ?? 'SAVE_FAILED',
            body.error ?? 'Your change could not be saved.',
          );
        }
        return apply(body);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : 'Unable to save. Please try again.',
        );
        throw error;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [apply, refresh],
  );
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await refresh();
      } catch (error) {
        if (!active) return;
        if (error instanceof DomainError && error.code === 'NO_WORKSPACE') {
          try {
            await dispatch({ action: 'create' });
          } catch {
            /* dispatch displays the error */
          }
        } else
          setError(
            error instanceof Error
              ? error.message
              : 'Unable to connect to workspace storage.',
          );
      }
    })();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !busyRef.current)
        refresh().catch(() => {});
    }, 8000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [dispatch, refresh]);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    let cleanup: (() => Promise<void>) | undefined;
    const context =
      (document as Document & { modelContext?: ModelContext }).modelContext ??
      (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
    if (typeof context?.registerTool !== 'function') {
      queueMicrotask(() => {
        if (active) setToolStatus('unavailable');
      });
      return () => {
        active = false;
      };
    }
    registerRunlineTools(
      context,
      { read: refresh, dispatch, review: setReviewId },
      (name, ok) => {
        if (active)
          setCalls((c) =>
            [{ name, ok, time: new Date().toISOString() }, ...c].slice(0, 12),
          );
      },
    )
      .then((dispose) => {
        cleanup = dispose;
        if (active) setToolStatus('ready');
        else void dispose();
      })
      .catch(() => {
        if (active) setToolStatus('error');
      });
    return () => {
      active = false;
      void cleanup?.();
    };
  }, [ready, refresh, dispatch]);
  return {
    state,
    ready,
    busy,
    error,
    setError,
    dispatch,
    refresh,
    toolStatus,
    calls,
    reviewId,
    setReviewId,
  };
}
