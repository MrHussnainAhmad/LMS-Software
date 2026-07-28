import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

/* Small shared page furniture. Kept as components so every screen inherits
   the same rhythm without each view re-inventing its own header markup. */

export function PageHead({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {children && <div className="page-tools">{children}</div>}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark" aria-hidden="true">
        {icon}
      </span>
      <h3 className="empty-title">{title}</h3>
      {text && <p className="empty-text">{text}</p>}
      {action && <div className="empty-cta">{action}</div>}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="alert alert-bad" role="alert">
      <AlertTriangle aria-hidden="true" />
      <div>{message}</div>
    </div>
  );
}

export function Stat({
  label,
  value,
  icon,
  foot,
  tone = 'brand',
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  foot?: ReactNode;
  tone?: 'brand' | 'accent' | 'ok' | 'info';
}) {
  return (
    <article className={`metric metric-${tone}`}>
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        {icon && (
          <span className="metric-icon" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <strong className="metric-value">{value}</strong>
      {foot && <div className="metric-foot">{foot}</div>}
    </article>
  );
}
