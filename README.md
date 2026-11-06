# imagenuaq-frontend

Setup

```bash
npm install
cp .env.example .env   # both values are build-time; see Environment below
npm run dev            # Vite dev server with HMR
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server with hot-module replacement |
| `npm run build` | Build the production bundle to `dist/` |
| `npm run lint` | Run ESLint on every `.js` and `.jsx` file |
| `npm run preview` | Serve the production build locally |

## Stack

React 19, Vite 8, ESLint 10. JavaScript and JSX only, no TypeScript. The React Compiler
runs through `babel-plugin-react-compiler` and `@rolldown/plugin-babel` in
`vite.config.js`. Memoization is automatic. Add `useMemo`, `useCallback` or `React.memo`
only when profiling shows a need.

## Layout

```
src/
  App.jsx              entry point: session check, tab routing, dark mode
  App.css              global styles
  config.js            build-time environment variables (API_URL, FRONTEND_DOMAIN)
  api/client.js        the only module that talks to the backend
  components/
    shared/            helpers used by more than one screen
      fieldInput.jsx   dynamic form field by data type
      filtroSelect.jsx dropdown filter
      format.js        date and number formatting
      help.jsx         contextual help tooltip
      typeIcon.jsx     icon for each data type
      vocabulary.js    shared UI labels
      fileIcon.jsx     icon for each file extension
      filePreview.jsx  inline file preview
      download.js      file download helper
    login/             session and invitation activation
    sidebar/           navigation menu and role gating
    areas/             org chart areas and their members
    billing/           invoice tracking
    calendar/          calendar view: stages, absences, closures
    contractTypes/     contract type configuration
    documents/         folder tree, files, share links, retention
    FlowDesigner/      node editor for stage-flow templates
    notifications/     alert feed
    orgChart/          organizational chart
    profile/           self-service profile editor
    projects/          project list and stage progress
    requests/          intake inbox
    roles/             role and permission editor
    schemas/           request format versions
    spreadsheets/      Excel workbook registry, column mapping, import
    statusCatalog/     per-area and global status labels
    tasks/             my tasks, unassigned inbox, team load, area overview
    timeline/          area capacity timeline
    users/             user list (admin)
eslint-rules/
  comment-policy.js    enforces the project comment policy
  consistent-import-case.js   catches case mismatches in import paths
nginx.conf             production reverse-proxy config
Dockerfile             multi-stage build: Node for Vite, then nginx
docker-compose.yml     frontend container plus Cloudflare Tunnel
```

## Screen routing

There is no router library. `App.jsx` reads the active tab name from the sidebar
(`"Empleados"`, `"Proyectos"`, and so on) and renders the matching component. The sidebar
gates each tab by role or permission through `menu.js`. A tab without a component shows
its name as a placeholder.

A URL with `?shared=<token>` skips the session check and shows a read-only folder view
(`SharedFolder`). A URL with `?microsoft=` lands on the spreadsheet screen after a
delegated Microsoft sign-in.

## API client

`src/api/client.js` is the only module that calls the backend. It stores the session token
in `localStorage` under `imagenuaq.token` and sends it as a `Bearer` header. It throws
`ApiError` with the server's own message and HTTP status on any error response.

Self-service profile edits go through `POST /api/auth/me`. `PUT /api/users/:id` is
admin-only. The profile picture uses an object URL held in `App.jsx`, because an `<img
src>` cannot send the `Authorization` header.

## Environment

Vite inlines these variables at build time. The production bundle carries the values that
`npm run build` read from the environment. Changing one means rebuilding. The Docker image does
not read `.env` (`.dockerignore` excludes it). Pass them as build args instead.

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_API_URL` | Where `client.js` sends requests, with the `/api` prefix | `"/api"` (uses the Vite proxy or nginx) |
| `VITE_FRONTEND_DOMAIN` | This app's public origin, used to build links | `window.location.origin` |

`VITE_FRONTEND_DOMAIN` must match `FRONTEND_DOMAIN` in the backend's `.env`. The server
signs it into session tokens as `aud` and re-checks it on every request. A mismatch
rejects every token.

An absolute `VITE_API_URL` (such as `http://localhost:3000/api`) talks to the backend
directly. The two halves are then different origins, so the backend's `CORS_ORIGIN` must
allow this one. The bare `"/api"` delegates forwarding to the Vite proxy in development.
The production `nginx.conf` has no `/api` location yet.

## Docker

The Dockerfile runs a multi-stage build. The first stage installs dependencies and runs
`npm run build` with the two `VITE_*` build args. The second stage copies `dist/` into an
nginx container.

```bash
docker compose up --build
```

`docker-compose.yml` also starts a Cloudflare Tunnel sidecar. Set `CLOUDFLARE_TUNNEL_TOKEN`
in the shell or in a `.env` beside the compose file.

`nginx.conf` serves the SPA with `try_files $uri $uri/ /index.html`. It has no `/api`
location. The frontend and backend compose files share no network. Serving both from one
origin in production is not yet done.

## Lint rules

ESLint 10 with two local rules in `eslint-rules/`:

`comment-policy` enforces the project comment standard. It allows only two kinds of
comment: a file header block before the imports and a JSDoc (`/** */`) directly above a
declaration. Inline `//` comments, trailing comments and JSX `{/* */}` inside the body
are errors. CSS files and SQL strings are not under this rule.

`consistent-import-case` catches import paths whose letter case does not match the file on
disk. Windows resolves them anyway, but Vite's HMR stops reloading the file and the Linux
Docker build fails.

The react-refresh rule demands that a module exporting a component exports only that
component. Keep helpers and constants in separate files.

## Conventions

Code is English. What the user reads is Spanish. Identifiers, props and CSS class names
are English on every screen ported from the Lienzo review: `requests/`, `projects/`,
`schemas/`, `spreadsheets/`, `areas/`, `roles/`, `statusCatalog/`, `shared/`. Screens not
yet ported (`login`, `sidebar`, `notifications`, `profile`, `users`, `FlowDesigner`,
`requesterInput`, `fieldInput`) stay in Spanish until someone ports them. Never mix the
two in one file.

Authors write components markup-first: semantic elements, a class name on everything, no
styling decisions in JSX. A new screen gets a `.css` beside it with layout only. Colours,
typography and polish belong to the CSS author. Keep the JSX simple: plain `useState`, no
custom hooks or handler factories.
