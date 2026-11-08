# Requirement: Desktop Pet for Windows (Vue + Electron)

Last updated: 2026-11-06 (M4: storage and state decisions). Source of truth for the project. Read this when unsure.

## 1. Overview

A 2D sprite cat that lives on the Windows desktop (a 3D cat was used through M4; replaced by a sprite on 2026-11-06, see section 9). The user can click and drag it while still using other programs normally. Built with Vue and packaged with Electron.

Goals:
- Show a pet floating on the screen that reacts to click and drag.
- Do not disturb normal work: the mouse passes through transparent areas to the programs behind.
- Light enough to run all day without heating up or slowing the machine.
- Adding or swapping the model must not require changing core code.

Decisions made:
- The pet is a cat. Personal use only, not distributed. Claude (via Claude Code) is the sole developer.
- v2: pet-care system. Only one pet at a time. Adopting a different pet means starting over and wiping the previous pet's data immediately. Requirements: requirement-v2.md (approved 2026-11-06, released as 2.0.0).
- v3: focus timer (Pomodoro) and Thai/English UI. Requirements: requirement-v3.md (approved 2026-11-06, released as 3.0.0).
- v4: hungry notification, focus history, optional focus treats, sad/look/stretch/yawn clips, 8-hour memory run. Requirements: requirement-v4.md (approved 2026-11-06, released as 4.0.0, accepted 2026-11-07 with the 8-hour run NFR-22 deferred).
- v5: gravity (a dropped cat falls to the taskbar), window perches (the cat sits and walks on other windows' top edges), jump and climb (needs cat-move.png). Requirements: requirement-v5.md (approved 2026-11-07; done and accepted 2026-11-08, released as 5.0.0).
- v6: activity log. Care and focus events go to the user's own server (Node + MySQL on a VPS, pm2) when the user turns it on, with an offline outbox and a web dashboard. This allows one kind of network call (requirement-v6.md section 7) and changes NFR-06/07 as noted there. Requirements: requirement-v6.md (approved 2026-11-08; V6-M1..M3 done and approved 2026-11-08, V6-M4 deploy and V6-M5 release to come).
- v7: choose the cat's look (coat color); looks share the current sprite layout. Requirements: requirement-v7.md (approved 2026-11-08; started 2026-11-08 before V6-M4/M5, which wait for the VPS).

## 2. Scope

v1 in scope:
- One sprite-animated cat with basic animations.
- Click, drag, drop, and mouse click-through on transparent areas.
- System tray icon and a basic settings page.
- Windows installer that installs and uninstalls cleanly.

v1 out of scope:
- macOS and Linux.
- Multiple pets at the same time (never: one pet at a time, also in v2).
- Pet-care mechanics: hunger and happiness planned for v2 (requirement-v2.md); money and shop moved to a later version.
- Accounts, online, or cloud sync. (v6 adds an optional activity log to the user's own server, requirement-v6.md; still no sync back and no accounts for others.)
- Model shop or plugin system.

## 3. Users and environment (assumptions)

| Topic | Requirement |
| --- | --- |
| User | The owner, personal use |
| OS | Windows 10 (64-bit) or newer, tested on 10 and 11 |
| GPU | Any (2D canvas; no WebGL needed) |
| Memory | 4 GB RAM or more |
| Display | Multiple monitors, DPI scaling 100% to 200% |
| Internet | Not required to run |

## 4. Functional requirements

Priority: Must / Should / Could. v1 has 16 items, 8 are Must.

| ID | Area | Requirement | Priority |
| --- | --- | --- | --- |
| FR-01 | Pet | Show the pet in a transparent, frameless window that stays on top of the screen | Must |
| FR-02 | Pet | Loop the idle animation when there is no interaction | Must |
| FR-03 | Pet | Clicking the pet plays a reaction animation | Must |
| FR-04 | Pet | Drag the pet anywhere on screen and remember the last position on next launch | Must |
| FR-05 | Pet | Mouse passes through transparent areas; clicks land only on the model | Must |
| FR-06 | Pet | Walk around by itself now and then while idle, within screen bounds | Should |
| FR-07 | Pet | Sleep when the user has not used the machine for a configured time | Should |
| FR-08 | Pet | Turn its head toward the mouse when the mouse is near | Could |
| FR-09 | App control | System tray icon with menu: show/hide, settings, quit | Must |
| FR-10 | App control | Right-click the pet to open a context menu | Should |
| FR-11 | App control | Settings for size, opacity, always-on-top on/off | Should |
| FR-12 | App control | Start with Windows, toggle in settings | Should |
| FR-13 | App control | Only one instance of the app per machine (single instance) | Must |
| FR-14 | App control | Save settings and position locally | Must |
| FR-15 | Environment | Support multiple monitors and DPI scaling | Should |
| FR-16 | Environment | Stop or reduce rendering when hidden or when a fullscreen app is in front | Should |

## 5. Non-functional requirements

Initial targets. Tune after measuring on the target machine.

| ID | Topic | Target |
| --- | --- | --- |
| NFR-01 | Resources | CPU at most 5% and RAM at most 300 MB while idle |
| NFR-02 | Frame rate | Render at 30 fps while moving; stop when hidden or not moving |
| NFR-03 | Startup | Pet appears within 5 seconds of launch |
| NFR-04 | Responsiveness | Click animation starts within 100 ms |
| NFR-05 | Stability | Runs 8 hours with no continuous memory growth (no leaks) |
| NFR-06 | Security | contextIsolation on, nodeIntegration off, no remote content |
| NFR-07 | Privacy | No user data collected or sent off the machine (v6 exception: activity events to the user's own server, only when turned on; requirement-v6.md section 7) |
| NFR-08 | Installation | Single .exe installer; uninstall leaves no stray files |
| NFR-09 | Size | Installer at most 200 MB |
| NFR-10 | Maintainability | TypeScript and ESLint; models and animations driven by config, not hardcoded |

## 6. Tech stack

| Layer | Technology | Notes |
| --- | --- | --- |
| UI | Vue 3 (Composition API) + TypeScript | |
| Build | Vite + electron-vite | Quick Electron + Vue setup, hot reload |
| Desktop shell | Electron | Transparent window, always on top, click-through |
| Graphics | Canvas 2D sprite sheet | Replaced Three.js (3D) on 2026-11-06: lighter and matches the art. The 3D version is in git commit 42360ca. |
| Model | PNG sprite sheet + JSON config | One sheet per model; clips, timing and anchor in the JSON |
| State | Vue composables | Pet state and settings (Pinia dropped in M4: too small to need it) |
| Settings storage | Own JSON store in main (atomic write, validated) | JSON file in the user app data folder, no database (electron-store dropped in M4 to keep deps minimal) |
| Native calls | koffi (FFI, prebuilt, no install script) | FR-16: shell32 SHQueryUserNotificationState every 2 s to detect a fullscreen app (added in M5, user decision) |
| Packaging | electron-builder (NSIS) | Windows .exe installer |
| Tests | Vitest | Behavior logic and settings |

Considered and not chosen for v1: Tauri (smaller, but needs Rust for system features) and Babylon.js (similar to Three.js, smaller community around Vue).

## 7. Architecture

Two processes talk through a preload bridge (IPC).

- Main process (Node.js): transparent window (frameless, always on top, click-through), tray and menu, settings store, system (single instance, auto-start, detect idle machine).
- Preload: exposes a small typed API to the renderer via contextBridge.
- Renderer (Vue 3 + Canvas 2D): sprite scene (load the sheet, play clips), click/drag detection (per-pixel alpha hit test), behavior controller (idle, walk, dragged, sleep), settings UI (Vue + composables).

The renderer never calls the system directly; it sends commands through the preload.

Proposed structure:

```
src/main/        window, tray, settings store, IPC
src/preload/     expose functions to the renderer via contextBridge
src/renderer/    Vue app: sprite scene, behavior, settings UI
assets/models/   sprite sheets (.png) with a JSON config and license note per model
```

## 8. UI/UX

| Event | Pet reaction |
| --- | --- |
| App opens | Appears with a welcome animation, at the last position or lower right on first launch |
| No interaction | Loops idle and walks now and then |
| Mouse comes near | Turns its head to look (if FR-08 is done) |
| Left click | Plays the reaction once, then back to idle |
| Press and drag | Shows a picked-up pose and follows the mouse |
| Release mouse | Drops at the new position and saves it |
| Right click | Context menu: hide, settings, quit |
| Machine unused for long | Goes to sleep; wakes when the user returns |

Tray menu: show/hide pet, settings, about, quit.

Settings (5 items): pet size, opacity, always on top on/off, start with Windows on/off, idle time before sleeping.

## 9. Pet model and animation

Decision 2026-11-06 (user): the 3D .glb cat was replaced by a 2D sprite sheet. The 3D version (procedural rigged cat, Three.js renderer) is kept in git commit 42360ca.

The model is a PNG sprite sheet plus a JSON config next to it (assets/models/). Clips are named per the standard below, so the model can be swapped without code changes.

| Clip | Used when | Playback |
| --- | --- | --- |
| idle | No interaction | Loop |
| walk | Walking by itself | Loop |
| click | User clicks | Once |
| drag | Being dragged | Loop |
| land | Released after drag | Once |
| sleep | Machine unused for long | Loop |

Sprite sheet rules:
- PNG with a real alpha channel (transparent background); the alpha drives click-through hit tests.
- Regular grid of equal cells, one clip per row starting at column 0.
- Feet at the same height in every grounded frame (the config's anchor), so frames do not jitter.
- Walk frames face one direction (config `walkFacing`); the other direction is mirrored.
- Looping clips may have an intro that plays once (config `loopFrom`), for example sleep: lie down, then loop.
- Frame timing per clip (`fps` or per-frame `frameMs`), never faster than 30 fps.
- Sheet at most 4096 x 4096 px and 10 MB.
- Self-made art or a clear license; keep the license note next to the file.

Current model: assets/models/cat-sprite.png, 8 x 6 cells of 192 px, generated by the project owner with Claude (claude.ai). License note: assets/models/cat-sprite.LICENSE.txt. No 2x version yet, so it is slightly soft at 125-200 % DPI.

## 10. Milestones

Each phase must pass its own gate before the next phase starts. When a phase ends, notify the user and wait for approval.

| Phase | Work | Gate |
| --- | --- | --- |
| M1 | Scaffold: Vue 3, Electron, transparent window | Transparent always-on-top window and click-through works |
| M2 | Show the model, play idle (done with the 3D .glb; now a sprite) | Cat animates on the desktop |
| M3 | Interaction: click, drag, drop, auto-walk, sleep | Click and drag are smooth; transparent area never blocks the mouse |
| M4 | Tray, settings, persistence, auto-start, installer | Install, use, and uninstall all work |
| M5 | Test and release | NFRs and acceptance criteria all pass; release v1.0 |

No dates are set (team size and time unknown).

## 11. Risks and mitigation

| Risk | Mitigation |
| --- | --- |
| Click-through on transparent areas is inconsistent in some setups (multi-monitor, high DPI) | Test from M1; fallback: size the window to fit the model and move the window with it |
| Rendering uses many resources; machine heats up or lags | Sprite frames change only on a timer at their own pace (max 30 fps); nothing runs between frames |
| Model and animation licensing | Use a self-made model or a clearly licensed one; keep license evidence |
| Windows SmartScreen warns about an unsigned installer | Personal use: accept the warning; use a code-signing certificate only if distributed |
| Installer too large | Remove unused dependencies, compress model and textures |

## 12. Acceptance criteria (v1)

- [~] Install on Windows 10 and 11 and the pet appears on the desktop (Windows 11: pass. Windows 10: not tested, no machine)
- [x] Click, drag, and drop work; next launch is at the same position
- [x] Clicking a transparent area passes the click to the program behind
- [x] Tray menu works fully: show/hide, settings, quit (user hand check 2026-11-06: left click toggles the pet, right click opens the menu)
- [~] Meets NFR-01 to NFR-05 on the target machine (NFR-01..04 pass, see section 14; NFR-05 deferred, accelerated test only)
- [ ] Runs 8 hours with no continuous memory growth (deferred by the user on 2026-11-06; accelerated test showed no growth, see section 14)
- [x] After uninstall no stray files remain

## 13. Open questions

- NFR-05: run the real 8 hour memory test (deferred after v1.0, 2026-11-06). The first 15 minutes rose 185.6 -> 204.3 MB; check whether it levels off. If it keeps growing, fix in v1.0.1.
- v2 pet-care system: approved in requirement-v2.md (2026-11-06); its own open questions are listed there.
- Development time frame (milestones have no dates yet).

## 14. v1.0 measurements (2026-11-06, target machine)

Windows 11 Pro, 16 logical CPUs, one 2560 x 1600 display at 125 % scaling. Sprite build 1.0.0.

| ID | Target | Measured | Result |
| --- | --- | --- | --- |
| NFR-01 | CPU <= 5 %, RAM <= 300 MB idle | CPU 0.05 % of the machine (2 min, incl. a walk); private RAM 170 MB | Pass |
| NFR-02 | 30 fps while moving, stop when hidden or still | Frames change only on their own timer (max 30 fps); clock pauses while hidden | Pass |
| FR-16 | Stop when hidden or a fullscreen app is in front | Hidden: clock pauses (tested). Fullscreen: user hand check (browser F11 / fullscreen video): the pet hides and comes back after | Pass |
| NFR-03 | Visible within 5 s | 330-350 ms from process start to first sprite frame (warm); first launch right after install was about 11 s once (likely a first-run scan) | Pass |
| NFR-04 | Click reaction within 100 ms | Clip starts 2.7 ms after pointerup; first visibly different frame 41 ms | Pass |
| NFR-05 | No memory growth over 8 h | Accelerated: 117 cycles of click/drag/walk/sleep, JS heap after GC +4 KB on the second run, process RAM flat. Real 8 h run stopped after 15 min by user decision: 185.6 -> 188.8 -> 204.3 MB private (during tray/fullscreen hand tests; too short to tell warm-up from growth) | Deferred |
| NFR-08 | Clean uninstall | No folders, shortcuts, Run/StartupApproved values or uninstall entry left | Pass |
| NFR-09 | Installer <= 200 MB | 108.6 MB | Pass |

Not covered on this machine: Windows 10, multiple monitors (FR-15), mixed-DPI monitors. FR-08 (head follows the mouse, Could) is not in v1: the sprite has no frames for it.
