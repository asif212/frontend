# my_time web

Independent React + TypeScript + Vite repository. Calls the FastAPI service over HTTP; contains no Python code or database access.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:5173 for the public website, or http://localhost:5173/app for MyTime. Start the backend on port 8000 and run its migrations first. Use the administrator account created with the backend CLI. Create teams and initial leads in the Teams UI. Leads can manage locations, employees/profiles, projects, issues, sprints, tasks, location holidays and leave policies. Members can collaborate on project issues, log work, attach files, clock in/out, request attendance corrections and submit full/half-day leave. Leads handle approvals and view reports/audit history.

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

## Public website

NialTech’s public pages are in `src/Website.tsx` and `src/website.css`. Super administrators can open **Website content** after signing in. Public text is persisted through `/api/v1/website`; homepage images have eight replaceable positions; portfolio galleries support any number of photos and nested sections. See [hosting and image limits](../deploy/README.md).

The homepage uses a pinned hero with parallax imagery and a pinned portfolio sequence driven by native scrolling. Collection links remain clickable; reduced-motion preferences switch the sequence to a static gallery. Scroll behavior is in `src/ScrollEffects.tsx` and `src/scroll-effects.css`.

## Search engine optimization

`npm run build` now generates route-specific HTML for the homepage, portfolio index and every current portfolio section, together with sitemap.xml, robots.txt, and Hostinger/Apache .htaccess rules. Pages contain readable public headings, descriptions, gallery images and links before JavaScript runs. React keeps titles, canonical links, Open Graph/Twitter tags and organization/collection/breadcrumb JSON-LD synchronized with live content. MyTime's /app page is noindex and excluded from the sitemap; unknown public routes should return HTTP 404 in production.

The canonical origin defaults to https://nial.in. For another deployment domain, set VITE_SITE_URL in the build environment (and use the same value in Vite). SEO_DATA_DIR defaults to ../backend/website_data; provide the current public content.json and portfolio.json there when building elsewhere. Only public fields are rendered; private Google tokens are never copied. VITE_API_URL, if specified in the build environment, also determines the origin for gallery images in generated HTML. Otherwise the production backend is assumed to be proxied under the same domain's /api path.

After editing public content or adding/removing portfolio sections, rebuild and redeploy the frontend to refresh the initial HTML and sitemap. The running app still reads current content directly from the API. Upload the complete dist directory, including its hidden .htaccess file, and ensure the hosting server honors these rules. Existing WordPress service URLs redirect to their corresponding portfolio sections. Preserve real files/directories before any SPA fallback rules in the hosting configuration. No DNS or production hosting changes are made by building locally.

Validation: `node scripts/check-seo.mjs` after a build, plus `npx playwright test tests/seo.spec.ts`. After deployment, submit https://nial.in/sitemap.xml to Google Search Console and inspect the published URLs. Search indexing and rankings depend on Google; local checks cannot confirm production indexing.
