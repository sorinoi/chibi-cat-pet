# Requirement v7: Choose the cat's look

Status: APPROVED by the user on 2026-11-08 as written (open questions on their defaults). Built and accepted 2026-11-08, released as 7.0.0. Started 2026-11-08 before V6-M4 and V6-M5 (user decision: the VPS is not ready); v6 is finished after v7. Open questions (section 13) use the defaults written here until decided. v6 (requirement-v6.md) stays the base: everything in v1 to v6 keeps working.

## 1. Overview

Today every cat looks the same: the orange-and-white cat whose sheets are in `assets/models/` and whose model is fixed in `src/shared/activeModel.ts`. v7 lets the user pick a **look** (coat color) for the cat:

1. When adopting, the adoption window shows the looks and the user picks one.
2. Later, Settings can change the look of the current cat (it is only paint: needs, name, treats and history stay).
3. Still one cat at a time (unchanged rule). A look is not a second pet.

New looks come either from new art drawn by the user (like every sheet so far) or from a recolor tool that makes a color variant of the existing sheets, each variant approved by the user before it ships.

## 2. Decisions (user, 2026-11-08)

| Topic | Decision |
| --- | --- |
| Feature | Draft requested: choose the cat's color, with sprites per look. |
| Sheet files | One file per group, the same 5 sheets and row layout as today, preferred over one big sheet (8 x 22 cells) because it is easier to draw, fix and prepare (see section 5). |

## 3. Scope

In scope: looks that share the current layout, picking a look at adoption and in Settings, saving it with the cat, a recolor tool, Thai and English text.

Out of scope for v7.0:

- Other species (dogs, rabbits) or looks with a different layout, size or set of clips.
- Accessories, hats, seasonal outfits, unlockable or paid looks (no shop, unchanged).
- More than one cat at a time (unchanged).
- Sending the look to the activity server (open question; the event schema stays version 1).

## 4. Looks

| ID | Requirement |
| --- | --- |
| FR-100 | A look has an id (for example `orange`), a name in Thai and English, and one image file for each of the 5 sheets (`main`, `care`, `focus`, `life`, `move`). The current art is the look `orange`, the default. |
| FR-101 | All looks share one layout: the same sheets, cell sizes, anchors, clip rows, columns, frame counts, timings and `wallX`. Only the image files differ. A test checks every look's files exist and have the same pixel size as the default's (so the window size, the paws on a wall and every v5 movement stay exactly the same). |
| FR-102 | The model config lists the looks (id, names, file per sheet) next to the shared clips. A missing optional sheet in a look is not allowed: every look has all 5 files, so no look loses clips. |
| FR-103 | The cat's look is saved in pet.json (`look`, default `orange`; older files read as `orange`). An unknown id (a look removed in a later version) falls back to `orange`. "Adopt a new cat" asks for a look again. |

## 5. Art

| ID | Requirement |
| --- | --- |
| FR-104 | New art from the user follows the current layout per sheet (rows top to bottom): main 8 x 6 (idle, walk, click, drag, land, sleep), care 8 x 4 (eat, happy, hungry, pet), focus 8 x 4 (focusStart, focusDone, longBreak, breakOver), life 8 x 4 (sad, look, stretch, yawn), move 8 x 4 (jump, fall, climb, hang, wall on the right); same frame counts as today. It goes into `assets/sprites-inbox/` and through `sprite:prepare` or `sprite:regrid` like before. |
| FR-105 | `npm run sprite:recolor` makes a color variant of all 5 sheets of a look: it shifts the coat colors (hue, saturation, lightness ranges given on the command line or in a small preset file) and keeps outlines, eyes, the nose, the collar and the props (laptop, cup, bowl, medal) unchanged where possible. It writes new files only; the user looks at a preview (APNG like the README art) and approves each variant before it is added as a look. |

## 6. Picking a look

| ID | Requirement |
| --- | --- |
| FR-106 | The adoption window shows one small moving preview (idle) per look, the selected one highlighted; the name field and the Adopt button work as today. The first look is selected by default. |
| FR-107 | Settings, "Your cat" group: a Look choice with small previews. Changing it repaints the cat at once (the current animation keeps playing) and saves pet.json. No confirmation is needed: nothing is lost. |
| FR-108 | The tray icon and the app icon stay the same for every look. The README previews keep showing the default look. |

## 7. Non-functional requirements (additions)

| ID | Area | Requirement |
| --- | --- | --- |
| NFR-40 | Memory | Only the current look's sheets are loaded; changing the look releases the old images and alpha masks (NFR-05). Idle RAM stays within NFR-01. |
| NFR-41 | Size | Each look adds about 4.6 MB of images to the installer (the 5 sheets today: 4.6 MB). The adoption and Settings previews use the existing sheets (no extra preview files). |
| NFR-42 | Speed | Changing the look shows the new paint within 500 ms; the cat keeps its place and state. |
| NFR-43 | Language | Look names and all new text in both language tables (NFR-20). |
| NFR-44 | Gentle | Looks are cosmetic only: no look changes needs, moods or behavior. |

