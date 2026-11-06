# Requirement v2: Pet-care system

Status: APPROVED by the user on 2026-11-06. Built and accepted as v2.0.0 on 2026-11-06 (V2-M1..M5 done). Open questions (section 15) use the defaults written here until decided. v1.0 (requirement.md) stays the base: everything in v1 keeps working.

## 1. Overview

v2 turns the desktop cat into a pet you look after. It gets hungry and wants attention, you feed and pet it, and its mood shows in how it behaves. It stays gentle: it never dies, never runs away, and never nags. Still one pet at a time, fully offline, personal use.

Goals:
- A small, calm care loop: check in a few times a day, feed, pet, done.
- The pet feels alive between sessions without punishing time away.
- Needs are cheap to run: no per-second work, idle cost stays at v1 levels.
- Tuning numbers live in config so the feel can be adjusted without code changes.

## 2. Decisions made (user, 2026-11-06)

| Topic | Decision |
| --- | --- |
| Needs | Two meters: hunger and happiness. Money and shop move to a later version. |
| Time | Needs drop in real time while the app runs, at a reduced rate while it is closed, with a floor so the pet is never at zero after a long break. |
| Neglect | Gentle: the pet gets hungry or sad and shows it, but never dies or leaves. |
| Row 4 art (hand petting) | Used for both: the welcome scene on adoption and the reaction to petting. |
| One pet | Unchanged from v1: only one pet; adopting a new one wipes the old pet's data immediately. |
| Species | Cat only for now. |

## 3. Scope

v2.0 in scope:
- Hunger and happiness, with decay over time (online and offline).
- Feeding and petting.
- Moods derived from the needs, shown through animations and behavior.
- Adoption: name the pet on first launch; adopt a new pet from settings (wipes the old one).
- Pet status in a tooltip, the tray and the settings window.
- New clips from the care sheet: eat, happy, hungry, pet.

Out of scope for v2.0:
- Coins, shop, items, toys (later version; needs design and art).
- Death, illness, running away.
- More than one pet; species other than the cat.
- Online features, accounts, sync (never).
- Achievements and long-term stats beyond a few counters.

## 4. Needs model

Both needs are numbers from 0 to 100. 100 is best (full, very happy).

| Need | Goes up when | Goes down |
| --- | --- | --- |
| Hunger (fullness) | Fed | Steadily over time |
| Happiness | Petted, clicked, fed | Steadily over time; faster while hungry |

Proposed defaults (all in config; tune after play-testing):

| Setting | Default | Meaning |
| --- | --- | --- |
| hungerHoursToEmpty | 10 h | Running time from 100 to 0 |
| happinessHoursToEmpty | 12 h | Running time from 100 to 0 |
| hungryHappinessMultiplier | 2x | Happiness drops this much faster while hunger < 30 |
| offlineRate | 0.25x | Rate while the app is closed or the PC is off |
| offlineFloor | 30 | Offline decay never takes a need below this |
| sleepRate | 0.5x | Rate while the pet sleeps (user away) |
| feedHunger / feedHappiness | +40 / +5 | Per feeding |
| petHappiness | +15 | Per petting, at most once per 30 s |
| clickHappiness | +2 | Per click, at most once per 10 s |
| fullThreshold | 95 | At or above this the pet refuses food |

Rules:
- Needs are computed from elapsed time (last saved value + rate x time), not by a per-second timer. The app recomputes on events and every 60 s.
- Offline time is the gap between the last save and the next launch, measured with the wall clock.
- Clock safety: if the clock goes backwards, no change; if the gap is huge, the floor already bounds the result.
- While the app runs, a gap between updates longer than 5 minutes (PC asleep, app frozen) counts at the offline rate for the whole gap.
- Values are clamped to 0..100 and kept at full precision (in memory and in pet.json); they are rounded only for display. Rounding on every 60 s update would drift the rates.

## 5. Moods

A mood is derived from the needs every time they change; it is not stored. Priority from top to bottom:

| Mood | Condition | Effect |
| --- | --- | --- |
| Hungry | hunger < 30 | Instead of wandering, sometimes plays `hungry` (thought bubble with a bowl). Tooltip says it is hungry. |
| Sad | happiness < 30 | Wanders half as often; no extra animation (no art yet). |
| Happy | hunger >= 80 and happiness >= 80 | Clicks sometimes play `happy` instead of `click`. |
| Content | otherwise | v1 behavior. |

The hungry reminder plays at most every 10 minutes and never while the user is away or the pet is hidden or in a fullscreen pause.

## 6. Interactions

