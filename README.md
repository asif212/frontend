# my_time web

Independent React + TypeScript + Vite repository. Calls the FastAPI service over HTTP; contains no Python code or database access.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:5173. Start the backend on port 8000 and run its migrations first. Use the administrator account created with the backend CLI. Create teams and initial leads in the Teams UI. Leads can manage locations, employees/profiles, projects, issues, sprints, tasks, location holidays and leave policies. Members can collaborate on project issues, log work, attach files, clock in/out, request attendance corrections and submit full/half-day leave. Leads handle approvals and view reports/audit history.

```sh
npm run build
npm run preview
```

Set `VITE_API_URL` to the API's `/api/v1` URL before building; this is public configuration, never a secret. Add the frontend origin to backend `CORS_ORIGINS`. Geolocation requires localhost or HTTPS and explicit browser permission.

Tokens remain in memory and disappear on reload. Password changes revoke sessions and return to sign-in. Data is fetched from the API, with loading/error/empty states; no demo data is displayed. Fonts optionally load from Google Fonts with system fallbacks.

The board uses accessible status selectors with server validation. Additional views cover issues/backlog and sprint snapshots, comments/watchers/dependencies/files, leave balances/ledger and accruals, employee profiles, attendance corrections/calendar, notifications and read state, reports, team settings and audit history. Profile editing and project issue management are available to leads. See the backend repository's `FEATURES.md` for exact rules and remaining product scope. The production build and TypeScript check were verified; 17 Chrome UI tests pass with mocked API responses. Real backend/browser integration and live PostgreSQL testing remain separate checks.

## Project allocation and feature planning

Open a project from **Projects**, then use **Planning & details** to edit the project owner, planned cost/currency, estimate, and planned/release dates. Use **Members & allocation** to add project members with percentage allocations and optional dates. Edit a membership to deactivate or reactivate it; open issues must be finished or reassigned first. Overlapping bookings above 100% are rejected.

In **Issues & backlog**, choose the project and an allocated assignee, then select **Feature** or another issue type. Enter cost/currency, estimate, planned date and release date when creating or editing. Assignment is checked against the planned date, or the team's current date if no planned date is entered. Run backend migrations before using these controls.

## Interface and browser checks

The interface uses Radix UI Dialog for modal forms, record details, mobile navigation and page search; Lucide for icons; and Sonner for save feedback. The shared design system is in `src/style.css` and `src/ui.tsx`; workspace navigation is in `WorkspaceShell.tsx`, and sign-in is in `AuthScreen.tsx`.

The workspace includes grouped navigation, a collapsible sidebar, Ctrl/Cmd+K page search, mobile navigation, board/list and project grid/list modes, task status filters, sortable/paginated tables, readable status chips, and project planning/member tabs. Search, sorting, and table pages operate on the records returned by the API (currently bounded); they do not fetch additional server pages automatically. Validation errors preserve entered form data, and expired sessions return to sign-in with an explanation.

```sh
npm run test:e2e
```

Browser tests use your installed Google Chrome (`channel: chrome`) and start/stop a local Vite server on port 5173. They use isolated mock API responses and never write to the real database. The workflow tests cover task creation/blocking, project planning/allocation, feature metadata and dialog focus, table sorting/pagination, mobile navigation and keyboard search, validation errors, session expiry, and password visibility. Screenshots and failure traces are written under the ignored `test-results/` directory.

[Design previews](docs/UI_PREVIEW.md) use test fixture data; runtime screens always load your actual API data.

Responsive checks now cover every lead view at 320, 390, 768 and 1024 pixels, plus narrow-phone admin/member forms, password changes, touch controls and landscape dialogs. All 17 browser tests pass. See [responsive coverage](docs/RESPONSIVENESS.md) for the tested scenarios.
