# WORK-LOG

Read this first in every new session. Keep entries short.

## Current state

- Current phase: M4 done; gate passed (install, use, uninstall clean). Waiting for the user's hand check of the tray icon/menu and a real right-click, and approval to start M5.
- Next step: when approved, start M5: measure NFR-01..05 properly (startup, click latency, 8 h memory), FR-16 (pause when hidden / fullscreen app in front), multi-monitor check, acceptance criteria, release v1.0. Open question: keep plain Three.js instead of TresJS (then update requirement.md)?
- Testing rule (user, 2026-11-06): do not inject keyboard or move the real mouse system-wide. Use CDP events into the app's own pages and messages posted to the app's own windows; leave real-input checks to the user.

## Task status

| Phase | Task | Status | Note |
| --- | --- | --- | --- |
| M1 | Scaffold Vue 3 + Electron (electron-vite) | done | typecheck, lint, test, build pass |
| M1 | Transparent, frameless, always-on-top window | done | verified by screenshot |
| M1 | Click-through on transparent areas | done | verified with physical mouse on 1 monitor, 125% DPI; multi-monitor not tested (only 1 screen) |
| M2 | Procedural low-poly cat model (.glb) | done | 1,240 tris, 260 KB, presets orange-tabby + calico; only `idle` clip so far |
| M2 | Load model and play idle | done | verified by screenshots in dev and production build |
| M3 | Click, drag, drop | done | verified via CDP + real cursor; saving the position waits for M4 |
| M3 | Auto-walk and sleep | done | walk verified (also fired on its own); sleep fired from real 5 min idle |
| M4 | Tray menu | done | built (show/hide, settings, about, quit); not clicked by hand yet |
| M4 | Settings window and persistence | done | all 5 settings apply live and survive restart; right-click menu -> Settings verified |
| M4 | Auto-start and single instance | done | Run key written by installed app, removed on uninstall; dev never registers |
| M4 | NSIS installer | done | 108 MB, per-user, install/update/uninstall verified clean |
| M5 | Measure against NFRs, fix bugs | todo | |
| M5 | Release v1.0 | todo | |
| v2 | Pet-care system | todo | not started until the user says go |

## Phase approvals

| Phase | Finished | Approved to continue |
| --- | --- | --- |
| M1 | 2026-11-06 | yes, 2026-11-06 |
| M2 | 2026-11-06 | yes, 2026-11-06 |
| M3 | 2026-11-06 | yes, 2026-11-06 (user checked drag by hand: smooth) |
| M4 | 2026-11-06 | waiting |

## Log

