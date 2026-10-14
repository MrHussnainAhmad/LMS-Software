# Institution desktop parity

Implemented against the local `lms-backend` source on 13 October 2026. The existing Electron application and offline database remain in use. The server's complex client editors are compiled into the desktop renderer; the institution web panel is not embedded.

| Capability | Desktop location |
| --- | --- |
| Individual/bulk staff attendance, dated edits and queued offline saves | Attendance |
| Plan-limited campus creation, existing-campus login setup, credentials and read-only workspace switching | Campuses and header selector |
| Campus registration number | Settings |
| Current bank/wallet accounts and optional payment QR image | Settings |
| Monthly billing preview/issue, one-time charges, recurring adjustments, removal, collections and pagination | Fees |
| Admission cycles, archives, campus intake, applications and walk-in admissions | Admissions |
| Website themes, content, blocks, notices and device previews | Settings → Public website |
| Event drafts, templates, editing, duplicate, publish/unpublish and design | Public Events |
| Backup upload, restore preview, owner approval/cancellation and recovery requests when eligible | Settings → Institution restore requests |
| Google Drive connection, archive password, disconnect and backup status | Settings → Automated cloud backups |
| Teacher performance by reporting period | Staff → teacher name |
| Promotion review, printable results and CSV | Auto Promotion → review |
| Subject/class/section removal with confirmation | Academics |
| Owner onboarding and required first-login password change | Sign-in/setup flow |
| Voluntary password change | Settings → Your own password |
| Personal notifications and read status | Header notification button |

Server role, plan, main-campus and read-only restrictions still apply. Cross-campus requests carry a signed view token. Mutations in a viewed campus are rejected before they can enter the local write queue and are also checked by the server.

## Online and offline behavior

Existing local database reads and queued writes remain available for the previously supported offline workflows. Attendance saves now update the local cache and pending records remain visible across navigation and stale pulls. Online attendance reads refresh the selected date; pending local edits take precedence until synchronized.

Financial operations, admission decisions, publication, campus/account management, attachments, restores, teacher reports and notifications require the server. They do not report success merely because a generic offline queue accepted an operation. Connection failures are shown in the interface. Website/event previews render locally after the relevant server data has loaded.

Google authorization opens the system browser. The server relays the code to a signed loopback port; the desktop completes authorization through its authenticated API session. No Google password or application token is placed in a browser URL.

## Coordinated release

Deploy the accompanying backend changes before releasing this desktop build: workspace metadata/owner onboarding, teacher performance API, promotion review fields, public preview identity, signed campus-view header support, and the desktop Google Drive callback relay. No new database migration was added by this parity change; the updated backend's existing migrations must already be applied.

The native API bridge accepts only this installation's configured API origin, supports binary and multipart responses, and does not forward credentials through redirects.

## Maintenance and verification

`node scripts/port-institution-ui.mjs` refreshes the shared client editors from the sibling backend source. It preserves desktop adapters and native views. Review backend component changes and run the desktop type check and build after refreshing. Shared card spacing and focus styles live in `src/index.css`.

Checks used:

- `npx tsc -b --pretty false` and `npx vite build` in the desktop project.
- `node scripts/verify-institution-parity.mjs`: built-renderer browser checks with fixture IPC, including billing preview/issue hash, event save/publish, read-only mutation blocking and password changes. Results/screenshots are written under `.codex/parity-tests`.
- `node scripts/verify-native-parity.cjs`: isolated native transport, binary/multipart data, URL/header boundaries, offline attendance persistence and system-browser OAuth callback tests. Requires Node 24 or another Node version with `node:sqlite`.
- Backend TypeScript check and `node --import tsx scripts/verify-campus-workspaces.ts`: disposable PostgreSQL integration checks, including campus isolation and desktop owner onboarding.

These are local builds and isolated tests. Production credentials, real Google authorization, live database workflows and an installed Windows installer have not been exercised. No deployment or live institution mutation was performed.