## 8. Architecture notes

- `src/shared/activeModel.ts` keeps one shared layout; a new `lookFiles(lookId)` gives the sheet files of a look. Main still sizes the window from the shared layout (unchanged, since looks share it).
- The pet window learns the look from the care state (`CareView` gets `look`), the scene loads that look's sheets (`src/renderer/models/registry.ts` already finds sheets by file name) and reloads when it changes.
- The care engine stores `look` in pet.json and has `setLook(id)`; IPC `care:set-look` from Settings; adoption sends the look with the name.

## 9. Testing notes

- Unit: pet.json look read/write and fallback; every look's files present with the default's sizes; the recolor tool keeps fully transparent pixels and outline pixels unchanged.
- App checks (isolated data, CDP): adopt with each look, change the look in Settings while idle, walking, perched and climbing (no jump of position, no flicker over 500 ms), memory before and after ten look changes.

## 10. Milestones (v7)

Same phase approval rule as before.

| Phase | Work | Gate | Status |
| --- | --- | --- | --- |
| V7-M1 | Looks in the model config, pet.json `look`, scene loads a look's sheets, layout test; `sprite:recolor` with one test variant (not shipped until approved) | The cat can be drawn in the test variant with no change in size, feet or wall anchors; tests pass | Done 2026-11-08, approved |
| V7-M2 | Look picker in the adoption window and Settings, IPC, strings TH/EN | Adopt with a look, change it later, survives a restart; memory released | Done 2026-11-08, approved |
| V7-M3 | Final looks (recolored and approved by the user, or new art from the user), README, installer 7.0.0, upgrade from 6.0.0 (the cat keeps its look `orange`) | Acceptance criteria below pass | Done 2026-11-08, accepted |

## 11. Acceptance criteria (v7)

- [x] The adoption window shows every look and the cat appears in the chosen one.
- [x] Settings changes the look at once; name, needs, treats, position and focus are untouched.
- [x] Every look plays every clip, with feet and wall paws exactly where the default's are. (Recolor keeps alpha, so every cell's outline is identical; checked on the canvas in V7-M1.)
- [x] Upgrading keeps the cat and shows it as `orange`. (6.0.0 was never released; checked over the installed 5.0.0, section 14.)
- [x] Idle CPU and RAM still meet NFR-01; changing looks does not grow memory.

## 12. Risks

- Recoloring can tint parts that should stay (eyes, props) or leave orange edges (anti-aliasing). Mitigation: color ranges per look, a preview, and the user's approval; new art from the user is the fallback.
- New art from an image generator often drifts in size or pose between rows; `sprite:regrid` has handled that before, but a look whose frames do not line up with the default's layout would need its own layout, which is out of scope for v7.0.

## 13. Open questions

Defaults are used until the user decides:

- Which looks for 7.0? (default: orange (today's), gray tabby, black, white, each with a Thai name.)
- Recolor the current art, or new art from the user per look? (default: recolor first; new art can replace a look later.)
- Can the look change after adoption? (default: yes, in Settings.)
- Send the look with activity events (needs event schema version 2 and a server change)? (default: no in 7.0.)
- When: decided 2026-11-08: before finishing v6 (V6-M4 deploy, V6-M5 release wait for the VPS).

## 14. Measurements and release checks (V7-M3, 2026-11-08)

- Looks: orange (the original art), gray tabby, black, white, all made with `sprite:recolor` and approved by the user from side-by-side previews. Presets in scripts/lib/recolor.mts (white tuned to hue 38, sat 0.2, lightness x 0.14 + 0.81). Known trade-off: the brown kibble in the bowl and, in gray, the orange long-break mug change color too; a tighter value range would keep them but left 2-2.5x more orange edge pixels on every frame.
- Version 7.0.0 (user decision 2026-11-08): the v6 activity log ships in it; the v6 server deploy (V6-M4) waits for the user's VPS. Installer `dist/desktop-pet-setup-7.0.0.exe` 124.3 MB (5.0.0: 112.2 MB; about 4.4 MB per extra look).
- NFR-01 (production build, isolated data, gray cat, 60 s, all processes): CPU 0.176 % of the machine, private RAM 187.6 MB. Pass.
- NFR-40/42: 12 look changes from Settings, 2-6 ms each over IPC; right after, 608 MB in total (GPU process 386 MB of textures); 60 s later 210 MB (GPU 116 MB). The pet scene's JS heap stayed flat over 40 changes after a forced GC (V7-M1). No growth.
- Upgrade over the installed 5.0.0 (with the user's OK): `/S` exit 0, Uninstall entry 7.0.0, settings.json and pet.json byte-identical after install; launched: only the pet window, the cat sOrinOi back with look null (orange) and a new pet id, no .bad file, activity log off. The data seen from the Claude session is the sandboxed copy (as for 4.0.0 and 5.0.0).
- Version 7.0.1 (2026-11-09, FR-106): the adoption window was too narrow for 4 looks (cards clipped on both sides). Window width 380 -> 520 DIP; the look cards wrap instead of overflowing.

