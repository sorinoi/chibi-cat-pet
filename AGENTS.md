# Desktop Pet (Windows) — AGENTS.md

> Same content as CLAUDE.md, for agents that read AGENTS.md. Keep both files identical apart from this header.

Personal Windows app: a clickable, draggable sprite cat that lives on the desktop.
Built with Vue 3 + Electron + Canvas 2D. Single developer (the user) working with Claude Code. Personal use only, not distributed.

Communicate with the user in Thai, casual and friendly, no rude or vulgar language. Keep code, identifiers, commits and code comments in English.

## Product summary

- v1: one sprite cat on a transparent, frameless, always-on-top window. Click, drag, drop, idle/walk/sleep behaviors, system tray menu, settings, NSIS installer.
- v2.0 (done and accepted 2026-11-06): pet-care system, see `requirement-v2.md`. Only ONE pet at a time. Adopting a different pet means starting over and wiping the old pet's data immediately.
- v4 (approved 2026-11-06, not started): hungry notification, focus history, optional focus treats, sad/look/stretch/yawn clips (art: cat-life.png from the user), 8-hour memory run; see `requirement-v4.md`.
- v3.0 (done and accepted 2026-11-06): Pomodoro focus timer + Thai/English UI, see `requirement-v3.md`. The timer is not linked to pet care; the cat keeps living as usual and only reacts at phase changes.
- Out of scope: macOS/Linux, multiple pets at once, cloud sync/accounts, shop/marketplace/plugins.
- Requirement IDs (FR-xx, NFR-xx) come from the requirement doc. Reference them in commits and PRs when relevant.

## Tech stack

- Vue 3 (Composition API, `<script setup>`) + TypeScript (strict)
- Vite via electron-vite
- Electron (main + preload + renderer)
- Graphics: Canvas 2D drawing a PNG sprite sheet (no WebGL, no Three.js). The 3D .glb cat was replaced on 2026-11-06 (user decision); it lives in git commit 42360ca.
- Model format: PNG sprite sheet + JSON config (grid, anchor, clips with fps/frameMs, loop, loopFrom)
- State: Vue composables (no Pinia). Persistence: own small JSON files in the user's app data folder: settings.json (src/main/settingsStore.ts), for v2 pet.json (src/main/careEngine.ts + petStore.ts), for v3/v4 focus.json with the focus history per day, version 2 (src/main/focusEngine.ts; a v3 version 1 file is upgraded on load). Decided in M4 to keep deps minimal.
- Native calls: koffi 2.x (FFI, prebuilt binary in the package, its install script is not run). Used only in src/main/fullscreenWatcher.ts for FR-16. electron-builder.yml ships only its win32_x64 binary, unpacked from asar.
- Packaging: electron-builder (NSIS, Windows x64)
- Tests: Vitest. Lint/format: ESLint + Prettier

## Commands

Keep these script names so this file stays true:

```
npm run dev         # electron-vite dev with hot reload (data in %APPDATA%\desktop-pet-dev)
npm run build       # production build
npm run typecheck   # vue-tsc + tsc for main/preload and scripts/
npm run lint        # eslint
npm run test        # vitest
npm run dist        # build + electron-builder -> dist/desktop-pet-setup-<version>.exe (NSIS, x64)
npm run icons:build # regenerate resources/*.png and build/icon.ico
npm run sprite:prepare -- <in.png> <out.png> [cols] [rows]   # clean a sprite sheet, print cell boxes
npm run sprite:regrid -- <in.png> <out.png> [scale] [cols] [rows]   # rebuild an off-spec sheet: clear haze, cut frames by their art, 224 px grid, feet on one line
npm run readme:art  # re-render the animated README previews (APNG) into docs/images/
```

