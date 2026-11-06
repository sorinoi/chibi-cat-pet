# WORK-LOG

Read this first in every new session. Keep entries short.

## Current state

- Current phase: v2.0 done. V2-M5 gate passed (2026-11-06), waiting for the user to accept the v2.0 release. Tray menu/tooltip still needs the user's hand check.
- Next step: user reviews v2.0 (adopts a cat in the installed 2.0.0, hand checks the tray). Then on request: commit the V2-M5 changes, tag, push. Nothing planned after v2.0 yet (see requirement-v2.md section 15).
- Git (check `git status` and `git log` first; this line can lag): at handoff main was 87cde4e (V2-M4) plus a docs-only handoff update. Commits: 87cde4e V2-M4, 7770fe1 V2-M3, d196771 V2-M2, 0d5e63c handoff docs, f706658 V2-M1, 171ec84 (user's "initial commit": sprite cat + M5), 42360ca (full 3D version, restore point). Remote: origin = github.com/sorinoi/chibi-cat-pet; pushed up to 8d65ddc on 2026-11-06 at the user's request. Push and tag (v1.0.0) only when the user asks.
- Machine state: Desktop Pet 2.0.0 is installed per-user (over 1.0.0) and running, showing the adoption window; %APPDATA%desktop-pet has settings.json only until the user adopts. Dev data %APPDATA%desktop-pet-dev has settings.json only. dist/ has the 1.0.0 and 2.0.0 installers.
- Waiting on the user: approval to start V2-M5; hand check of the v2 tray menu and tray tooltip (run `npm run dev`, adopt a cat, right/left click the tray).
- Open items: real 8 h NFR-05 test (requirement.md section 13); Windows 10 and multi-monitor checks need hardware; v2 open questions (requirement-v2.md section 15) use the written defaults until decided.
- Testing rule (user, 2026-11-06): do not inject keyboard or move the real mouse system-wide. Use CDP events into the app's own pages and messages posted to the app's own windows; leave real-input checks (tray, real clicks, fullscreen) to the user.

## How to test (for a new session)

The helper scripts used so far lived in a session scratchpad and are gone; rebuild them as needed:
- Dev with DevTools protocol: `npx electron-vite dev --remoteDebuggingPort 9223`. Production: `node_modules/electron/dist/electron.exe . --remote-debugging-port=9224` (after `npm run build`). Installed app: `"%LOCALAPPDATA%\Programs\desktop-pet\Desktop Pet.exe" --remote-debugging-port=9225`. Never leave a debug port open on the app the user keeps running.
- CDP client: Node's global WebSocket against http://127.0.0.1:<port>/json; `Runtime.evaluate` for page state, `Input.dispatchMouseEvent` for clicks/drags into the page only.
- Pages in CDP `/json`: `index.html` (pet), `settings.html`, `adopt.html`; pick the target by URL.
- Dev-only hook `window.__petDebug` (pet page): `state()`, `scene()` (clip, frame, facing), `dispatch(event)`, `playClip(name)`, `setUserIdle(bool)`, `mood()`, `wanderNow()`. Stripped from production builds. Call `setUserIdle(false)` first: if the user is away the pet falls asleep and tests go wrong.
- Window checks from PowerShell (read-only): `GetWindowRect`, `GetWindowLong(GWL_EXSTYLE)` (0x20 transparent = click-through on, 0x8 topmost), `GetLayeredWindowAttributes` (opacity). Call `SetProcessDpiAwarenessContext(-4)` first so sizes are physical pixels. Filter by process: the installed app ("Desktop Pet.exe") also has a window titled "Desktop Pet"; dev and the unpacked build run as electron.exe.
- Precise visuals: read the pet canvas through CDP (`getImageData` / `convertToBlob`) instead of screen captures, which are too slow for short frames.
- Menus: Electron popup menus are `Chrome_WidgetWin_1` windows with no title (not Win32 `#32768`); open with `window.petApi.showContextMenu()` via CDP, then PostMessage WM_KEYDOWN to that window only.
- Message boxes (e.g. "Adopt a new cat?"): `#32770` task dialog owned by electron.exe with real `Button` children; SendMessage BM_CLICK to the button by its text.
- Care test data: the engine reads pet.json only at startup, so write a test pet.json into %APPDATA%\desktop-pet-dev before launching ({version 1, name, species "cat", adoptedAt, needs {hunger, happiness}, updatedAt, counters}); move updatedAt back to simulate time closed. Delete it afterwards.
- Strokes: send the mouse moves from one CDP connection about 25 ms apart; one process per move is too slow to count as a stroke.
- Startup timing: performance mark `pet:first-frame` vs the process StartTime.

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
| M4 | Tray menu | done | user hand check 2026-11-06: left click toggles, right click opens the menu |
| M4 | Settings window and persistence | done | all 5 settings apply live and survive restart; right-click menu -> Settings verified |
| M4 | Auto-start and single instance | done | Run key written by installed app, removed on uninstall; dev never registers |
| M4 | NSIS installer | done | 108 MB, per-user, install/update/uninstall verified clean |
| - | Replace 3D cat with 2D sprite | done | user's claude.ai sheet; verified dev, production, installer |
| M5 | Measure against NFRs, fix bugs | done | NFR-01..04 pass; FR-16 pass (hand check); NFR-05 deferred by user |
| M5 | Release v1.0 | done | 1.0.0 installer built and installed; tag v1.0.0 not created yet |
| v2 | Requirements (requirement-v2.md) | done | approved by the user 2026-11-06 |
| V2-M1 | Care sheet, multi-sheet model, eat/happy/hungry/pet clips | done | feet aligned across sheets; sprite:prepare tool |
| V2-M2 | Needs engine, pet.json, offline decay, moods | done | 103 tests; restart and offline gap checked in the app |
| V2-M3 | Feed, pet (stroke + menu), click bonus, hungry reminder | done | 118 tests; every action checked in the app |
| V2-M4 | Adoption, settings Pet section, tooltip, tray | done | 125 tests; adopt, rename, re-adopt, no-pet start checked in the app; tray by hand pending |
| V2-M5 | Polish, measure, installer, release v2.0 | done | gate passed; 2.0.0 installed over 1.0.0; tray hand check pending |

## Phase approvals

| Phase | Finished | Approved to continue |
| --- | --- | --- |
| M1 | 2026-11-06 | yes, 2026-11-06 |
| M2 | 2026-11-06 | yes, 2026-11-06 |
| M3 | 2026-11-06 | yes, 2026-11-06 (user checked drag by hand: smooth) |
| M4 | 2026-11-06 | yes, 2026-11-06 |
| M5 | 2026-11-06 | v1 complete; user then approved requirement-v2.md and V2-M1 |
| V2-M1 | 2026-11-06 | yes, 2026-11-06 |
| V2-M2 | 2026-11-06 | yes, 2026-11-06 |
| V2-M3 | 2026-11-06 | yes, 2026-11-06 |
| V2-M4 | 2026-11-06 | yes, 2026-11-06 (tray hand check still pending) |
| V2-M5 | 2026-11-06 | waiting |

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
- 2026-11-06: User asked about a 2D sprite instead of 3D and provided assets/sprites-inbox/cat_spritesheet.png (made with claude.ai). Checked: real alpha (80.5 % transparent), 1536x1152 = 8x6 cells of 192 px, feet at y=177 in every grounded frame, no frame crosses its cell, empty cells clean. All 6 clips present. No 2x version.
- 2026-11-06: Decision (user): replace 3D (not keep both). TresJS question is moot. Committed M1-M4 first as restore point 42360ca (user chose "commit first").
- 2026-11-06: Sprite: assets/models/cat-sprite.png + cat-sprite.json (grid, anchor, displayScale, edgeOverflow, walkFacing, clips with frameMs/fps, loop, loopFrom) + cat-sprite.LICENSE.txt. drag = intro frame 0 then loop 1-2; sleep = intro 0-4 then loop 5-7.
- 2026-11-06: Code: src/shared/modelConfig.ts rewritten for sprites (tested, incl. the shipped JSON), src/shared/activeModel.ts (static import used by main and renderer), src/renderer/lib/spriteTimeline.ts (frame at time; tested), lib/spriteLayout.ts (fit, feet bottom-center, mirror; tested), usePetScene.ts rewritten on Canvas 2D: timer per frame (no render loop), alpha-mask hit test, mirror for walking left. Window size and edge overflow come from the model (192x192 DIP at size 1).
- 2026-11-06: Removed: scripts/cat/, generate-cat.mts, .glb models, frameLimiter, three and @types/three, model:build script, 3D camera/light config. Facing is now left/right; the cat keeps its last facing after a walk.
- 2026-11-06: Verified (dev, CDP): idle frame order, click -> click -> idle, empty-area clicks ignored, sleep intro then loop, walk left mirrored / right as drawn and the window moves, drag -> land -> idle. Production: file:// sheet does not taint the canvas, hit test toggles click-through. Installed build: shows the sprite, visible in 0.8 s, uninstall clean.
- 2026-11-06: Production idle: CPU 0.10 % of the machine (3D was 0.36 %), private RAM 168 MB (was 189). Renderer JS 23 KB (was 1.5 MB). Installer 108 MB.
- 2026-11-06: requirement.md (sections 1, 2, 3, 6, 7, 9, 10, 11) and CLAUDE.md updated for the sprite. Not done: light outline for dark effects (user did not ask), 2x art.
- 2026-11-06: User approved M5. Decision (user): FR-16 fullscreen detection via koffi (runtime dep) calling shell32 SHQueryUserNotificationState.
- 2026-11-06: koffi 3.x needs its install script (download/build), which npm 11 blocks. Used koffi 2.16.3 instead: it ships prebuilt binaries, works without the install script. Verified the installed app loads koffi.node from app.asar.unpacked.
- 2026-11-06: FR-16: src/main/fullscreenWatcher.ts polls SHQueryUserNotificationState every 2 s (lib/notificationState.ts maps BUSY, D3D fullscreen, presentation = fullscreen; tested). Main hides the pet while fullscreen and shows it again after, unless the user hid it from the tray. Renderer: sprite clock pauses on visibilitychange and resumes mid-clip (verified via Hide from the menu, then show via a second launch).
- 2026-11-06: Click lead frame shortened to 34 ms (NFR-04 margin). One-time performance mark 'pet:first-frame' added for NFR-03.
- 2026-11-06: Measured (see requirement.md section 14): NFR-01 CPU 0.05 %, RAM 170 MB; NFR-03 330-350 ms; NFR-04 clip start 2.7 ms, visible change 41 ms. Accelerated leak test: 68 + 44 cycles of every behavior; heap +70 KB on the first run (warm-up), +4 KB on the second; a control run with only CDP calls stayed flat; process RAM flat.
- 2026-11-06: Version 1.0.0. npm audit: 0 issues in production deps; 16 moderate in dev tooling only. Installer desktop-pet-setup-1.0.0.exe 108.6 MB, installed and running normally (no debug port) for the 8 h soak.
- 2026-11-06: Not testable here: Windows 10, multiple monitors. FR-08 (Could) not in v1.
- 2026-11-06: User checked the tray by hand: left click toggles the pet, right click opens the menu. Pass. Sprite + M5 commit: message prepared, user runs it (classifier errors blocked it here).
- 2026-11-06: User checked fullscreen by hand (F11 / fullscreen video): the pet hides and comes back. FR-16 pass. Only NFR-05 (8 h soak) is left for the M5 gate.
- 2026-11-06: Decision (user): skip the 8 h soak for now. Stopped it after 15 min (185.6 -> 188.8 -> 204.3 MB private, during tray/fullscreen hand tests; too short to judge). NFR-05 marked Deferred in requirement.md sections 12-14; added to open questions. M5 closed.
- 2026-11-06: User provided assets/sprites-inbox/cat_care_spritesheet.png (eat, happy, hungry, pet/adopt rows; 1792x896, 8x4 cells of 224 px, transparent, feet ~y=210; cat pixels alpha 251-254). Asked 4 design questions; user chose hunger + happiness, slow decay while closed with a floor, gentle neglect, row 4 for both adopt and pet. Drafted requirement-v2.md (FR-17..34, NFR-11..15, V2-M1..M5); linked from requirement.md and CLAUDE.md. Not approved yet; no v2 code.
- 2026-11-06: User approved requirement-v2.md. Status updated in requirement-v2.md, requirement.md and CLAUDE.md. V2-M1 waits for a go-ahead.
- 2026-11-06: User said go for V2-M1. Started V2-M1.
- 2026-11-06: V2-M1: scripts/lib/png.mts (8-bit RGBA PNG decode/encode, node:zlib only), scripts/lib/spritePrep.mts (near-opaque alpha >= 240 -> 255, clear faint specks < 32 alpha more than 3 px from the art, per-cell boxes; tested), `npm run sprite:prepare`. Care sheet -> assets/models/cat-care.png: 325,816 px made solid, 1,024 stray specks (alpha 1-6) cleared, colors unchanged. Edge brightness matches the v1 sheet, so no dark-wallpaper halo.
- 2026-11-06: Model config now has `sheets` (file, grid, anchor, optional scale per sheet) and each clip names its sheet. modelFrame() fits all sheets with every feet anchor on one point (224 x 225 frame). Care clips eat/happy/hungry/pet added (CARE_CLIPS, optional). Scene loads all sheets with an alpha mask each. Dev hook __petDebug.playClip previews any clip; a one-off clip returns to the state's clip when it ends.
- 2026-11-06: Verified in dev via canvas pixels: feet bottom 263-266 canvas px for idle (main sheet) and all care clips (happy's jump frame excepted); contact sheet with a feet line looks right. Production build loads both sheets from file://; hit test OK. Care cat is drawn a bit rounder (head ~5-8 % bigger); sheet scale left at 1.
- 2026-11-06: Window sizes now snap up to multiples of 4 DIP and the start position to the 4 DIP grid (placement.ts WINDOW_GRID; tested): 225 DIP x 1.25 = 281.25 px made Windows create the window a few px too big. Default position now exact (280x285 px). Known cosmetic issue: at one restored position the window is still 3 px taller than asked; it is transparent space under the feet, harmless.
- 2026-11-06: Checks: typecheck, lint, test (64), build pass. Installed v1.0.0 relaunched for the user after testing. V2-M1 gate passed; waiting for approval to start V2-M2.
- 2026-11-06: WORK-LOG prepared for a new session: current state rewritten (git, machine state, open items), test how-to added, V2 rows in both tables.
- 2026-11-06: User approved V2-M2. Started V2-M2. Decision: needs kept at full precision in memory and pet.json (rounding every 60 s tick would drift 10/h to 12/h); rounded only for display. requirement-v2.md section 4 updated.
- 2026-11-06: V2-M2 code: src/shared/careConfig.ts (all section 4 tuning, NFR-14), src/shared/needs.ts (pure: advanceNeeds with exact piecewise hungry multiplier, offline floor, sleep rate, clock-backwards safe; runningMode treats a gap > 5 min as offline; moodOf; feed/pet/click with cooldowns), src/shared/petRecord.ts (createPet, parse/validate, name 1-20 visible characters via Intl.Segmenter so Thai marks do not count), src/main/petStore.ts (read/atomic write/delete; damaged file -> pet.json.bad), src/main/careEngine.ts (load + offline catch-up, 60 s tick + save, setAsleep, adopt/wipe/feed/pet/click, onChange; no Electron imports).
- 2026-11-06: Main wiring: care engine loads userData/pet.json at start, ticks every 60 s, sleeps with the user-idle watcher, flushes on quit. No pet yet means it stays inactive (adoption UI is V2-M4; feed/pet IPC is V2-M3).
- 2026-11-06: Tests: 103 pass (39 new: needs math incl. "one step == many small steps", engine with temp dir + fake clock, records, Thai name lengths).
- 2026-11-06: App check (production build, dev data folder, hand-written test pet.json): saved 2 h ago -> launch gives hunger 74.999 / happiness 75.832 (expected 75.000 / 75.833); 60 s tick saved at the sleep rate (user away); normal quit flushed; simulated 3 h closed -> 67.339 / 69.449 (expected ~67.36 / ~69.46); garbage pet.json -> moved to pet.json.bad, app runs. Test files removed afterwards. V2-M2 gate passed; waiting for approval to start V2-M3.
- 2026-11-06: User approved V2-M3. Started V2-M3.
- 2026-11-06: V2-M3 code: careConfig behavior + stroke tuning; src/renderer/lib/strokeDetector.ts (3 reversals within 1.5 s over the cat, moves < 6 DIP ignored, reset when leaving the cat or pressing; tested), lib/careBehavior.ts (idleAction: hungry reminder at most every 10 min; wanderDelayMs x2 when sad; clickReaction: happy 50 % when the mood is happy; tested), petMachine states eat/happy/hungry/pet with events feed/refuseFood/pet/clickHappy/hungryReminder (tested).
- 2026-11-06: IPC: care:state (main -> pet, mood or null), care:request (menu Feed/Pet -> pet), care:act (pet -> main: feed/pet/click -> {counted, refused}). Design: the renderer gates every care action on the state machine, then main applies it, so a care action during another care animation changes nothing (first version applied menu feeds in main first; fixed). Click bonus only counts when the click reaction plays.
- 2026-11-06: Menus: Feed (+ Pet in the right-click menu) at the top only when a pet exists; tray gets Feed. Feeding from the tray shows a hidden pet. Scene: play(clip, { once }) plays the looping hungry clip a single time. App: usePetStroke on window mousemove (forwarded while click-through is on). About text no longer says 3D.
- 2026-11-06: Tests: 118 pass. App check (dev, hand-written pet.json, CDP + posting keys to the app's own menu window only): click +2; Feed 50 -> 90 / +5 with eat; Feed to 100; Feed when full -> click clip, needs unchanged; 2nd Feed during eat ignored (20 -> 60 once); menu Pet +15; fast stroke from idle -> pet +15; straight sweep -> nothing; hungry pet: wander timer plays hungry once then idle, next timer walks; happy pet: 8 clicks gave 4 happy / 4 click; no pet: menu has no Feed/Pet, clicks work as v1. Test pet files removed. Sad wander x2 is unit tested only. V2-M3 gate passed; waiting for approval to start V2-M4.
- 2026-11-06: User approved V2-M4. Started V2-M4. FR-29 (hungry notification, Could) left out: still an open question.
- 2026-11-06: V2-M4 code: engine.rename (tested); shared/careText.ts careSummary "Name · Fed 72% · Happy 85% · Content" (tested); petMachine state `welcome` (plays the pet clip, then happy; clipFor maps state -> clip; tested). New page adopt.html + preload adopt.ts (adoptApi.adopt only); settings preload gains getCare/onCareChanged/renamePet/adoptNew/openAdopt; CareView (name, needs, mood, adoptedAt) goes to the pet and settings windows. settingsWindow.ts now has one tool-window factory for settings and adoption.
- 2026-11-06: Main: no pet -> pet window stays hidden (hide() on ready-to-show so the page reports hidden and pauses) and the adoption window opens (also on a second launch); adopt -> window closes, pet shows and plays the welcome scene; "Adopt a new cat..." -> native confirm (Cancel is the default) -> wipe pet.json, hide the pet, open adoption. Tray: with a pet Feed / show-hide / Pet status... / Settings / About / Quit, before adoption Adopt a cat... / Settings / About / Quit; tray tooltip shows the care summary. Pet canvas title = care summary while hovering the cat (FR-27).
- 2026-11-06: Settings: "Your cat" section on top (name + Save name with validation, Fed/Happy meters, mood, adopted date, Adopt a new cat...; or "You have no cat yet." + Adopt). Settings window 440 x 620.
- 2026-11-06: Pitfall: the installed v1.0.0 app also has a window titled "Desktop Pet"; window checks by title must filter by process (the scratchpad helper now does).
- 2026-11-06: App check (dev, CDP into the app's pages, BM_CLICK to the app's own message box buttons): no pet -> only the adoption window, pet page hidden, settings.json kept (= upgrade from v1 path); adopt "มะลิ" -> pet.json 80/80, window closed, pet visible, welcome -> happy -> idle; tooltip shows the summary over the cat and nothing off it; rename "   " rejected with a message, "ส้มจี๊ด" saved and the tooltip follows; Adopt a new cat -> Cancel keeps everything, Delete and adopt removes pet.json, hides the pet, opens adoption, settings shows "no cat"; closing adoption keeps the app running; second launch reopens adoption. Not checked: tray menu and tray tooltip (needs a hand check). Tests 125. V2-M4 gate passed; waiting for approval to start V2-M5.
- 2026-11-06: Handoff check: fixed stale notes (remote origin exists and origin\/main is at 171ec84, not "nothing pushed"), added machine state, pending user items and v2 test know-how to WORK-LOG; CLAUDE.md now covers the v2 states, care clips, care sheet, multi-sheet window sizing, three pages\/preloads and pet.json.
- 2026-11-06: User asked for AGENTS.md with the same content as CLAUDE.md. Created it (same body; header names AGENTS.md and says to keep both identical). When CLAUDE.md changes, update AGENTS.md too.
- 2026-11-06: User asked to push. Pushed main to origin (171ec84..8d65ddc).
- 2026-11-06: User approved V2-M5. Started V2-M5 (tuning, NFR-01/11, acceptance criteria, 2.0.0 installer). Baseline: typecheck, lint, 125 tests pass.
- 2026-11-06: Review of care code: fixed a double feed when Feed is sent twice before main answers (usePetBehavior feedInFlight). Tuning defaults kept (open question for the user). package.json description no longer says 3D.
- 2026-11-06: Version 2.0.0 (package.json, package-lock). Production build with a test pet: CPU 0.12 % of machine, private RAM 184 MB (NFR-01/11 pass). Damaged pet.json in the real app -> pet.json.bad + adoption window (FR-33 pass). Test pet files removed. Results in requirement-v2.md section 16.
- 2026-11-06: npm run dist -> dist/desktop-pet-setup-2.0.0.exe (114.9 MB). Not installed yet: waiting for the user to OK installing over the running v1.0.0 (upgrade path, NFR-15).
- 2026-11-06: Stopped v1.0.0, ran desktop-pet-setup-2.0.0.exe /S (exit 0, Uninstall entry 2.0.0). Launched: adoption window, settings.json byte-identical to the v1 backup, Run key kept (NFR-15 pass). Ticked all section 14 acceptance criteria. V2-M5 gate passed; waiting for approval. Changes not committed yet.
