# Desktop Pet (Windows) — CLAUDE.md

Personal Windows app: a clickable, draggable sprite cat that lives on the desktop.
Built with Vue 3 + Electron + Canvas 2D. Single developer (the user) working with Claude Code. Personal use only, not distributed.

Communicate with the user in Thai, casual and friendly, no rude or vulgar language. Keep code, identifiers, commits and code comments in English.

## Product summary

- v1: one sprite cat on a transparent, frameless, always-on-top window. Click, drag, drop, idle/walk/sleep behaviors, system tray menu, settings, NSIS installer.
- v2 (later): pet-care system. Only ONE pet at a time. Adopting a different pet means starting over and wiping the old pet's data immediately.
- Out of scope: macOS/Linux, multiple pets at once, cloud sync/accounts, shop/marketplace/plugins.
- Requirement IDs (FR-xx, NFR-xx) come from the requirement doc. Reference them in commits and PRs when relevant.

## Tech stack

- Vue 3 (Composition API, `<script setup>`) + TypeScript (strict)
- Vite via electron-vite
- Electron (main + preload + renderer)
- Graphics: Canvas 2D drawing a PNG sprite sheet (no WebGL, no Three.js). The 3D .glb cat was replaced on 2026-11-06 (user decision); it lives in git commit 42360ca.
- Model format: PNG sprite sheet + JSON config (grid, anchor, clips with fps/frameMs, loop, loopFrom)
- State: Vue composables (no Pinia). Persistence: own small JSON store in main (src/main/settingsStore.ts, file in the user's app data folder). Decided in M4 to keep deps minimal.
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
```

`scripts/` holds the icon generator and the sprite prep tool (`.mts`, run by Node's built-in type stripping). `scripts/lib/png.mts` is a tiny dependency-free PNG codec. New art from the user goes into `assets/sprites-inbox/`, then through `sprite:prepare` into `assets/models/`.

Installer notes: config in `electron-builder.yml`, extra uninstall steps in `build/installer.nsh` (Run key, updater cache). The installed app keeps data in `%APPDATA%\desktop-pet`; uninstall deletes it. `"Desktop Pet.exe" --settings` opens the settings window, also when the app is already running.

Update this section whenever scripts change. Run `typecheck`, `lint` and `test` before declaring a task done.

## Project layout

```
src/main/        Electron main process: window, tray, settings store, auto-start, single instance, IPC handlers
src/preload/     contextBridge API exposed to the renderer (keep it tiny and typed)
src/renderer/    Vue app: sprite scene, behavior state machine, settings UI
src/shared/      types and pure logic used by main and renderer (IPC, settings, model config, active model)
assets/models/   sprite sheet .png + JSON config + license note per model
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
- Pet behavior is an explicit state machine (idle, walk, click, drag, land, sleep). No ad-hoc boolean flags.
- No magic numbers for timings, sizes or fps. Put them in a config module or the settings store.
- Models and animation clip names come from config, not hardcoded in components. Standard clip names: `idle`, `walk`, `click`, `drag`, `land`, `sleep`.
- IPC channels are named `domain:action` (for example `window:set-ignore-mouse`) and typed in one shared file.
- Small, focused commits. Conventional Commit style (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`).
- Keep dependencies minimal. Ask before adding a new runtime dependency.

## Cat sprite

- Art: assets/models/cat-sprite.png (8 x 6 cells, 192 px), generated by the user with Claude (claude.ai). License note in cat-sprite.LICENSE.txt. Claude does not hand-draw sprites; new art comes from the user.
- Sheet rules (requirement.md section 9): real alpha, regular grid, one clip per row from column 0, feet at the same height (anchor), walk frames face one way (`walkFacing`).
- Required clips: `idle` (loop), `walk` (loop), `click` (once), `drag` (loop, intro via `loopFrom`), `land` (once), `sleep` (loop, intro via `loopFrom`).
- The active model is set in src/shared/activeModel.ts; main sizes the window from it (cell size x displayScale x pet size).
- Any third-party art must have a clear license; keep the license note next to the file.

## Milestones

Each phase must pass its gate before starting the next one.

**Phase approval rule:** when a phase is finished, stop. Notify the user (Thai, short): what was done, whether the gate passed, and what the next phase is. Then WAIT for explicit approval before starting the next phase. Never roll into the next phase on your own.

1. M1 Scaffold: Vue 3 + Electron + transparent window. Gate: always-on-top transparent window with working click-through.
2. M2 Model: load the model, play `idle` (done with 3D; replaced by the sprite after M4). Gate: cat animates on the desktop.
3. M3 Interaction: click, drag, drop, auto-walk, sleep. Gate: smooth click/drag, transparent areas never block the mouse.
4. M4 Shell: tray menu, settings window, persistence, auto-start, installer. Gate: install, use and uninstall cleanly.
5. M5 Polish: measure against NFRs, fix bugs, release v1.0.

v2 (pet-care system) requirements are in `requirement-v2.md` (hunger + happiness, gentle, one pet; V2-M1..M5). Approved by the user on 2026-11-06. Do not start v2 implementation (V2-M1) without an explicit go-ahead.

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
