# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server (Next.js)
npm run build        # production build
npm run lint         # ESLint on src/
npm run type-check   # tsc --noEmit (no test runner — verify types only)
```

No test framework is configured. There is no `npm test`.

`npm run build` is a **static export** to `out/` (deployed to S3 behind CloudFront) — see `next.config.mjs`. Nothing may need a Node server at runtime: no middleware, no request-time route handlers, no `rewrites`/`redirects`/`headers` in the build config, no server-only APIs (`cookies()`, `headers()`, dynamic `searchParams` props). Server-only route handlers are plain `route.ts` files (e.g. `src/app/doc-proxy/route.ts`); the static export leaves `.ts` out of `pageExtensions`, so they're built only for `next dev` and Vercel (`VERCEL=1`), which get a normal server build with the `/api` proxy. App pages and layouts must therefore be `.tsx`. In production `/api/*` and `/hubs/*` reach the backend through CloudFront, not Next.js. `NEXT_PUBLIC_*` vars are baked in at build time.

## Project Overview

**ISBAT University ERP — Academic Module** (`isbat-academic-portal`).
Next.js 15 App Router, React 18, TypeScript, Tailwind CSS 3, `@tanstack/react-query`, `zod`, `jose`.

The app is a UI-first design prototype. All data is hard-coded mock data; API calls are behind a `NEXT_PUBLIC_AUTH_MOCK=true` flag in `src/lib/auth.ts`.

## Route Architecture

```
/                          → redirects to /login
/login                     → portal selector (Staff vs Student)
/login/staff               → staff ID + password form
/login/student             → student ID + password form
/login/otp                 → OTP verification (shared for both flows)
/login/forgot              → forgot password flow
/login/activate            → account activation (new staff)
/login/expired             → expired session landing

/academic/*                → protected academic module (layout shell)
/academic/acad-dashboard
/academic/intake-master
/academic/faculty-master
/academic/lecturer-master
/academic/skill-master
/academic/batch-management
/academic/session-movement
/academic/course-units
/academic/a-level-master        (Programme Level)
/academic/programme-group
/academic/programme-master
/academic/fee-structure
/academic/timetable
/academic/allocation
/academic/odl-applications
/academic/odl-reconciliation
/academic/student-lookup
... and several more read-only pages
```

## Key Architectural Patterns

### Login flow state
`src/lib/session.ts` stores the multi-step login flow (challengeId, OTP channel, reset tokens) in `sessionStorage` under key `isbat_login_flow`. Steps communicate via `setFlowState` / `getFlowState`. `src/lib/auth.ts` contains all auth API calls — when `NEXT_PUBLIC_AUTH_MOCK=true` it returns hardcoded responses without hitting the network.

Mock credentials (from `src/lib/auth.ts`):
- Staff: `AR-2024-0001` / `Admin@1234`, OTP: `123456`
- Student: `ISB/2024/BSCS/0142` / `Student@1234`, OTP: `123456`

### Academic module shell
`src/app/academic/layout.tsx` is a `'use client'` layout that owns the sidebar panel state (`panelOpen`, `collapsedSections`). It renders `<Header>` and `<Sidebar>` and passes state down as props. Navigation inside the module uses `router.push('/academic/' + id)`.

### Page pattern (all academic pages are identical in structure)
```tsx
const [openModals, setOpenModals] = useState<Set<string>>(new Set())
const [toast, setToast]           = useState<{ msg: string; type: string } | null>(null)

function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
```
All pages end with `<Toast toast={toast} />` and a list of modals gated by `openModals.has('modal-id')`.

### Modal pattern
Every modal lives in `src/components/modals/` and accepts `ModalProps` from `src/components/modals/types.ts`:
```ts
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  showToast: (msg: string, type?: string) => void
  nav?: (id: string) => void
}
```
Modals return `null` when `!isOpen`. Clicking outside (on `.modal-overlay` or `.drawer-overlay`) does **not** close — only the ✕ / Cancel / Close buttons do, so a stray click can't throw away a half-filled form. Don't add `onClick` to the overlay.

### Design system
The app uses a **custom CSS design token system** defined in `src/app/globals.css`. Tailwind is present but most styles use the custom CSS classes (`.btn`, `.card`, `.pg-hdr`, `.sb-item`, `.modal`, `.badge-*`, etc.) rather than Tailwind utilities. When adding UI, prefer the existing semantic classes over new Tailwind utilities.

CSS token naming:
- Greys: `--g100` … `--g900`
- Blues (primary): `--b50` … `--b900`
- Semantic: `--green`, `--amber`, `--red`, `--cyan`, `--gold`, `--purple` — each has `-bg` and `-bd` variants
- Neumorphic shadows: `--neu-out`, `--neu-in`, `--neu-sm`
- Radii: `--radius` (14px), `--rsm` (10px), `--rxs` (7px)
- Sidebar dimensions: `--rail-w` (66px), `--panel-w` (228px)

Tailwind config (`tailwind.config.ts`) maps all CSS variables to Tailwind color names (e.g. `bg-b500`, `text-g400`, `bg-clr-green-bg`).

### Icons
LineIcons 4.0 loaded from CDN in `src/app/layout.tsx`. Usage: `<i className="lni lni-{name}"></i>`.

### Fonts
Three Google Fonts loaded with CSS variables: `--font-serif` (Source Serif 4), `--font-sans` (Inter Tight), `--font-mono` (JetBrains Mono).

## Shared Components

| Component | Purpose |
|---|---|
| `ScrollTable` | Wraps `<table>` with horizontal scroll arrows that auto-show/hide |
| `ActionMenu` | Dropdown "Actions" button using fixed positioning to avoid overflow clipping |
| `Toast` | Simple absolute-positioned toast; auto-dismiss is controlled by the page, not the component |
| `Sidebar` | Two-level sidebar: rail (module icons) + panel (nav items with collapsible sections) |
| `Header` | Fixed top bar with profile dropdown |

## Input Validation (`src/lib/errorMessages.ts`)
- Staff ID format: `ROLE-YYYY-NNNN` (e.g. `AR-2024-0042`)
- Student ID format: `ISB/YYYY/PROG/NNNN` (e.g. `ISB/2024/BSCS/0142`)
- Password: min 8 chars, 1 uppercase, 1 digit, 1 special character

## Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_GATEWAY_URL` | Base URL for API calls (empty string in dev uses relative paths) |
| `NEXT_PUBLIC_AUTH_MOCK` | Set to `"true"` to skip real API calls and use hardcoded mock responses |