`scripts/` holds the icon generator, the sprite prep tool and the README image renderer (`.mts`, run by Node's built-in type stripping). `scripts/lib/png.mts` is a tiny dependency-free PNG codec (also writes APNG). README.md is bilingual (English + Thai); rerun `readme:art` when the sprites or clip timings change. New art from the user goes into `assets/sprites-inbox/`, then through `sprite:prepare` into `assets/models/`.

Installer notes: config in `electron-builder.yml`, extra uninstall steps in `build/installer.nsh` (Run key, updater cache). The installed app keeps data in `%APPDATA%\desktop-pet` (settings.json, pet.json); uninstall deletes it. `"Desktop Pet.exe" --settings` opens the settings window, also when the app is already running.

Update this section whenever scripts change. Run `typecheck`, `lint` and `test` before declaring a task done.

## Project layout

```
src/main/        Electron main process: windows, tray, settings store, care engine, auto-start, single instance, IPC handlers
src/preload/     one contextBridge API per window, each tiny and typed: index (pet), settings, adopt
src/renderer/    Vue pages: index.html (pet: sprite scene, behavior state machine), settings.html, adopt.html
src/shared/      types and pure logic used by main and renderer (IPC, settings, model config, needs math, care text)
assets/models/   sprite sheets .png + one JSON model config + license note
assets/sprites-inbox/  the user's original art, before `sprite:prepare`
```

## Hard rules

Security (NFR-06, NFR-07)
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox` on where possible.
- Renderer never imports Node/Electron APIs directly. Everything goes through the typed preload API.
- Never load remote content. No network calls, no telemetry. The app must work fully offline.

Window behavior
- Pet window: `transparent: true`, `frame: false`, `alwaysOnTop: true`, `skipTaskbar: true`, not resizable.
- Transparent areas must not block the mouse. Use `setIgnoreMouseEvents(true, { forward: true })` and toggle it based on whether the cursor is over the cat (per-pixel alpha hit test on the current frame). Fallback if unreliable: shrink the window to fit the model and move the window instead.
- Test click-through early (M1) and on multi-monitor and high-DPI setups before building more on it.
- Only one instance may run (`app.requestSingleInstanceLock`).

Performance (NFR-01 to NFR-05)
- Frames change at most 30 times per second, on a timer at each frame's own duration; nothing runs between frames. Pause when the window is hidden or a fullscreen app is in front.
- Targets (tune after measuring): idle CPU under 5%, RAM under 300 MB, pet visible within 5 s of launch, click reaction within 100 ms, no memory growth over 8 hours.
- Release the sheet image, alpha mask and timers when the scene unmounts or the model changes. No leaks.

## Conventions

- TypeScript strict, no `any` without a comment explaining why.
- Vue: Composition API + `<script setup lang="ts">`. Logic that is not UI goes into composables under `src/renderer/composables/`.
- Pet behavior is an explicit state machine (src/renderer/lib/petMachine.ts): v1 idle, walk, click, drag, land, sleep; v2 eat, happy, hungry, pet, welcome. No ad-hoc boolean flags.
- v3 focus timer: main owns it (focusEngine); menus call it directly (FR-35). Main pushes focus:state to the pet and settings windows and focus:reaction to the pet; the pet renderer decides whether the cat can react (skips while hidden, dragged or without a pet; queues one during another reaction). Missing focus clips fall back via resolveClip() in modelConfig.ts.
- v2 care actions go through the renderer first (it checks the state machine), then main applies them via `care:act`; menus only send `care:request`.
- No magic numbers for timings, sizes or fps. Put them in a config module or the settings store.
- Models and animation clip names come from config, not hardcoded in components. Standard clip names: `idle`, `walk`, `click`, `drag`, `land`, `sleep`; optional v2 care clips: `eat`, `happy`, `hungry`, `pet`; optional v3 focus clips: `focusStart`, `focusDone`, `breakOver`, `longBreak` (fall back to click/happy until their art exists).
- Pet-care tuning (rates, floors, cooldowns, stroke detection) lives only in src/shared/careConfig.ts. Focus timer defaults, limits and internals live only in src/shared/focusConfig.ts; the timer rules are pure in src/shared/focusTimer.ts and run in main (focusEngine), not in the pet state machine.
- User-facing text lives only in src/shared/strings.ts: one table per language (English defines the shape, Thai must match; strings.test.ts checks it). Main reads `stringsFor(store.settings.language)` when it builds a menu, tooltip or dialog; the settings window derives the language from its settings, the pet and adoption windows use `useLanguage()` (app:get-language / app:language-changed).
- IPC channels are named `domain:action` (for example `window:set-ignore-mouse`) and typed in one shared file.
- Small, focused commits. Conventional Commit style (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`).
- Keep dependencies minimal. Ask before adding a new runtime dependency.

## Cat sprite