| ID | Interaction | How | Result |
| --- | --- | --- | --- |
| FR-17 | Feed | "Feed" in the right-click menu and the tray menu | Plays `eat` once, then hunger +40, happiness +5. If hunger >= 95 the pet refuses: plays `click`, tooltip says it is full. |
| FR-18 | Pet (stroke) | Move the cursor back and forth over the cat without pressing: 3 direction changes within 1.5 s | Plays `pet` once, happiness +15 (once per 30 s; the animation still plays inside the cooldown). |
| FR-19 | Pet (menu) | "Pet" in the right-click menu | Same as FR-18, for people who do not discover stroking. |
| FR-20 | Click | Unchanged from v1 | Plays `click` (or `happy` when the mood is happy), happiness +2 (once per 10 s). |
| FR-21 | Wake by care | Feeding or petting while asleep | The pet wakes and reacts; it may fall asleep again while the user is still away. |

Dragging can interrupt any care animation, like in v1. A care action during another care animation is ignored.

## 7. Adoption

| ID | Requirement |
| --- | --- |
| FR-22 | First launch without a pet (new install or upgrade from v1): show an adoption window. The user enters a name (1 to 20 characters, Thai allowed) and presses Adopt. |
| FR-23 | After adopting, the pet appears at the usual position and plays `pet` once as the welcome scene, then `happy`. Needs start at 80 / 80. |
| FR-24 | Settings has a Pet section: name (rename any time), hunger and happiness bars, adoption date, and "Adopt a new cat...". |
| FR-25 | "Adopt a new cat..." asks for confirmation ("Your current cat and all its data will be deleted now. This cannot be undone."). On confirm the pet data is deleted immediately, then the adoption window opens. |
| FR-26 | v1 settings (size, opacity, position, start with Windows, sleep time) are kept across adoptions and upgrades. |

Until a pet is adopted the desktop shows no cat; the tray menu offers "Adopt...".

## 8. Status display

| ID | Requirement |
| --- | --- |
| FR-27 | Hovering over the pet for 1 s shows a tooltip: name, hunger %, happiness %, and the mood in words. |
| FR-28 | The tray tooltip shows the same line; the tray menu gains "Feed" and "Pet status..." (opens the settings Pet section). |
| FR-29 | (Could) Optional Windows notification when hunger drops below 20, at most once every 4 hours. Off by default; a setting turns it on. |

## 9. Animation and assets

New standard clips (optional, so v1-style models still load):

| Clip | Sheet row | Playback | Used by |
| --- | --- | --- | --- |
| eat | care row 1 | once | FR-17 |
| happy | care row 2 | once | FR-20, FR-23 |
| hungry | care row 3 | intro frames 0-2 once, then loop 3-7 | Hungry mood |
| pet | care row 4 | once | FR-18, FR-19, FR-23 |

Care sheet (assets/sprites-inbox/cat_care_spritesheet.png, checked 2026-11-06): 1792 x 896, 8 x 4 cells of 224 px, transparent background, feet at about y = 210, no frame crosses its cell, cat about the same size as in the v1 sheet.

Asset requirements:
- A model can use more than one sheet. Each sheet has its own cell size and feet anchor; switching sheets keeps the feet in place. The window is sized for the largest cell (224 px at pet size 1.0).
- The care sheet's cat pixels have alpha 251-254 instead of 255 (almost opaque). A small build step sets near-opaque alpha to 255 so the cat is fully solid and hit tests behave like v1. The faint low-alpha pixels (about 2.6 % of the sheet) are checked for halos on dark wallpapers at the same time.
- The bowl, thought bubble and hand count as part of the cat for clicks, like the "!" marks in v1.
- License note next to the sheet: generated by the user with Claude (claude.ai), personal use.

## 10. Behavior state machine additions

New states: `eat`, `happy`, `hungry`, `pet`. All are reactions that return to `idle` when the clip ends (`hungry` ends after one loop).

| From | Event | To |
| --- | --- | --- |
| idle, walk, sleep | feed (not full) | eat |
| idle, walk, sleep | feed (full) | click |
| idle, walk, sleep | pet | pet |
| idle | hungry reminder | hungry |
| eat, happy, hungry, pet | clipFinished | idle |
| eat, happy, hungry, pet | dragStart | drag |
| click (happy mood) | - | plays `happy` clip instead of `click` |

The table extends the tested v1 state machine; no boolean flags.

## 11. Data and persistence

| ID | Requirement |
| --- | --- |
| FR-30 | Pet data lives in its own file, pet.json, next to settings.json in the app data folder: { version, name, species, adoptedAt, hunger, happiness, updatedAt, counters { feeds, pets } }. |
| FR-31 | Saved after every care action (debounced) and every 60 s while running; flushed on quit. Atomic write, validated on load like settings.json. |
| FR-32 | Wiping (FR-25) deletes pet.json and clears it from memory before the adoption window opens. |
| FR-33 | A damaged pet.json is renamed to pet.json.bad and the user is asked to adopt again (no crash). |
| FR-34 | Uninstall removes pet.json with the rest of the app data (v1 rule NFR-08). |

