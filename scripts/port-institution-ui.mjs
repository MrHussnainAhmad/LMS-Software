import fs from 'node:fs';
import path from 'node:path';

// Keep the complex editors aligned with the server while compiling them locally
// in the desktop renderer. Runtime/server dependencies are replaced by adapters.
const source = path.resolve('../lms-backend/src');
const target = path.resolve('src/institution');
const roots = [
  'app/(institution)/institution/fees/FeesManager.tsx',
  'app/(institution)/institution/admissions/AdmissionsManager.tsx',
  'app/(institution)/institution/admissions/ApplicationsReviewPanel.tsx',
  'app/(institution)/institution/settings/PublicWebsiteEditor.tsx',
  'app/(institution)/institution/website-events/WebsiteEventsManager.tsx',
  'app/(institution)/institution/settings/GoogleDriveBackupSettings.tsx',
  'app/(institution)/institution/staff-attendance/StaffAttendanceClient.tsx',
  'components/PaymentAccountsSettings.tsx',
  'app/(institution)/institution/staff/[id]/performance/TeacherPerformancePanels.tsx',
  'app/(institution)/institution/students/promotion/[id]/PromotionReviewActions.tsx',
];
const adapters = new Set(['lib/api-client.ts', 'components/ui/toaster.tsx', 'lib/institution-tenant.ts', 'lib/institution-restore-engine.ts']);
const seen = new Set();
const external = new Set();
function resolve(base) {
  return ['', '.ts', '.tsx', '.module.css', '/index.ts', '/index.tsx'].map(ext => base + ext).find(file => fs.existsSync(file) && fs.statSync(file).isFile());
}
function visit(relative) {
  relative = relative.replaceAll('\\', '/');
  if (seen.has(relative) || adapters.has(relative)) return;
  seen.add(relative);
  let text = fs.readFileSync(path.join(source, relative), 'utf8');
  if (/['"]use server['"]|from ['"](?:@\/db|server-only|node:)/.test(text)) throw new Error(`Server dependency: ${relative}`);
  const imports = [...text.matchAll(/(?:from\s*|import\s*\(|import\s*)(['"])([^'"]+)\1/g)];
  for (const [, , spec] of imports) {
    if (spec.startsWith('@/') || spec.startsWith('.')) {
      const file = resolve(spec.startsWith('@/') ? path.join(source, spec.slice(2)) : path.resolve(source, path.dirname(relative), spec));
      if (!file) throw new Error(`Missing ${spec} in ${relative}`);
      visit(path.relative(source, file));
    } else external.add(spec);
  }
  // Client fetch calls use the desktop transport, including multipart uploads
  // and authenticated file downloads. External CDN requests still use fetch.
  if (/\bfetch\(/.test(text)) {
    text = text.replace(/\bfetch\(/g, 'desktopFetch(');
    text = `import { desktopFetch } from '@/lib/desktop-fetch';\n${text}`;
  }
  if (relative === 'components/institution/TeacherPerformanceChart.tsx') {
    text = text.replace(/import dynamic from "next\/dynamic";\s*/, '').replace(/export const TeacherPerformanceChart = dynamic\([\s\S]*?\);/, 'export const TeacherPerformanceChart = TeacherPerformanceChartInner;');
  }
  if (relative.endsWith('/StaffAttendanceClient.tsx')) text = text.replace('CardHeader, CardTitle', 'CardHeader');
  const out = path.join(target, relative);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text);
}
for (const root of roots) visit(root);
// Public data types are copied independently of their server implementations.
const tenant = fs.readFileSync(path.join(source, 'lib/institution-tenant.ts'), 'utf8');
fs.writeFileSync(path.join(target, 'lib/institution-tenant.ts'), "import type { WebsiteNotices } from './public-website-notices';\nimport type { PublicSiteThemeId } from './public-site-themes';\nimport type { WebsiteDesign } from './public-site-builder';\n" + tenant.match(/export type PublicInstitutionTenant = \{[\s\S]*?\n\};/)[0]);
const restore = fs.readFileSync(path.join(source, 'lib/institution-restore-engine.ts'), 'utf8');
fs.writeFileSync(path.join(target, 'lib/institution-restore-engine.ts'), restore.match(/export type RestorePreview = \{[\s\S]*?\n\};/)[0]);
console.log(JSON.stringify({ files: [...seen], external: [...external] }, null, 2));
