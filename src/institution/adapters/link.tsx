import type { AnchorHTMLAttributes } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { API_ORIGIN } from '../../utils/api';
export function desktopPath(href: string) {
  return href.replace(/^\/institution\/website-events/, '/public-events').replace(/^\/institution\/settings\/public-website/, '/settings/public-website').replace(/^\/institution\/students\/promotion/, '/promotion').replace(/^\/institution\/staff-attendance/, '/attendance').replace(/^\/institution\/staff-leaves/, '/leaves').replace(/^\/institution\/admins/, '/admin').replace(/^\/institution/, '');
}
export default function Link({ href = '', prefetch: _prefetch, scroll: _scroll, ...props }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string; prefetch?: boolean; scroll?: boolean }) {
  if (href.startsWith('/institution/')) return <RouterLink {...props} to={desktopPath(href)} />;
  return <a {...props} href={href.startsWith('/') ? `${API_ORIGIN}${href}` : href} target="_blank" rel="noopener noreferrer" />;
}