- Art, generated by the user with Claude (claude.ai); license note in assets/models/cat-sprite.LICENSE.txt. Claude does not hand-draw sprites; new art comes from the user.
  - `cat-sprite.png` (sheet `main`): 8 x 6 cells of 192 px, feet at y = 177; v1 clips.
  - `cat-care.png` (sheet `care`): 8 x 4 cells of 224 px, feet at y = 210; v2 clips eat, happy, hungry, pet. Made from the inbox original with `sprite:prepare`.
  - `cat-focus.png` (sheet `focus`): 8 x 4 cells of 224 px, feet at y = 210; v3 clips focusStart, focusDone, longBreak, breakOver. The inbox original was off-spec (hazy background, 271.5 px cells, frames crossing cells), so it went through `sprite:regrid` (scale 0.8) instead.
- Sheet rules (requirement.md section 9): real alpha, regular grid, one clip per row from column 0, feet at the same height (anchor), walk frames face one way (`walkFacing`). One model can use several sheets; each clip names its sheet.
- Required clips: `idle` (loop), `walk` (loop), `click` (once), `drag` (loop, intro via `loopFrom`), `land` (once), `sleep` (loop, intro via `loopFrom`).
- The active model is set in src/shared/activeModel.ts. `modelFrame()` fits every sheet with all feet anchors on one point; main sizes the pet window from that frame x displayScale x pet size, rounded up to a 4 DIP grid (fractional pixel sizes made Windows grow the window).
- Any third-party art must have a clear license; keep the license note next to the file.

## Milestones

Each phase must pass its gate before starting the next one.

**Phase approval rule:** when a phase is finished, stop. Notify the user (Thai, short): what was done, whether the gate passed, and what the next phase is. Then WAIT for explicit approval before starting the next phase. Never roll into the next phase on your own.

1. M1 Scaffold: Vue 3 + Electron + transparent window. Gate: always-on-top transparent window with working click-through.
2. M2 Model: load the model, play `idle` (done with 3D; replaced by the sprite after M4). Gate: cat animates on the desktop.
3. M3 Interaction: click, drag, drop, auto-walk, sleep. Gate: smooth click/drag, transparent areas never block the mouse.
4. M4 Shell: tray menu, settings window, persistence, auto-start, installer. Gate: install, use and uninstall cleanly.
5. M5 Polish: measure against NFRs, fix bugs, release v1.0.

v2 (pet-care system) requirements are in `requirement-v2.md` (hunger + happiness, gentle, one pet; V2-M1..M5). Approved by the user on 2026-11-06. V2 phases follow the same phase approval rule as v1: finish one, report, wait for approval before the next.

v3 (focus timer + Thai/English UI) requirements are in `requirement-v3.md` (V3-M1..M5, language first). Approved by the user on 2026-11-06, released as 3.0.0. Same phase approval rule.

v4 requirements are in `requirement-v4.md` (V4-M1..M5; M1-M2 need no art). Approved by the user on 2026-11-06. Same phase approval rule.

## Source of truth: requirement.md

`requirement.md` (repo root) holds the full requirements: scope, FR/NFR tables, tech stack, architecture, UI/UX behavior, model spec, milestones, risks, acceptance criteria and open questions.

- When you need project details, or you are unsure or have forgotten something, re-read `requirement.md` instead of guessing.
- If the user changes a decision, update `requirement.md` too and mention it in `WORK-LOG.md`.

## Session continuity: WORK-LOG.md

`WORK-LOG.md` (repo root) lets the user close a session and open a new one smoothly.

- At the start of every session, read `WORK-LOG.md` first (then `requirement.md` if needed) and continue from the recorded state.
- Log EVERY action briefly as you go: what was done, which files or areas, and the result. One or two lines per entry, newest at the bottom of the log section. No long explanations.
- Keep a "Task status" table at the top, updated whenever a task changes. Statuses: `todo`, `in progress`, `done`, `blocked`. For `blocked`, add a few words on why.
- Keep a "Next step" line at the top that says exactly where to resume.
- Update the log before ending a session, before a phase handoff, and after anything that could be lost (decisions, failed attempts worth remembering).
- Never put secrets in the log.

## Working agreements

- Start each task by stating which requirement IDs or milestone it covers.
- If a requirement is ambiguous or conflicts with another, ask the user instead of guessing.
- Prefer the smallest change that satisfies the requirement. Do not refactor unrelated code.
- Verify before reporting done: run typecheck, lint, tests, and for UI/window changes actually launch the app (`npm run dev`) and check behavior.
- Keep this file and the requirement doc in sync. If a decision changes, tell the user so the doc can be updated.
- Never commit secrets, local settings files, build output (`dist/`, `out/`) or `node_modules/`.
