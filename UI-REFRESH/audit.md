# TDILEARNED — UI Refresh Audit

**Branch:** `ui-refresh` · **Date:** 2026-09-20 · **Scope:** UI-only (no behavior changes)
**Files read:** all of `app/` (13 files), `components/` (26 files), `lib/store/useMindMapStore.ts` (state names only), `lib/utils/`, `app/globals.css`, `tailwind.config.ts`, `package.json`.

Design language as found: monochrome editorial/brutalist — black/white/neutrals, 2px/4px borders, zero radius, Playfair Display (display/serif), Source Serif 4 (body), JetBrains Mono (labels). The system is ~90% coherent; the issues below are the remaining 10%.

---

## 1. Type & Spacing

### 1.1 Micro-label type is overused and too small
- `text-[9px]` appears ~30× and `text-[10px]` ~40×, almost always `font-mono uppercase` with `tracking-widest`/`tracking-wider`. At 9px, JetBrains Mono uppercase with 0.15em tracking (see 1.3) is at the edge of legibility — used for real content, not just decoration: source domains (`InlineCitations.tsx`), timestamps (`DossierDrawer.tsx` "Sentence N of M"), tab labels (`ModelSelector.tsx` provider tabs), status text (`AudioTourPlayer.tsx`).
- **Fix:** establish a floor — nothing functional below 10px; demote 9px to 10px, and reserve 9px for purely decorative captions if at all. Add `text-label-sm` / `text-label-xs` tokens so the sizes stop being arbitrary.

### 1.2 One-off font sizes break the scale
- `ChatComposer.tsx` user message: `text-[15px]` — the only 15px in the app; body elsewhere is `text-xs`/`text-sm`/`text-base`.
- `MapViewer.tsx` coordinates and `DossierDrawer.tsx` footer use `text-[9px]` while similar metadata elsewhere is 10px.
- **Fix:** map everything onto `text-xs / text-sm / text-base` + two label tokens; delete the arbitrary values.

### 1.3 Letter-spacing is doing too much work
- `tailwind.config.ts` overrides `letterSpacing.widest` to `0.15em` (Tailwind default is `0.1em`). Combined with 9–10px uppercase mono, labels look strung-out and consume horizontal space (e.g. `DossierDrawer.tsx` tab bar, `HubBrowser.tsx` pills).
- `tracking-widest` vs `tracking-wider` is applied inconsistently to the same kind of element (badges vs headers).
- **Fix:** revert `widest` to `0.1em` (or keep 0.15em only for the hero/brand), and standardize: `wider` for badges, `widest` for section headers.

### 1.4 Hero scale is inconsistent across pages
- `LandingState.tsx`: `text-4xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.98]`.
- `not-found.tsx` / `error.tsx`: `text-4xl sm:text-6xl md:text-7xl leading-[0.98]` (stops at 7xl, and `lg:text-8xl` exists in config but is unused there).
- **Fix:** one hero token (e.g. `text-display`) shared by all three.

### 1.5 Spacing rhythm drifts
- Modal padding: `p-6 md:p-8` (search modal `app/page.tsx`, `ShareModal.tsx`, `SharePromptModal.tsx`, `AuthModal.tsx`) vs `p-6 md:p-7` (shortcuts modal `app/page.tsx`). Pick one.
- Section spacing inside drawers mixes `space-y-7`, `space-y-6`, `space-y-5`, `space-y-4`, `p-5 sm:p-6 md:p-8` (`DossierDrawer.tsx`) vs `p-5` (`ActivityPanel.tsx`) vs `p-6` (`MyMindMapsDrawer.tsx`).
- **Fix:** 2–3 spacing presets for panel bodies.

### 1.6 `top-18` is not a Tailwind class — toast is mispositioned
- `app/page.tsx:346` — the "Story Ready" toast uses `fixed top-18 right-6`. Tailwind has no `top-18` (scale jumps 16→20), so no `top` is emitted and the toast renders at `top: auto` (vertically wherever static flow would put it — effectively overlapping the masthead area unpredictably).
- **Fix:** `top-20` (or `top-24` to clear the masthead).

