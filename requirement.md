# Requirement: 3D Desktop Pet for Windows (Vue + Electron)

Last updated: 2026-11-06 (M4: storage and state decisions). Source of truth for the project. Read this when unsure.

## 1. Overview

A 3D cat that lives on the Windows desktop. The user can click and drag it while still using other programs normally. Built with Vue and packaged with Electron.

Goals:
- Show a 3D pet floating on the screen that reacts to click and drag.
- Do not disturb normal work: the mouse passes through transparent areas to the programs behind.
- Light enough to run all day without heating up or slowing the machine.
- Adding or swapping the model must not require changing core code.

Decisions made:
- The pet is a cat. Personal use only, not distributed. Claude (via Claude Code) is the sole developer.
- v2: pet-care system. Only one pet at a time. Adopting a different pet means starting over and wiping the previous pet's data immediately.

## 2. Scope

v1 in scope:
- One 3D cat with basic animations.
- Click, drag, drop, and mouse click-through on transparent areas.
- System tray icon and a basic settings page.
- Windows installer that installs and uninstalls cleanly.

v1 out of scope:
- macOS and Linux.
- Multiple pets at the same time (never: one pet at a time, also in v2).
- Pet-care mechanics (hunger, happiness, money, shop): planned for v2.
- Accounts, online, or cloud sync.
- Model shop or plugin system.

## 3. Users and environment (assumptions)

| Topic | Requirement |
| --- | --- |
| User | The owner, personal use |
| OS | Windows 10 (64-bit) or newer, tested on 10 and 11 |
| GPU | WebGL 2 support (integrated graphics is fine) |
| Memory | 4 GB RAM or more |
| Display | Multiple monitors, DPI scaling 100% to 200% |
| Internet | Not required to run |

## 4. Functional requirements

Priority: Must / Should / Could. v1 has 16 items, 8 are Must.

| ID | Area | Requirement | Priority |
| --- | --- | --- | --- |
| FR-01 | Pet | Show the 3D model in a transparent, frameless window that stays on top of the screen | Must |
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
| NFR-07 | Privacy | No user data collected or sent off the machine |
| NFR-08 | Installation | Single .exe installer; uninstall leaves no stray files |
| NFR-09 | Size | Installer at most 200 MB |
| NFR-10 | Maintainability | TypeScript and ESLint; models and animations driven by config, not hardcoded |

## 6. Tech stack

| Layer | Technology | Notes |
| --- | --- | --- |
| UI | Vue 3 (Composition API) + TypeScript | |
| Build | Vite + electron-vite | Quick Electron + Vue setup, hot reload |
| Desktop shell | Electron | Transparent window, always on top, click-through |
| 3D | Three.js via TresJS | TresJS writes the 3D scene as Vue components (alternative: plain Three.js) |
| Model | glTF / GLB | Single file with built-in animations |
| State | Vue composables | Pet state and settings (Pinia dropped in M4: too small to need it) |
| Settings storage | Own JSON store in main (atomic write, validated) | JSON file in the user app data folder, no database (electron-store dropped in M4 to keep deps minimal) |
| Packaging | electron-builder (NSIS) | Windows .exe installer |
| Tests | Vitest | Behavior logic and settings |

Considered and not chosen for v1: Tauri (smaller, but needs Rust for system features) and Babylon.js (similar to Three.js, smaller community around Vue).

## 7. Architecture

Two processes talk through a preload bridge (IPC).

- Main process (Node.js): transparent window (frameless, always on top, click-through), tray and menu, settings store, system (single instance, auto-start, detect idle machine).
- Preload: exposes a small typed API to the renderer via contextBridge.
- Renderer (Vue 3 + Three.js): 3D scene (load .glb, play animations), click/drag detection (Raycaster), behavior controller (idle, walk, dragged, sleep), settings UI (Vue + composables).

The renderer never calls the system directly; it sends commands through the preload.

Proposed structure:

```
src/main/        window, tray, settings store, IPC
src/preload/     expose functions to the renderer via contextBridge
src/renderer/    Vue app: 3D scene, behavior, settings UI
assets/models/   .glb files and a config per model
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

## 9. 3D model and animation

The model must be a .glb file with a skeleton (rig) and animations named per the standard below, so the model can be swapped without code changes.

| Clip | Used when | Playback |
| --- | --- | --- |
| idle | No interaction | Loop |
| walk | Walking by itself | Loop |
| click | User clicks | Once |
| drag | Being dragged | Loop |
| land | Released after drag | Once |
| sleep | Machine unused for long | Loop |

Model file limits (initial targets):
- At most 20,000 triangles; textures at most 2048 x 2048 pixels.
- File at most 10 MB per model.
- Reference point at the feet so it can stand on the ground and walk at the right position.
- Use a self-made model or one with a clear license that allows use; keep the license evidence.

Model plan: Claude builds the cat in code (low-poly, primitives, rigged, procedural animations) and exports .glb. Colors and pattern configurable. A third-party model can replace it later.

## 10. Milestones

Each phase must pass its own gate before the next phase starts. When a phase ends, notify the user and wait for approval.

| Phase | Work | Gate |
| --- | --- | --- |
| M1 | Scaffold: Vue 3, Electron, transparent window | Transparent always-on-top window and click-through works |
| M2 | Show the 3D model: load .glb, play idle | Cat animates on the desktop |
| M3 | Interaction: click, drag, drop, auto-walk, sleep | Click and drag are smooth; transparent area never blocks the mouse |
| M4 | Tray, settings, persistence, auto-start, installer | Install, use, and uninstall all work |
| M5 | Test and release | NFRs and acceptance criteria all pass; release v1.0 |

No dates are set (team size and time unknown).

## 11. Risks and mitigation

| Risk | Mitigation |
| --- | --- |
| Click-through on transparent areas is inconsistent in some setups (multi-monitor, high DPI) | Test from M1; fallback: size the window to fit the model and move the window with it |
| 3D on Electron uses many resources; machine heats up or lags | Cap 30 fps, stop rendering when still, reduce model and texture detail |
| Model and animation licensing | Use a self-made model or a clearly licensed one; keep license evidence |
| Machine without WebGL 2 or with hardware acceleration off | Detect at startup, tell the user, consider a 2D fallback |
| Windows SmartScreen warns about an unsigned installer | Personal use: accept the warning; use a code-signing certificate only if distributed |
| Installer too large | Remove unused dependencies, compress model and textures |

## 12. Acceptance criteria (v1)

- [ ] Install on Windows 10 and 11 and the pet appears on the desktop
- [ ] Click, drag, and drop work; next launch is at the same position
- [ ] Clicking a transparent area passes the click to the program behind
- [ ] Tray menu works fully: show/hide, settings, quit
- [ ] Meets NFR-01 to NFR-05 on the target machine
- [ ] Runs 8 hours with no continuous memory growth
- [ ] After uninstall no stray files remain

## 13. Open questions

- v2 pet-care system: which needs and interactions (hunger, happiness, interactions), and whether other species besides the cat will exist.
- Development time frame (milestones have no dates yet).