## 12. Non-functional requirements (additions)

| ID | Topic | Target |
| --- | --- | --- |
| NFR-11 | Cost | Needs add no per-second work; idle CPU and RAM stay within NFR-01. |
| NFR-12 | Correctness | Needs math (online, offline, floor, sleep, clock going backwards) is pure and unit tested. |
| NFR-13 | Privacy | Pet data never leaves the machine (NFR-07 unchanged). |
| NFR-14 | Config | All tuning values from section 4 live in one config module (NFR-10). |
| NFR-15 | Compatibility | Upgrading from v1.0 keeps v1 settings and position; first launch shows adoption. |

## 13. Milestones (v2)

Same rule as v1: each phase must pass its gate, then wait for the user's approval.

| Phase | Work | Gate | Status |
| --- | --- | --- | --- |
| V2-M1 | Assets: import the care sheet (alpha fix, license), multi-sheet model config, clips eat/happy/hungry/pet | All four clips play correctly next to the v1 clips; feet do not jump between sheets | Done 2026-11-06 |
| V2-M2 | Needs engine: pure needs math, pet.json store, offline decay, moods | Unit tests for every rule in section 4; values survive restart; offline gap math checked | Done 2026-11-06 |
| V2-M3 | Interactions: feed, pet (stroke + menu), click bonus, hungry reminder, mood behavior | Each action changes the needs as specified and plays the right clip; stroke detection does not trigger on normal mouse moves | Done 2026-11-06 |
| V2-M4 | Adoption and status: adoption window, settings Pet section, rename, re-adopt wipe, tooltip, tray | Adopt, rename, re-adopt (data gone), upgrade from v1 all work | Done 2026-11-06, approved (tray checked by hand) |
| V2-M5 | Polish: tuning pass, NFR-01/11 measurement, installer, release v2.0 | Acceptance criteria below pass | Done 2026-11-06, approved (v2.0 accepted) |

## 14. Acceptance criteria (v2)

- [x] Fresh install and v1 upgrade both show adoption; v1 settings survive the upgrade. (2.0.0 installer over 1.0.0: settings.json byte-identical, adoption window shown, Run key kept. Fresh install = same no-pet path, checked in dev in V2-M4; not run on a clean machine.)
- [x] Feeding raises hunger and plays eat; feeding when full is refused. (V2-M3 app check)
- [x] Petting by stroking and from the menu raises happiness and plays pet; the cooldown works. (V2-M3 app check, unit tests)
- [x] Needs drop while running, drop slowly while closed, and never go below the floor offline. (V2-M2 app check and unit tests; V2-M5 run)
- [x] Hungry mood shows the hungry animation now and then; happy mood shows happy on click. (V2-M3 app check)
- [x] Re-adopting deletes the old pet immediately and asks for confirmation first. (V2-M4 app check)
- [x] Pet data survives restart; a damaged pet.json does not crash the app. (V2-M2 app check; V2-M5 production build)
- [x] Idle CPU and RAM still meet NFR-01. (section 16)

## 15. Open questions

- Tuning: are 10 h (hunger) and 12 h (happiness) the right pace? To decide after a few days of use.
- Text language for the adoption window, tooltip and notifications: English (like v1) or Thai?
- Hungry notification (FR-29): build it in v2.0 or leave for later?
- Should the pet react to being fed by dragging food onto it (needs a food item graphic), or is the menu enough?
- Coins and a shop: which version, and what would they buy (food types, toys, decorations)?
- Other species later? The adoption window would then need a species picker.

## 16. v2.0 measurements (2026-11-06, target machine)

Windows 11 Pro, 16 logical CPUs, one 2560 x 1600 display at 125 % scaling. Production build 2.0.0 (unpacked) with an adopted cat (hunger and happiness 60, content mood).

| ID | Target | Measured | Result |
| --- | --- | --- | --- |
| NFR-01 / NFR-11 | CPU <= 5 %, RAM <= 300 MB idle; needs add no per-second work | CPU 0.12 % of the machine (1.9 % of one core, 2 min); private RAM 184 MB (v1: 0.05 %, 170 MB). Needs decayed and pet.json was saved by the 60 s tick | Pass |
| NFR-15 | Upgrade from v1.0 keeps settings, shows adoption | 2.0.0 installed silently over 1.0.0: settings.json unchanged, Run key kept, adoption window on first launch | Pass |
| FR-33 | Damaged pet.json does not crash | Truncated pet.json -> moved to pet.json.bad, adoption window opened | Pass |
| NFR-09 | Installer <= 200 MB | 114.9 MB | Pass |

Tuning (section 4): defaults kept; the user decides after a few days of use (section 15).
