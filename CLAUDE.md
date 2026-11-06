# Desktop Pet (Windows) — CLAUDE.md

Personal Windows app: a clickable, draggable 3D cat that lives on the desktop.
Built with Vue 3 + Electron + Three.js (TresJS). Single developer (the user) working with Claude Code. Personal use only, not distributed.

Communicate with the user in Thai, casual and friendly, no rude or vulgar language. Keep code, identifiers, commits and code comments in English.

## Product summary

- v1: one 3D cat on a transparent, frameless, always-on-top window. Click, drag, drop, idle/walk/sleep behaviors, system tray menu, settings, NSIS installer.
- v2 (later): pet-care system. Only ONE pet at a time. Adopting a different pet means starting over and wiping the old pet's data immediately.
- Out of scope: macOS/Linux, multiple pets at once, cloud sync/accounts, shop/marketplace/plugins.
- Requirement IDs (FR-xx, NFR-xx) come from the requirement doc. Reference them in commits and PRs when relevant.

## Tech stack

- Vue 3 (Composition API, `<script setup>`) + TypeScript (strict)
- Vite via electron-vite
- Electron (main + preload + renderer)
- 3D: Three.js through TresJS (fall back to plain Three.js if TresJS gets in the way)
- Model format: glTF/GLB, animations via `AnimationMixer`
- State: Vue composables (no Pinia). Persistence: own small JSON store in main (src/main/settingsStore.ts, file in the user's app data folder). Decided in M4 to keep deps minimal.
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
npm run model:build # regenerate the procedural cat .glb + .json into assets/models/
npm run icons:build # regenerate resources/*.png and build/icon.ico
```

`scripts/` holds the generators (`.mts`, run by Node's built-in type stripping). Re-run `model:build` after changing anything under `scripts/cat/`.

Installer notes: config in `electron-builder.yml`, extra uninstall steps in `build/installer.nsh` (Run key, updater cache). The installed app keeps data in `%APPDATA%\desktop-pet`; uninstall deletes it. `"Desktop Pet.exe" --settings` opens the settings window, also when the app is already running.

Update this section whenever scripts change. Run `typecheck`, `lint` and `test` before declaring a task done.

## Project layout

```
src/main/        Electron main process: window, tray, settings store, auto-start, single instance, IPC handlers
src/preload/     contextBridge API exposed to the renderer (keep it tiny and typed)
src/renderer/    Vue app: 3D scene, behavior state machine, settings UI
assets/models/   .glb files plus a small JSON config per model (clip names, scale, anchor)
```

## Hard rules

Security (NFR-06, NFR-07)
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox` on where possible.
- Renderer never imports Node/Electron APIs directly. Everything goes through the typed preload API.
- Never load remote content. No network calls, no telemetry. The app must work fully offline.

Window behavior
- Pet window: `transparent: true`, `frame: false`, `alwaysOnTop: true`, `skipTaskbar: true`, not resizable.
- Transparent areas must not block the mouse. Use `setIgnoreMouseEvents(true, { forward: true })` and toggle it based on whether the cursor is over the model (Raycaster hit test). Fallback if unreliable: shrink the window to fit the model and move the window instead.
- Test click-through early (M1) and on multi-monitor and high-DPI setups before building more on it.
- Only one instance may run (`app.requestSingleInstanceLock`).

Performance (NFR-01 to NFR-05)
- Cap rendering at 30 fps. Stop the render loop when the window is hidden, the pet is idle and not animating, or a fullscreen app is in front.
- Targets (tune after measuring): idle CPU under 5%, RAM under 300 MB, pet visible within 5 s of launch, click reaction within 100 ms, no memory growth over 8 hours.
- Dispose geometries, materials, textures and mixers when swapping models. No leaks.

## Conventions

- TypeScript strict, no `any` without a comment explaining why.
- Vue: Composition API + `<script setup lang="ts">`. Logic that is not UI goes into composables under `src/renderer/composables/`.
- Pet behavior is an explicit state machine (idle, walk, click, drag, land, sleep). No ad-hoc boolean flags.
- No magic numbers for timings, sizes or fps. Put them in a config module or the settings store.
- Models and animation clip names come from config, not hardcoded in components. Standard clip names: `idle`, `walk`, `click`, `drag`, `land`, `sleep`.
- IPC channels are named `domain:action` (for example `window:set-ignore-mouse`) and typed in one shared file.
- Small, focused commits. Conventional Commit style (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`).
- Keep dependencies minimal. Ask before adding a new runtime dependency.

## 3D cat model

- Claude creates the cat model in code: low-poly, built from simple primitives, rigged with bones, animated procedurally, exportable to `.glb`. Not a hand-sculpted model.
- Targets: under 20,000 triangles, textures at most 2048 x 2048, file under 10 MB, origin at the feet so it can stand on the ground.
- Required clips: `idle` (loop: breathing, tail sway, ear twitch, blink), `walk` (loop), `click` (once), `drag` (loop), `land` (once), `sleep` (loop).
- Colors and pattern must be configurable (for example orange tabby, calico).
- Any third-party model must have a clear license; keep the license note next to the file.

## Milestones

Each phase must pass its gate before starting the next one.

**Phase approval rule:** when a phase is finished, stop. Notify the user (Thai, short): what was done, whether the gate passed, and what the next phase is. Then WAIT for explicit approval before starting the next phase. Never roll into the next phase on your own.

1. M1 Scaffold: Vue 3 + Electron + transparent window. Gate: always-on-top transparent window with working click-through.
2. M2 Model: load `.glb`, play `idle`. Gate: cat animates on the desktop.
3. M3 Interaction: click, drag, drop, auto-walk, sleep. Gate: smooth click/drag, transparent areas never block the mouse.
4. M4 Shell: tray menu, settings window, persistence, auto-start, installer. Gate: install, use and uninstall cleanly.
5. M5 Polish: measure against NFRs, fix bugs, release v1.0.

v2 (pet-care system) is planned after v1.0. Details are still open (needs, interactions, other species). Do not start v2 work without an explicit go-ahead.

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
