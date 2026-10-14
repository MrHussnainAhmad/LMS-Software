import { useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams as useParams } from 'react-router-dom';
import { desktopPath } from './link';
export const useSearchParams = () => useParams()[0];
export const usePathname = () => useLocation().pathname;
export function useRouter() {
  const navigate = useNavigate();
  return useMemo(() => ({ push: (path: string) => navigate(desktopPath(path)), replace: (path: string) => navigate(desktopPath(path), { replace: true }), refresh: () => window.dispatchEvent(new Event('institution:refresh')), back: () => navigate(-1) }), [navigate]);
}
