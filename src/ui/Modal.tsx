import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  footer?: ReactNode;
  /** Wraps the body + footer in a <form> so Enter submits, like a native dialog. */
  onSubmit?: (event: React.FormEvent) => void;
  scrollBody?: boolean;
};

const SIZE_CLASS = { sm: '', md: 'modal-md', lg: 'modal-lg' } as const;

export default function Modal({
  open,
  onClose,
  title,
  description,
  size = 'sm',
  children,
  footer,
  onSubmit,
  scrollBody = true,
}: ModalProps) {
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    const focusable = surface.current?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), select, textarea, button:not(.modal-close)',
    );
    focusable?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const body = (
    <>
      <div className={scrollBody ? 'modal-body modal-scroll' : 'modal-body'}>{children}</div>
      {footer && <div className="modal-foot">{footer}</div>}
    </>
  );

  return createPortal(
    <div
      className="overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={surface}
        className={`modal ${SIZE_CLASS[size]}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h2 className="modal-title">{title}</h2>
          {description && <p className="modal-sub">{description}</p>}
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            <X />
          </button>
        </div>
        {onSubmit ? <form onSubmit={onSubmit}>{body}</form> : body}
      </div>
    </div>,
    document.body,
  );
}
