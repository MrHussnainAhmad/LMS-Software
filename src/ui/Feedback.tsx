import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

/* ------------------------------------------------------------------ *
 * Toasts + confirm dialog.
 * One provider so any view can report an outcome without alert().
 * ------------------------------------------------------------------ */

type Tone = 'ok' | 'bad' | 'warn' | 'info';

type Toast = {
  id: number;
  tone: Tone;
  title: string;
  detail?: string;
};

type ConfirmRequest = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
};

type ToastApi = {
  push: (tone: Tone, title: string, detail?: string) => void;
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  warn: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);
const ConfirmContext = createContext<((req: ConfirmRequest) => Promise<boolean>) | null>(null);

const TONE_ICON: Record<Tone, ReactNode> = {
  ok: <CheckCircle2 />,
  bad: <XCircle />,
  warn: <AlertTriangle />,
  info: <Info />,
};

const LIFETIME: Record<Tone, number> = { ok: 3600, info: 4200, warn: 6000, bad: 7000 };

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<ConfirmRequest | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const seq = useRef(0);
  const timers = useRef<Map<number, number>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      window.clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (tone: Tone, title: string, detail?: string) => {
      seq.current += 1;
      const id = seq.current;
      setToasts((list) => [...list.slice(-3), { id, tone, title, detail }]);
      const handle = window.setTimeout(() => dismiss(id), LIFETIME[tone]);
      timers.current.set(id, handle);
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((handle) => window.clearTimeout(handle));
      map.clear();
    };
  }, []);

  const toastApi = useMemo<ToastApi>(
    () => ({
      push,
      success: (title, detail) => push('ok', title, detail),
      error: (title, detail) => push('bad', title, detail),
      warn: (title, detail) => push('warn', title, detail),
      info: (title, detail) => push('info', title, detail),
    }),
    [push],
  );

  const confirm = useCallback((req: ConfirmRequest) => {
    setPending(req);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    setPending(null);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    if (resolve) resolve(value);
  }, []);

  useEffect(() => {
    if (!pending) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') settle(false);
      if (event.key === 'Enter') settle(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, settle]);

  return (
    <ToastContext.Provider value={toastApi}>
      <ConfirmContext.Provider value={confirm}>
        {children}

        {toasts.length > 0 &&
          createPortal(
            <div className="toast-stack" aria-live="polite" role="status">
              {toasts.map((t) => (
                <div key={t.id} className={`toast toast-${t.tone}`}>
                  <span className="toast-icon" aria-hidden="true">
                    {TONE_ICON[t.tone]}
                  </span>
                  <div className="toast-copy">
                    <b>{t.title}</b>
                    {t.detail && <span>{t.detail}</span>}
                  </div>
                  <button
                    type="button"
                    className="toast-close"
                    aria-label="Dismiss notification"
                    onClick={() => dismiss(t.id)}
                  >
                    <X />
                  </button>
                </div>
              ))}
            </div>,
            document.body,
          )}

        {pending &&
          createPortal(
            <div
              className="overlay"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) settle(false);
              }}
            >
              <div className="modal" role="alertdialog" aria-labelledby="confirm-title">
                <div className="modal-head">
                  <h2 className="modal-title" id="confirm-title">
                    {pending.title}
                  </h2>
                  {pending.body && <p className="modal-sub">{pending.body}</p>}
                </div>
                <div className="modal-foot">
                  <button type="button" className="btn btn-ghost" onClick={() => settle(false)}>
                    {pending.cancelLabel || 'Cancel'}
                  </button>
                  <button
                    type="button"
                    autoFocus
                    className={`btn ${pending.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                    onClick={() => settle(true)}
                  >
                    {pending.confirmLabel || 'Confirm'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside FeedbackProvider');
  return ctx;
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside FeedbackProvider');
  return ctx;
}
