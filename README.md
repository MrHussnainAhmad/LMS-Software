# Nisaab360 Institution Desktop

Nisaab360 Institution Desktop is an offline-first Windows application for institution administration. It provides institution staff with local access to campuses, students, staff, attendance, examinations, results, timetables, announcements, diary entries, leave requests, ID cards, settings, and help-desk workflows.

The application is built with Electron, React, TypeScript, Vite, and SQLite. It stores a synchronized working set locally so supported workflows remain available during temporary network outages and pushes queued changes after connectivity returns.

## Downloads

Production releases are published on the [GitHub Releases page](https://github.com/MrHussnainAhmad/LMS-Software/releases). Download the Windows installer named `Nisaab360-Setup-<version>.exe`.

The installer supports standard Windows uninstallation through **Settings > Apps > Installed apps**.

## Network and privacy

The application connects to the configured Nisaab360 backend when a user signs in, requests server-backed data, synchronizes offline changes, imports or exports institution data, or checks for software updates. Authentication tokens and institution records required for offline operation are stored in the application's local SQLite database on the computer.

The application does not contain unrelated advertising or analytics telemetry. Institution operators are responsible for ensuring they have authority to process the staff and student information they enter or synchronize. The backend service's privacy terms also apply to data transmitted to that service.

## Requirements

- Windows 10 or later for packaged releases
- Node.js 20 or later for development
- A reachable Nisaab360 backend

## Development

Install dependencies and start the development client:

```powershell
npm ci
npm run dev
```

Development mode connects to `http://127.0.0.1:3000` by default. Start the backend separately before signing in.

Quality checks:

```powershell
npm run lint
npx tsc --noEmit
```

## Building

Create a production installer connected to `https://nisaab360.app`:

```powershell
npm run build
```

Create a local-test installer connected to `http://127.0.0.1:3000`:

```powershell
npm run build:local
```

Installers are written to `dist-electron/`. Local-test installers are for development only and must not be published as production releases.

## Releasing

1. Update the version in `package.json` and `package-lock.json`.
2. Run lint and TypeScript checks.
3. Create and push a tag in the form `v<version>`.
4. The release workflow builds the production installer from that tagged commit and creates a GitHub release.
5. After SignPath enrollment is approved, release signing must be performed only from the verified repository build and approved through the configured SignPath policy.

## Code signing policy

Free code signing provided by [SignPath.io](https://signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).

- Source repository: [MrHussnainAhmad/LMS-Software](https://github.com/MrHussnainAhmad/LMS-Software)
- Committer and reviewer: [Hussnain Ahmad](https://github.com/MrHussnainAhmad)
- Release approver: [Hussnain Ahmad](https://github.com/MrHussnainAhmad)
- Release signing is restricted to artifacts built from this repository's tagged source through the trusted build workflow.
- Every release-signing request requires manual approval by the release approver.
- The application communicates only with the configured backend for user-requested operations, synchronization, and update checks, as described under **Network and privacy**.

## Security

Please do not disclose suspected vulnerabilities in a public issue. Report them through the repository's [private security advisory form](https://github.com/MrHussnainAhmad/LMS-Software/security/advisories/new). See [SECURITY.md](SECURITY.md) for the supported-version policy.

## Contributing

Contributions are welcome through pull requests. All contributions must be compatible with GPL-3.0-only and must pass the documented quality checks. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Copyright (C) 2026 Hussnain Ahmad.

This project is free software licensed under the [GNU General Public License version 3 only](LICENSE) (`GPL-3.0-only`).
