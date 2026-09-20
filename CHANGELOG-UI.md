# UI Refresh — CHANGELOG

Branch: `ui-refresh` (local only, never pushed). UI-only pass: zero changes to backend logic, APIs, data flow, store semantics, or user flows. Every screen works exactly as before.

## Design system (`app/globals.css`, `tailwind.config.ts`)

- **Motion language** (from emil-design-eng / transitions.dev): strong custom easings — `--ease-out-strong` `cubic-bezier(0.22,1,0.36,1)`, `--ease-drawer` `cubic-bezier(0.32,0.72,0,1)` (iOS-like), `--ease-icon-swap` `cubic-bezier(0.2,0,0,1)`; snappy durations (press 120ms, hover 150ms, pop 200ms, modal 220ms, drawer 280ms — nothing over 300ms). Exposed as Tailwind `ease-*` / `duration-*` tokens.
- **Enter utilities via `@starting-style`** (interruptible transitions, not restart-from-zero keyframes): `.drawer-enter` / `-left` / `-bottom`, `.modal-enter` (rise + unblur, never from `scale(0)`), `.backdrop-enter`, `.toast-enter`. Exits unmount instantly — softer than enters, per motion-restraint.
- **Elevation**: hard offset shadows only (`--shadow-hard-sm: 3px 3px 0`, `--shadow-hard: 6px 6px 0`) — flat everywhere else; borders carry structure.
- **New utilities**: `.stagger-item` (staged entrances, children set `--i`), `.skeleton` (monochrome shimmer), `.text-shimmer` (thinking-state sweep), `.word-resolve`, `.shake` (error), `.icon-swap` (dependency-free icon cross-fade), `.custom-scrollbar` / `.no-scrollbar` (previously referenced but undefined in 8 files).
- **Press feedback**: global `button:active` scale `0.97` → `0.96` at 120ms (kept on `:active` only so per-button `transition-colors` hover fades are never overridden).
- **Contrast floor**: `text-neutral-400` (#A3A3A3 on white ≈ 2.8:1, fails AA) raised to `neutral-600` for all functional text (~39 spots); `widest` tracking reverted `0.15em` → `0.1em`; functional micro-labels floored at 10px (no functional 9px).
- **Config cleanup**: removed dead `darkMode: 'class'` (zero `dark:` variants); fixed `muted` token mismatch (`#F5F5F5` → `#F8F8F8`, single source of truth with `--color-surface`); documented z-scale (`z-chrome 20 < z-toast 30 < z-overlay 40 < z-drawer 90 < z-modal 100`).
- **Dead CSS deleted**: `.texture-paper`, `.texture-inverted-lines`, `.hoverable`, `@keyframes iconExit` / `.icon-swap-exit`.
- **Zero-radius rule: KEPT** (audit verdict) — sharp corners are load-bearing for the newsprint/brutalist identity; softening would genericize it. Only casualty was a bug, fixed at the component.

## Shared modal shell (new: `components/ui/Modal.tsx` + `components/ui/useFocusTrap.ts`)

One anatomy for all five modals: `bg-black/60` scrim + `.backdrop-enter` at `z-modal`, white 2px-border panel + `.modal-enter` + `.shadow-hard`, `p-6 md:p-8`, mono-badge + serif-title header, 44px close button, `role="dialog"` `aria-modal`, Escape + backdrop-click close, focus trap with initial focus and trigger-restore. Migrated: search modal, shortcuts cheat-sheet (`app/page.tsx`), `ShareModal`, `SharePromptModal` (deleted its duplicated Escape listener), `AuthModal` (gained Escape; dropped dead `Mail`/`Check` imports, `transition-none` on input).

## Per surface

- **Masthead / `app/page.tsx`**: fixed `top-18` (invalid class — Story Ready toast had no top offset) → `top-20` + `.toast-enter`; fixed Topics button dead ternary (always looked active) → mirrors Library pattern; toast dismiss 44px.
- **Canvas chrome (`KnowledgeCanvas`)**: HUD buttons `border-neutral-300` → `border-black` (one chrome language); dropped stacked double grid texture (CSS `texture-grid` removed, React Flow dots kept).
- **ResearchNode**: fixed the `hover:border-4` 2px layout jump — stays `border-2`, thickens via `inset 0 0 0 2px` shadow (zero shift); `transition-none` → `transition-colors`; card keyboard-operable (`role="button"`, `tabIndex`, Enter/Space with target guard so inner buttons don't double-fire).
- **PinnedNoteNode**: delete hit area ~20px → 44px via `::before` inset (visuals unchanged).
- **LandingState**: card `border-2 md:border-4` → `border-2`; labels to 10px floor; placeholder contrast fixed.
- **DossierDrawer**: `.drawer-enter` from right, dialog semantics, extracted `SectionHeader` (6 repeats), `bg-neutral-950` → `bg-black`, `select-none` scoped to chrome (story text selectable/copyable), window controls 44px on mobile, `transition-all` → `transition-[width]` on progress bar.
- **ChatComposer**: inputs labeled, send 36px → 44px, message prose selectable, smooth-scroll gated on `prefers-reduced-motion`, minimized-dock controls 44px, `no-scrollbar` now real.
- **Agent primitives**: `transition-all` → `transition-colors`; `InlineCitations` `border-black/20` → `border-black`; dead `ThinkingState.tsx` deleted (zero imports); WebSearch globe already motion-safe.
- **HubBrowser**: `.drawer-enter-left`, dialog semantics, 44px close + pills, labeled filter, topic rows staggered (`.stagger-item`, capped).
- **MyMindMapsDrawer**: `z-drawer`, `.drawer-enter`, session cards keyboard-operable (nested delete preserved), tab `font-extrabold` → `font-bold` (kills width jump), 44px close/delete.
- **UserMenu / ModelSelector**: `animate-drop` entrances, Escape-to-close, `aria-expanded`/`aria-haspopup`, 44px targets, `✔` → lucide `Check`, ModelSelector `role="listbox/option"`.
- **ActivityPanel**: red error strip → inverted black strip (monochrome; reds fully eliminated app-wide).
- **MobileBottomBar**: researching dot `rounded-full animate-ping` (zeroed into a glitching square by the radius rule) → brand square dot; labels 10px.
- **MobileOverflowMenu**: Library icon `Plus`-rotated → `Bookmark` (matches bottom bar); panel `.drawer-enter`.
- **MarkdownContent**: `strong` bold-only (underline read as link), `ol` inherits body like `ul`, citation pills 32px targets.
- **AudioTourPlayer**: transcript `<p onClick>` → real `<button>`s, duplicate label dropped, dead scrollbar classes removed, prose selectable.
- **MapViewer**: dead `Touchpad` import removed, overlay `aria-label="Enable interactive map"`.
- **Share page (`app/m/[slug]`)**: header offsets aligned with home masthead. OG/share-card rendering untouched.
- **`app/layout.tsx`**: removed `maximumScale: 1` (was blocking pinch zoom, WCAG 1.4.4).
- **`not-found` / `error`**: hero scale aligned with landing (`lg:text-8xl`).

## Deliberately left alone + why

- **Exit animations**: drawers/modals unmount instantly — softer-than-enter is correct; delayed-unmount would touch state semantics.
- **Drawer scrim click**: drawers do not close on scrim click (modals do) — no behavior change, as mandated.
- **`border-radius: 0`**: kept globally; `rounded-none` remnants in AudioTourPlayer removed as redundant.
- **Minimized docks** keep `animate-fade` (functional, infrequent).
- **Placeholders** stay `neutral-400` (decorative, large text).
- **react-doctor design scan**: not run — no network budget left for `npx react-doctor@latest`; typecheck/build/test are the verification gates and all pass.
- **Before/after screenshots**: landing page only (the dynamic canvas/dossier states need live research runs; not reproducible headlessly without backend keys). See `UI-REFRESH/shots/`.

## Verification (exact)

| Check | Baseline (main) | After (ui-refresh) |
|---|---|---|
| `npm run typecheck` | exit 0, no errors | **exit 0, no errors** |
| `npm run build` | exit 0 | **exit 0** |
| `npm run test` | 20/20 passed | **20/20 passed** (incl. `MarkdownContent.test.tsx` 5/5) |
| `npx tsc` per-agent | — | 0 errors (both implementers) |

- No new runtime dependencies (`package.json` untouched).
- `git status`: 30 files modified, 1 deleted (`ThinkingState.tsx`), 2 added (`Modal.tsx`, `useFocusTrap.ts`), plus `UI-REFRESH/` docs and `CHANGELOG-UI.md`.

## Design resources mined

Usable patterns came from **emil-design-eng** (easings, duration table, press scale, @starting-style, no `transition: all`), **make-interfaces-feel-better** (shadows-vs-borders, tabular-nums already present, 44px hit areas, icon cross-fade values), **transitions.dev** (toast rise+blur+scale, modal scale, shimmer thinking states, error shake, skeleton cross-fade), **fixing-accessibility** (names, keyboard, focus/dialogs, contrast). Low yield: reactbits.dev/c/micro (video-only gallery, no code to adapt), 21st.dev/rareui/obsidianui/beautifului/beui/boardui (component galleries; hand-rolled equivalents already existed), impeccable.style (slop-detector product; its "typeset" thinking folded into the contrast/type pass), react-doctor (not run, see above), designspells.com (not fetched — had enough).