### 1.7 Untokenized arbitrary dimensions (functional, but fragile)
- Drawers: `w-[400px]` (`ActivityPanel.tsx`), `md:w-[620px]` (`DossierDrawer.tsx`), `max-w-[480px]` (`MyMindMapsDrawer.tsx`), `md:w-[420px]` (`HubBrowser.tsx`), `w-[260px]` (`MobileOverflowMenu.tsx`).
- Nodes: `w-[min(60vw,380px)]`, `w-[min(62vw,420px)]`, `w-[min(86vw,360px)]`.
- `MapViewer.tsx`: `h-[180px]` map frame; `ChatComposer.tsx`: `max-h-[min(55vh,440px)]`.
- **Fix:** fine to keep, but centralize drawer widths in the Tailwind config (`drawer: { sm/md/lg }`) so the z/scale system has one place to change.

---

## 2. Hierarchy & Consistency

### 2.1 It is *almost* truly monochrome — except red
- The palette is otherwise disciplined: only `neutral-*` + black/white. But:
  - `ActivityPanel.tsx:151-152` — research error strip: `bg-red-50 border-red-700 text-red-700`.
  - `ChatComposer.tsx:266` — stream error: `text-red-600`.
  - Meanwhile `DossierDrawer.tsx` renders its research error as a **black** strip with white text.
