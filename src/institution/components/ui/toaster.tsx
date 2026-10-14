import { useMemo, useEffect } from 'react';
import { useToast as useDesktopToast } from '../../../ui/Feedback';
type ToastMessage = { title: string; description?: string; variant?: string };
export const toast = (message: ToastMessage) => window.dispatchEvent(new CustomEvent('institution:toast', { detail: message }));
export function ToastBridge() {
  const { toast: show } = useToast();
  useEffect(() => {
    const listener = (event: Event) => show((event as CustomEvent<ToastMessage>).detail);
    window.addEventListener('institution:toast', listener);
    return () => window.removeEventListener('institution:toast', listener);
  }, [show]);
  return null;
}
export function useToast() {
  const desktop = useDesktopToast();
  return useMemo(() => ({ toast: ({ title, description, variant }: { title: string; description?: string; variant?: string }) => {
    if (variant === 'destructive') desktop.error(title, description);
    else desktop.success(title, description);
  } }), [desktop]);
}