- 2026-11-06: Requirements written, CLAUDE.md, requirement.md and WORK-LOG.md created. No code yet.
- 2026-11-06: User approved start of M1. git init (branch main, no commits yet).
- 2026-11-06: Scaffolded by hand: electron-vite 6, Electron 45, Vue 3.5, three 0.187, TS 6.0 (typescript-eslint needs <6.1), vitest 5, eslint 10. The `dist` script waits for M4 (electron-builder).
- 2026-11-06: Pet window (src/main/petWindow.ts), IPC `window:set-ignore-mouse`, sandboxed preload, navigation and window.open blocked, single instance lock. Placeholder icosahedron + Raycaster hit test (src/renderer/composables).
- 2026-11-06: Ran in dev. Transparent window renders over the desktop at lower right (1 monitor, 2560x1600, 125% DPI). Transparent areas pass clicks through.
- 2026-11-06: Problem: with setIgnoreMouseEvents(true, {forward:true}) the renderer gets no mousemove when the cursor is moved by SendInput. IPC works and Chrome_RenderWidgetHostHWND exists. Re-arming forward after mount did not help. TEMP-DEBUG logs are in src/main/ipc.ts and useClickThrough.ts (remove later).
- 2026-11-06: User tested with a physical mouse: forwarding works (163 mousemove, 87 hits, ignore toggled on/off correctly). The issue was only the SendInput-injected test moves, so don't use SendInput to test hover. Kept the re-arm on mount. Removed TEMP-DEBUG logs; kept dev-only renderer console forwarding in petWindow.ts.
- 2026-11-06: Final checks pass: typecheck, lint, test (3), prettier, build. Built app launches; second instance exits at once. M1 gate passed. npm audit: 11 moderate, dev lint tooling only.
- 2026-11-06: User approved M2. Started M2.
- 2026-11-06: Cat generator in scripts/cat/ (parts.mts rig + geometry, palette.mts coat presets, animations.mts idle, buildCat.mts). `npm run model:build` runs it with Node's built-in TS stripping and writes assets/models/cat-*.glb + .json. Flat-shaded vertex colors, no textures, 17 bones, rigid skinning except the tail (blended).
- 2026-11-06: GLTFExporter needs FileReader in Node; a small polyfill lives in scripts/generate-cat.mts.
- 2026-11-06: Renderer: model registry via import.meta.glob (src/renderer/models/registry.ts), config validated by src/shared/modelConfig.ts, GLTFLoader + AnimationMixer, 30 fps frame limiter (src/renderer/lib/frameLimiter.ts). Placeholder removed. Stayed on plain Three.js (no TresJS, no new deps).
- 2026-11-06: Production build loads .glb over file:// fine. Dev showed a blank window once: the first-run Vite dep optimize + reload. Fixed with optimizeDeps.include in electron.vite.config.ts; checked from a cold cache.
- 2026-11-06: Rough idle measurement (production build, 15 s): CPU 0.44% of the machine (7% of one core), private RAM ~189 MB. Formal NFR checks stay in M5.
- 2026-11-06: Tabby stripes changed to frequency 4 / width 0.32 (they were too fine for the low-poly faces). Camera moved closer (z 2.8). Generated JSON added to .prettierignore.
- 2026-11-06: Checks pass: typecheck (node, web, scripts), lint, test (24), prettier, build. M2 gate passed.
- 2026-11-06: User approved M3. Started M3. TresJS question not answered yet; staying on plain Three.js. Position persistence (FR-04 second half) deferred to M4 (electron-store).
- 2026-11-06: Added clips walk, click, drag, land, sleep (scripts/cat/animations.mts). Loops are seamless; once-clips start and end at rest (tested). Models now 344 KB.
- 2026-11-06: Main: src/main/petMotion.ts (drag polls the cursor at 60 Hz; walk steps the window at 30 Hz; setBounds with fixed size to avoid DPI resize), src/main/lib/placement.ts (clamp to work area + overflow, tested), src/main/userIdle.ts (powerMonitor, 300 s). New IPC: pet:drag-start/end, pet:walk-start (invoke)/stop/ended, system:user-idle. Handlers only accept the pet window.
- 2026-11-06: Renderer: state machine src/renderer/lib/petMachine.ts (tested), usePetBehavior (clips, wander timer 20-60 s, sleep at 12 fps), usePetPointer (4 DIP drag threshold), useClickThrough lock + per-frame recheck so a moving cat never leaves the window blocking the mouse. Skinned bounds refreshed per frame for hit tests.
- 2026-11-06: CORRECTION to the M1 note: SendInput never moved the cursor because the INPUT struct in my script was 48 bytes (Win32 needs 40). It was not a forwarding problem. For tests use SetCursorPos (PowerShell -File: pass negative numbers as -Dx:-250).
- 2026-11-06: Test tools (scratchpad, not in repo): `npx electron-vite dev --remoteDebuggingPort 9223` + a small CDP script to send mouse events and call window.__petDebug (dev builds only, stripped from production).
- 2026-11-06: Verified: click -> click -> idle; empty-area click ignored; drag follows the real cursor exactly and clamps at the screen edge; release -> land -> idle, window stays, click-through returns; walk moves the window and faces the direction; real 5 min idle -> sleep; wake -> idle.
- 2026-11-06: Window widened to 380x300 DIP (side view was cut off while walking). Sleep pose: back legs tucked (scale 0.5), tail curled more.
- 2026-11-06: Checks pass: typecheck, lint, test (47), prettier, build. Production idle: CPU 0.36% of machine, private RAM 189 MB. Not checked by hand: drag smoothness with a real mouse, multi-monitor.
- 2026-11-06: User asked to start dev from .claude/launch.json. Fixed its port 3000 -> 5173 (electron-vite renderer port). The Electron pet window works; the browser pane page throws (no window.petApi outside Electron), which is expected.
- 2026-11-06: User tried click/drag with a real mouse: smooth. Approved M4. Started M4.
- 2026-11-06: Decision (user): minimal deps for M4. Only electron-builder (dev). Own JSON settings store instead of electron-store; no Pinia. requirement.md section 6/7 and CLAUDE.md updated.
- 2026-11-06: Moved vue and three to devDependencies (Vite bundles them), so the installer ships no node_modules. Added electron-builder 26 (dev). npm blocked electron-winstaller's install script; not needed (Squirrel only).
- 2026-11-06: Settings: src/shared/settings.ts (5 settings, limits, sanitize; tested), src/main/settingsStore.ts (one JSON file, debounced atomic write; tested with a temp dir), applySettings.ts (opacity, always on top, pet size, login item). Position saved after drag, walk and resize (FR-04).
- 2026-11-06: Pet size resizes the window around the cat's feet (placement.ts resizeKeepingFeet; tested). Walk distance, speed and edge overflow scale with it.
- 2026-11-06: Tray (src/main/menus.ts, left click toggles the pet), right-click menu on the pet (FR-10), About dialog, settings window (second preload src/preload/settings.ts, page src/renderer/settings.html). All UI text in src/shared/strings.ts (English for now).
- 2026-11-06: Icons drawn by scripts/generate-icons.mts (hand-written PNG/ICO encoder, no deps).
- 2026-11-06: Pitfall: two preload entries got a shared chunk that a sandboxed preload cannot require. Fixed with preload build.isolatedEntries in electron.vite.config.ts.
- 2026-11-06: Pitfall: my menu check looked for Win32 "#32768" windows, but Electron menus are Chromium views windows (Chrome_WidgetWin_1). The right-click menu worked all along. Added win.focus() before popup anyway. Earlier SendKeys {DOWN}{DOWN}{ENTER} went to whatever window was in front; the user stopped that run, and the testing rule above came from it.
- 2026-11-06: Added `--settings` flag (also via second instance) to open settings; used for testing, handy as a shortcut.
- 2026-11-06: Verified in the production build: settings change live (size 150% -> 713x563 with feet fixed, opacity 0.6, topmost off) and survive a normal quit + relaunch.
- 2026-11-06: Dev and installed app shared %APPDATA%\desktop-pet; dev now uses desktop-pet-dev (set before the single-instance lock).
- 2026-11-06: Installer: dist/desktop-pet-setup-0.1.0.exe, 108 MB, per-user to %LOCALAPPDATA%\Programs\desktop-pet, Start menu + desktop shortcuts. First launch 11 s (likely first-run scan), later 0.3-0.9 s. Update install keeps settings.
- 2026-11-06: Uninstall left %LOCALAPPDATA%\desktop-pet-updater (the installer's own copy, 108 MB). Fixed in build/installer.nsh. Final cycle with auto-start on: install -> use -> uninstall leaves no folders, shortcuts, Run/StartupApproved values or uninstall entry.
- 2026-11-06: Checks pass: typecheck, lint, test (62), prettier, build, dist. Not checked by hand: tray icon and tray menu, a real right-click.