- Three different error treatments. **Fix:** standardize on the inverted black error strip everywhere (fits the monochrome system; red adds nothing here since there's no severity gradient).

### 2.2 One stray opacity-border + one near-black mismatch
- `InlineCitations.tsx` — `[i+1]` badge uses `border-black/20`: the only alpha border in the app.
- `DossierDrawer.tsx` tab bar uses `bg-neutral-950` while every other near-black surface is `bg-black`. On most screens they're indistinguishable, which is exactly why it's a bug — two tokens for one job.
- **Fix:** `border-black` and `bg-black`.

### 2.3 `muted` token disagrees with the CSS variable
- `tailwind.config.ts`: `muted: '#F5F5F5'` vs `globals.css` `--color-surface: #F8F8F8` (which `--muted` aliases). `bg-muted` and `var(--muted)` render different grays.
- **Fix:** single source of truth — point the config at the CSS var or delete the config value.

### 2.4 `darkMode: 'class'` is dead config
- `tailwind.config.ts` enables class-based dark mode; there are zero `dark:` variants anywhere. It only risks a stray `dark` class on `<html>` inverting nothing (or confusing future work).
- **Fix:** remove `darkMode: 'class'`.

### 2.5 Modal zoo — five implementations, no shared anatomy
| Modal | Scrim | Padding | z | Header |
|---|---|---|---|---|
| Search (`app/page.tsx`) | `bg-black/60 backdrop-blur-xs` | `p-6 md:p-8` | `z-40` | title + close, no badge |
| Shortcuts (`app/page.tsx`) | `bg-black/60 backdrop-blur-xs` | `p-6 md:p-7` | `z-50` | icon + title + close |
| `ShareModal.tsx` | `bg-black/70 backdrop-blur-none` | `p-6 md:p-8` | `z-[100]` | `EXPORT` badge + title + close |
| `SharePromptModal.tsx` | `bg-black/70` (no blur class) | `p-6 md:p-8` | `z-[100]` | `YOUR MAP IS LIVE` badge + close |
| `AuthModal.tsx` | `bg-black/70 backdrop-blur-none` | `p-6 md:p-8` | `z-[100]` | `TDI` badge + title + close |
| `MobileOverflowMenu.tsx` | `bg-black/40` | — | `z-40/50` | `MENU` bar |

- **Fix:** one `Modal` shell (scrim `bg-black/60`, one padding, one z, one header pattern). Note `backdrop-blur-xs` *is* a valid Tailwind 3 class — the inconsistency is the choice, not the class.

### 2.6 z-index scale needs documenting (and two collisions)
Current: header `z-20`, toast `z-30`, bottom bar `z-30`, dossier minimized dock `z-30`, ChatComposer `z-20`, ActivityPanel `z-20`, HubBrowser `z-40` (mobile) / `md:z-30`, DossierDrawer `z-40` (mobile) / `md:z-30`, overflow menu `z-40`+`z-50`, library drawer `z-[90]`, modals `z-[100]`.
- On mobile, DossierDrawer (`z-40`) and HubBrowser (`z-40`) can overlap with undefined order.
- `MobileOverflowMenu` panel is `z-50` but its scrim is `z-40` — fine — yet the masthead "Menu" button that opened it sits at `z-20` under the scrim: correct behavior, but fragile.
- **Fix:** tokenize z in config (`z-modal: 100`, `z-drawer: 90`, `z-overlay: 40`, `z-chrome: 20`, `z-toast: 30`) and resolve the mobile drawer tie.

### 2.7 Topics toggle in the masthead has a dead ternary
- `app/page.tsx:281-283`: `isBrowseOpen ? 'bg-black text-white' : 'bg-black text-white hover:bg-white hover:text-black'` — both branches are black-on-white-inverted, so the button *always looks active*. Compare the Library/Share/Shortcuts buttons right below it, which correctly use `hover:bg-black hover:text-white` when inactive.
- **Fix:** mirror the sibling pattern.

### 2.8 Icon-only button sizes: five different targets
`p-1` (HubBrowser close, modal closes), `p-1.5` (masthead actions, dossier window controls), `w-7 h-7` (canvas HUD), `w-9 h-9` (ChatComposer send), `w-11 h-11` (mobile masthead, overflow close). **Fix:** two sizes — `icon-sm` (32px, desktop chrome) and `icon-lg` (44px, touch surfaces).

### 2.9 Border-weight language is loose
`border` / `border-2` / `border-4` are used for emphasis, but the mapping isn't stable: masthead `border-2`, landing card `border-2 md:border-4`, drawer edges `border-l-4`/`border-t-4`, node cards `border-2`→`border-4` on selected, MiniMap inline `2px`. **Fix:** document the rule (1px = hairline/divider, 2px = component, 4px = selected/masthead) and audit outliers — e.g. `LandingState.tsx` `md:border-4` on the card vs `border-2` everywhere else for cards.

---

## 3. Motion

### 3.1 Existing keyframes: tasteful, keep them
`fadeIn`/`dropIn` (100ms), `riseIn` (260ms, staggered ≤300ms), `lineReveal` (180ms), `caretBlink` (steps), `pulseBlock` (1.2s), `iconEnter`/`iconExit` (200ms) — all fast, restrained, on-brand. Nothing feels sluggish. The global `prefers-reduced-motion` block is correct and aggressive.

### 3.2 Missing transitions (the actual refresh work)
- **Drawers open with fade only** — `DossierDrawer.tsx:134-135`, `MyMindMapsDrawer.tsx`, `HubBrowser.tsx`, `MobileOverflowMenu.tsx` all use `animate-fade`. A 160–220ms slide (drawer from right, browser from left/bottom on mobile, overflow menu from top-right) would sell the "snappy" standard.
- **Modals** — fade only; add a subtle 4px rise (already have `dropIn`, just use `animate-drop` on the dialog panel, not just the scrim).
- **Node hover** — `ResearchNode.tsx:65,70`: card is `transition-none` and non-selected hover flips `border-2`→`hover:border-4`. Border-width changes reflow inner content by 2px (visible jump). **Fix:** keep `border-2` and swap border *color*/background on hover, or use `box-shadow: inset 0 0 0 2px` for the "thicken" effect with no layout shift.
- **List entrances** — `HubBrowser.tsx` and `MyMindMapsDrawer.tsx` rows appear with no stagger; reuse `line-reveal`/`animate-rise` with small delays.
- **ModelSelector dropdown** — intended `animate-in fade-in-0` (see 5.3) currently does nothing; give it `animate-drop`.

### 3.3 Motion that fights the "snappy" bar
- Global `button:not(:disabled):active { transform: scale(0.97); transition: transform 200ms ease-out; }` (`globals.css`): the transition is declared *only* in `:active`, so press-in animates over 200ms but release snaps back instantly — feels sticky rather than springy. **Fix:** put the transition on `button` base (or drop the press-scale on icon buttons).
- `animate-ping` (Tailwind default, 1s cubic-bezier) on `ThinkingReasoning.tsx` and the `MobileBottomBar.tsx` researching dot is the slowest-feeling motion in the app. It's fine at 1s, but the square ping (see 7.1) reads as a glitch, not a pulse.

### 3.4 Reduced-motion gaps
- `WebSearch.tsx` globe: the SMIL `<animate>` elements inside the inline SVG are **not** covered by the CSS `prefers-reduced-motion` reset — the meridians keep morphing for reduced-motion users. **Fix:** `useReducedMotion`-style gate in JS, or replace SMIL with the CSS `globe-spin` only.
- `ChatComposer.tsx` auto-scroll uses `scrollTo({ behavior: 'smooth' })` — the JS `behavior` option is not overridden by the CSS `scroll-behavior: auto !important` reset. Gate on `matchMedia('(prefers-reduced-motion: reduce)')`.

---

## 4. Accessibility Gaps

### 4.1 No focus trapping in any dialog
Search, Shortcuts, Share, SharePrompt, Auth modals + all drawers: focus can tab out into the canvas behind the modal. `autoFocus` is used on inputs (`app/page.tsx` search, `AuthModal.tsx`) without a trap. **Fix:** a tiny `useFocusTrap` hook on the shared modal shell (see 2.5); at minimum `role="dialog" aria-modal="true" aria-label`.

### 4.2 Escape is inconsistent
- Global LIFO stack in `app/page.tsx` covers search/shortcuts/share/library/browse/dossier/overflow — good.
- `AuthModal.tsx` has **no** Escape handling and its scrim doesn't close on click — keyboard users must tab to the X.
- `SharePromptModal.tsx` has its own Escape listener (fine, but now two systems).
- **Fix:** route everything through one Escape registry.

### 4.3 Interactive non-button elements (no role / no keyboard)
- `ResearchNode.tsx:63` — the entire node card is a `div onClick={handleCardClick}` with `cursor-pointer`; keyboard users cannot open a dossier from the canvas at all. (The inner title *is* a button, but the card body/summary is not reachable.)
- `MyMindMapsDrawer.tsx:≈135,≈205` — recent/cloud session cards are `div onClick` with `cursor-pointer`.
- `AudioTourPlayer.tsx:≈232` — transcript sentences are `<p onClick={handleJumpToSentence}>` with `cursor-pointer`.
- **Fix:** make the card a real `<button>`/`<a>` or add `role="button" tabIndex={0}` + Enter/Space handlers.

### 4.4 Contrast failures
- `text-neutral-400` (#A3A3A3) on white ≈ 2.8:1 — **fails WCAG AA** for text. Used in ~39 places: helper captions, timestamps, icons, `MobileBottomBar` labels are fine (9px bold on white at 2.8:1 still fails), `HubBrowser.tsx` search icon, `InlineCitations` domains.
- `text-neutral-500` (#737373) on white ≈ 4.7:1 — passes AA for normal text but is used at 9–10px where it's borderline; on `bg-neutral-100`/`bg-neutral-50` it drops under 4.5:1 in several badges.
- **Fix:** floor secondary text at `neutral-600` (#525252); reserve 400/500 for large/bold-only or decorative use.

### 4.5 Touch targets under 44px on mobile surfaces
- Modal/drawer close buttons: `p-1` + `w-4 h-4` icon ≈ 24px (`HubBrowser.tsx:144`, `AuthModal.tsx`, `ShareModal.tsx`, `SharePromptModal.tsx`, `MyMindMapsDrawer.tsx:97`).
- Dossier window controls (`DossierDrawer.tsx:172-188`): `p-1.5` ≈ 30px — on a mobile fullscreen reader.
- `ChatComposer.tsx` send: `w-9 h-9` (36px).
- `ModelSelector.tsx` trigger `py-1` (≈26px) and provider tabs `py-1`.
- Inline citation pills (`MarkdownContent.tsx`, `InlineCitations.tsx`): `py-0.5` ≈ 20px tall links inside body text — hard to hit on touch.
- **Fix:** 44px minimum on all mobile-reachable controls; keep 32px desktop-only chrome.

### 4.6 `select-none` blocks text selection on reading surfaces
Applied to `DossierDrawer` (whole story container, :134-135), `ChatComposer` (answers), `AudioTourPlayer`, `HubBrowser`, `ActivityPanel`, `MarkdownContent` wrapper. Users can't select/copy story text or answers — for a *reading* app this is a real UX/a11y regression. **Fix:** scope `select-none` to chrome (headers, buttons, canvas); allow selection in prose containers.

### 4.7 Unlabeled inputs
- `ChatComposer.tsx` input: placeholder-only, no `<label>`/`aria-label` (the send button has `aria-label="Ask"`, the input has nothing).
- `HubBrowser.tsx` filter input: placeholder-only.
- `app/page.tsx` search modal input: placeholder-only (has a visible heading nearby, but no programmatic label).
- **Fix:** `aria-label` on each.

### 4.8 `maximumScale: 1` disables pinch zoom
- `app/layout.tsx:37` viewport: `maximumScale: 1` blocks iOS pinch-zoom — an a11y failure (WCAG 1.4.4). **Fix:** remove it (keep `width=device-width, initial-scale=1`).

---

## 5. Dead Code / CSS

### 5.1 Defined but never used in any .tsx
- `.texture-paper`, `.texture-inverted-lines` (`globals.css`) — 0 usages. (`.texture-grid` is used; keep it.)
- `.hoverable` (`globals.css`, with its `@media (hover:hover)` transition block) — 0 usages. Either use it or delete it.
- `.icon-swap-exit` + `@keyframes iconExit` — 0 usages; only `icon-swap-enter` is used (`ChatComposer.tsx`). Delete exit or wire it.
- **Note:** `icon-swap-enter` is applied via `key={...}` remount on the copy/pin icons — works, keep.

### 5.2 Referenced but never defined (silent no-ops)
- `.custom-scrollbar` — used in **7 files** (`DossierDrawer`, `ActivityPanel`, `ChatComposer`, `HubBrowser`, `ThinkingReasoning`, `TodoList`, `ModelSelector`) but **not defined** in `globals.css`. The global `::-webkit-scrollbar` rules apply anyway, so it's dead weight that *implies* a variant that doesn't exist.
- `.no-scrollbar` — used in `ChatComposer.tsx` (suggested-chips row); not defined → chips row can show a scrollbar on some platforms. Define it (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`) or remove.
- **Fix:** define both or delete all usages.

### 5.3 Plugin classes without the plugin
- `ModelSelector.tsx:74`: `animate-in fade-in-0 duration-100` — `tailwindcss-animate` is **not** installed (`package.json`, `plugins: []`), so the dropdown has no entrance animation at all. **Fix:** install the plugin or swap to `animate-drop`.
- `AudioTourPlayer.tsx:222`: `scrollbar-thin scrollbar-thumb-neutral-700` — `tailwind-scrollbar` not installed; no-op. The global 4px scrollbar styles apply instead.

### 5.4 Unused imports
- `MapViewer.tsx:4`: `Touchpad` imported, never used.
- `AuthModal.tsx:5`: `Mail` and `Check` imported, never used (only the *text* "Check Your Inbox").

### 5.5 Tailwind config dead weight
- `darkMode: 'class'` — zero `dark:` variants (see 2.4).
- `fontFamily.sans` / `fontFamily.display` — never referenced (`font-sans`/`font-display` appear 0×). Note the config maps `serif` → Playfair Display, so `font-serif` is really the display face — confusing naming; consider aliasing `font-display` properly and using it.
- `fontSize`: `7xl`/`9xl` defined; only `8xl` used (LandingState). Harmless but the custom sizes suggest a scale nobody follows.
- `borderRadius` all-zero tokens duplicate the `* { border-radius: 0 !important }` global — redundant, keep one (see §7).
- `colors.muted` mismatch (see 2.3).
- `.react-flow__attribution { display: none !important }` in CSS **plus** `proOptions={{ hideAttribution: true }}` in `KnowledgeCanvas.tsx` — redundant; keep the prop.

---

## 6. Per-Surface Notes

### LandingState (`components/canvas/LandingState.tsx`)
- Card: `border-2 md:border-4` — the only card that thickens its border responsively; on mobile the 2px version looks thin next to the 2px masthead. Standardize to `border-2` (or 4 everywhere).
- Category tiles `h-24 sm:h-28` with `animate-rise` stagger (55ms steps to ~300ms) — good, keep.
- "Surprise Me" is a text button with `hover:underline` while everything else inverts — fine as tertiary, but it sits in a section header where it competes with tiles. OK.
- Search submit `min-h-[44px]` — good. Input `p-3.5` vs `p-3.5` in page modal — consistent, good.

### KnowledgeCanvas chrome (`components/canvas/KnowledgeCanvas.tsx`)
- HUD (`bottom-6 left-6`, `hidden md:flex`): buttons `h-7` (28px) with `border-neutral-300` — the only `neutral-300` button borders in chrome; elsewhere chrome uses `border-black`. Unify to `border-black`.
- `Background` dots `color="#00000020"` (12.5% alpha) over `.texture-grid` (also applied on the shell div) — **two grid textures stacked** (CSS grid + React Flow dots). Visually muddy; pick one.
- MiniMap inline styles duplicate tokens (`2px solid #000000`, `borderRadius: 0`) — fine, but move to a class.
- Research skeleton: `border-2 border-black bg-white p-3.5 animate-fade` — good.
- `fitView` durations 400–500ms — fine.

### ResearchNode (`components/canvas/ResearchNode.tsx`)
- `hover:border-4` layout jump (see 3.2) — the highest-visibility motion bug in the app.
- `transition-none` on the card kills even color transitions; the image has `transition-[filter] duration-300 group-hover:grayscale-0` — nice, keep.
- Header `min-h-[30px] sm:min-h-[38px]`, `p-1.5 sm:p-3` — fine.
- `line-clamp-2`/`line-clamp-3` used — good (Tailwind 3.3+ core).
- Title is a `<button>` wrapping an `<h3>` — valid-ish but the *card div* also has onClick (see 4.3); collapse to one interactive element.
- `text-neutral-300` curiosity score on black header — fine contrast.

### PinnedNoteNode (`components/canvas/PinnedNoteNode.tsx`)
- Cleanest node. `max-h-[220px] overflow-y-auto` answer area with `custom-scrollbar` (dead class, see 5.2).
- Delete button `p-0.5 border border-white` — ~20px target (see 4.5).
- `animate-fade` on mount — fine.

### DossierDrawer (`components/dossier/DossierDrawer.tsx`)
- Container: `border-t-4 md:border-l-4` — good. `z-40 md:z-30` tie with HubBrowser on mobile (see 2.6).
- Scroll progress bar `h-[3px] bg-black transition-all duration-75` — good.
- Tab buttons `min-h-[44px]` — good; but active tab is `bg-white text-black border-white` on a `bg-black` bar — the white tab + white body reads as one surface, which is the intent; fine.
- `Copy Story` button `hidden sm:inline-flex` — mobile has no copy affordance (see 4.6 — and selection is blocked anyway).
- Section headers (`font-mono text-[10px] uppercase border-b border-black`) repeat 6× with slight variations (`pb-1` vs none, icon right vs none) — extract a `SectionHeader`.
- Timeline uses `border-l-2` rail with no node dots — fine editorially.
- Minimized dock `bottom-16 sm:bottom-6` — on mobile sits above the bottom bar; OK.
- Magazine mode `z-50` vs share modal `z-[100]` — share prompt can appear over magazine mode; acceptable.

### AudioTourPlayer (`components/dossier/AudioTourPlayer.tsx`)
- `bg-neutral-900` panel inside a white drawer — the only dark panel in the app; intentional (media player), keep.
- `rounded-none` explicitly set on karaoke box — redundant under the zero-radius rule but harmless/self-documenting.
- Sentence `<p onClick>` — see 4.3.
- `scrollbar-thin` dead (see 5.3); equalizer bars `animate-pulse` ×4 with delays — cute, keep.
- Duplicate "AUDIO OVERVIEW" label top and bottom — drop the bottom one.

### MapViewer (`components/dossier/MapViewer.tsx`)
- `Touchpad` dead import (see 5.4).
- Iframe has `title` — good; `grayscale contrast-125 hover:grayscale-0 transition-[filter] duration-300` — matches node images, good.
- "Tap to interact" overlay button — full-area button, good a11y pattern; label could be `aria-label="Enable interactive map"`.
- `h-[180px]` fixed — fine.

### ActivityPanel (`components/activity/ActivityPanel.tsx`)
- Red error strip (see 2.1).
- `w-[400px] max-w-[92vw]` — on small laptops overlaps canvas; fine.
- Thinking toggle `hover:bg-neutral-200` while agent toggles elsewhere use `hover:bg-neutral-100` — unify.
- Tool chips `border-2` vs dossier's `border` chips — unify to `border`.

### ChatComposer (`components/activity/ChatComposer.tsx`)
- `bottom-16 sm:bottom-6` clears the mobile bar — good. `max-w-[calc(100vw-24px)]` — good.
- `no-scrollbar` dead (see 5.2) on the chips row.
- Send button 36px (see 4.5); input unlabeled (see 4.7).
- Follow-up chips `border-2` — chunky vs suggestion row's `border-2`; consistent at least.
- `icon-swap-enter` on copy/pin swap — nice detail, keep.
- Thread window `animate-drop` — good.

### Agent primitives (`StreamingText` / `ThinkingState` / `ThinkingReasoning` / `TodoList` / `WebSearch` / `InlineCitations`)
- Visual language is consistent (2px black border, mono 10px headers, chevron collapse). Good system — promote to documented pattern.
- `ThinkingState.tsx` is 9 lines and appears unused? — grep shows no import of `ThinkingState` anywhere. **Dead component** — delete or wire it.
- `ThinkingReasoning`/`TodoList`/`WebSearch` headers: `px-3 py-2` — consistent. `transition-all` on the wrappers (`ThinkingReasoning`, `TodoList`, `WebSearch`) with no changing properties — harmless but pointless; `transition-colors` suffices.
- `WebSearch` SMIL globe — see 3.4. Also `globe-spin` 1.2s linear — fine.
- `InlineCitations` `border-black/20` — see 2.2.

### HubBrowser (`components/browse/HubBrowser.tsx`)
- `md:w-[420px]`, `top-12 md:top-20` — on mobile it's a bottom sheet under the masthead; good.
- Category pills `py-1` ≈ 24px targets (see 4.5).
- Topic rows: `border-neutral-300 hover:border-black hover:bg-black` — good; but rows have no entrance animation (see 3.2).
- Close `p-1` (see 4.5). Filter input unlabeled (see 4.7).

### MyMindMapsDrawer (`components/library/MyMindMapsDrawer.tsx`)
- `z-[90]` — only drawer below modal z; fine.
- Session cards `div onClick` (see 4.3).
- Tab switcher: active `bg-white font-extrabold` vs inactive `bg-neutral-100` — `font-extrabold` on a mono 12px uppercase label causes a width jump when switching tabs; use `font-bold` consistently or fixed widths.
- Empty states `border-dashed` — the only dashed borders in the app; intentional, keep.
- Footer "← New blank canvas" is a text underline button — fine tertiary.

### AuthModal (`components/auth/AuthModal.tsx`)
- No Escape (see 4.2), no focus trap (see 4.1). Dead imports (see 5.4). Input `transition-none` — the only input that opts out of transitions; remove.
- Otherwise the modal anatomy (badge header, `p-6 md:p-8`) is the best of the five — use it as the template for the shared shell.

### UserMenu (`components/auth/UserMenu.tsx`)
- Dropdown `w-64` with `animate-fade` — give it `animate-drop` + Escape (currently only click-outside; Escape stack in page doesn't know about it).
- `SAVED ✔` — the `✔` character is fine, but it's the only non-lucide glyph; use the `Check` icon for consistency.

### ModelSelector (`components/model/ModelSelector.tsx`)
- Dead `animate-in fade-in-0` (see 5.3). No `aria-expanded` on trigger; no Escape; click-outside only.
- Trigger `py-1` (see 4.5). Selected row `border-l-4 border-l-black` vs `border-l-transparent` — layout-stable, good pattern.
- `divide-y-2 divide-black` header — good.

### ShareModal / SharePromptModal
- ShareModal export cards `p-4 ... space-y-2` with `.MD`/`.PNG` badges — good.
- SharePromptModal: scrim `onClick` close + inner `stopPropagation` — the only modal with backdrop-click close; standardize (all or none).
- Both fine otherwise; fold into shared shell (see 2.5).

### MobileBottomBar / MobileOverflowMenu
- Bar `h-14` + `pb-[env(safe-area-inset-bottom)]` — good. `aria-current` used correctly.
- Researching dot: `rounded-full` is zeroed by the global radius rule → renders as a **square** with `animate-ping` (see §7). Either drop `rounded-full` or exempt the dot.
- Overflow menu `w-[260px]`, rows `min-h-[44px]` — good; close button `w-11 h-11` — good. Panel `animate-fade` — should slide (see 3.2).
- Overflow "Library" row uses a rotated `Plus` icon instead of `Bookmark` — icon mismatch with the bottom bar's Library tab; use `Bookmark`.

### MarkdownContent (`components/ui/MarkdownContent.tsx`)
- `strong` gets `underline decoration-1` — unusual (bold+underline reads as link); consider bold-only.
- `ol` is `font-mono text-[11px]` while `ul` inherits body — inconsistent list treatment; make both inherit.
- Citation pills `text-[10px] ... py-0.5` — small targets (see 4.5); `align-super` on wrapper.
- `code`/`pre` use `border-current/40 bg-current/5` — works on light surfaces; on the dark AudioTourPlayer it isn't used — fine.

### `app/m/[slug]` share page (`SharedMindMapClient.tsx`)
- Loading state: bordered box with spinner — matches system, good.
- Not-found card duplicates `not-found.tsx` language — fine.
- Header `top-4 left-4 right-4` (no `sm:` offsets, unlike home's `top-2 sm:top-4`) — minor; align with home masthead offsets.
- Reuses `KnowledgeCanvas` + `DossierDrawer` — good; no ChatComposer/ActivityPanel on shared page (intentional read-only-ish) — fine.

### `not-found.tsx` / `error.tsx`
- Mirror `LandingState` card anatomy — good consistency. `error.tsx` "Try again" + "Go home" buttons `min-h-[44px]` — good.
- Both pages use `texture-grid` — good.

---

## 7. Zero-Radius Rule — Verdict: **KEEP**

**Keep `border-radius: 0` everywhere.** Justification:

1. **It's load-bearing for the aesthetic.** The monochrome editorial system (mastheads, rules, 2px/4px borders, Playfair/serif + mono labels) reads as newsprint/brutalist. Even a 4px softening would dilute the identity into generic SaaS — the sharp corners are doing as much brand work as the black borders.
2. **It's consistently applied.** The global `* { border-radius: 0 !important }` + zeroed Tailwind tokens mean there are no half-rounded accidents *except one* (below). Consistency is the win; softening would require re-tuning every border interaction.
3. **The one casualty is a bug, not a reason to change the rule:** `MobileBottomBar.tsx:87` — the researching indicator uses `rounded-full`, which the global rule zeroes into a square, so `animate-ping` reads as a glitching square. **Fix the dot, not the rule** — drop `rounded-full` (square ping dot matches the system's square language; the `w-2 h-2 bg-black` squares are already the brand's "dot").

Minor cleanup regardless of verdict:
- The `!important` on `*` is a sledgehammer — it will also zero third-party widgets (maps, embeds). Consider scoping to a `:where()` selector or keeping the Tailwind `borderRadius` config (already all-zero) as the mechanism and dropping the global override. Low priority since nothing is currently broken by it.
- `rounded-none` sprinkled in `AudioTourPlayer.tsx` / `MapViewer.tsx` is redundant under the rule — harmless, but it signals the author didn't trust the rule. Delete for cleanliness.

---

## Appendix: Quick-hit fix list (ordered by impact)

1. `app/page.tsx:346` — `top-18` → `top-20` (toast mispositioned; invalid class).
2. `app/page.tsx:281-283` — Topics button dead ternary; mirror Library button pattern.
3. `ResearchNode.tsx:70` — `hover:border-4` layout jump; use inset box-shadow or color-only hover.
4. Focus trap + `role="dialog"` + Escape for all 5 modals/drawers (new shared `Modal` shell; fixes 2.5, 4.1, 4.2).
5. `text-neutral-400` on white fails contrast (~39 uses) — floor at `neutral-600`.
6. `select-none` on reading surfaces (`DossierDrawer`, `ChatComposer`, `AudioTourPlayer`) — scope to chrome.
7. `app/layout.tsx:37` — remove `maximumScale: 1` (blocks pinch zoom).
8. Interactive divs → keyboard-accessible (`ResearchNode` card, library cards, transcript `<p>`).
9. Dead CSS/classes: `.texture-paper`, `.texture-inverted-lines`, `.hoverable`, `.icon-swap-exit`/`iconExit`, define-or-delete `.custom-scrollbar`/`.no-scrollbar`, `animate-in fade-in-0`, `scrollbar-thin`, unused imports (`Touchpad`, `Mail`, `Check`), dead `ThinkingState` component.
10. Drawer/modal entrances: add slide (`animate-drop` on panels, directional slide for drawers).
11. Touch targets: modal closes, dossier controls, chat send, citation pills → 44px on touch surfaces.
12. Standardize error treatment (black strip, kill the reds) + `border-black/20` → `border-black`, `bg-neutral-950` → `bg-black`.
13. `muted` token mismatch (`#F5F5F5` vs `#F8F8F8`); remove `darkMode: 'class'`; fix `MobileBottomBar` square ping dot.
14. Unlabeled inputs: chat, hub filter, search modal → `aria-label`.
15. Reduced motion: gate WebSearch SMIL globe + chat smooth-scroll.
