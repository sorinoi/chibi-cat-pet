# Requirement v4: A livelier cat and a friendlier focus timer

Status: APPROVED by the user on 2026-11-06. Not built yet; implementation starts with V4-M1 only after the user says go. Open questions (section 13) use the defaults written here until decided. v3.0 (requirement-v3.md) stays the base: everything in v1, v2 and v3 keeps working.

## 1. Overview

v4 adds six small features and closes the long-open quality checks:

1. Hungry notification (FR-29 from v2, never built).
2. Focus history: the last 7 days of focus sessions.
3. Focus treats (optional): finishing a focus earns a treat to give the cat.
4. A sad animation for the sad mood.
5. The cat turns its head toward the mouse when it is near (FR-08 from v1).
6. Time-of-day touches: a morning stretch, sleepier at night.
7. Quality: the real 8-hour memory test (NFR-05), a tuning review, and measurements.

Still one pet, fully offline, personal use, gentle: nothing in v4 punishes the user.

## 2. Decisions (user, 2026-11-06)

| Topic | Decision |
| --- | --- |
| Scope | All features proposed on 2026-11-06 (list above). |
| Focus treats | Wanted, even though v3 kept the timer apart from pet care. To stay gentle and keep the v3 choice available, treats are a setting, **off by default**. |
| Art | New clips come from the user (section 9). Features that need art fall back to existing clips or stay off until the art exists. |

## 3. Scope

In scope: the features in section 1, their settings, Thai and English text for everything new.

Out of scope for v4.0:

- Coins, shop, toys, decorations (still later).
- Streaks, goals or anything that scolds the user for a missed day.
- More pets, other species, online features (unchanged).

## 4. Hungry notification (from v2 FR-29)

| ID | Requirement |
| --- | --- |
| FR-46 | When hunger drops below 20, show one Windows notification ("Mochi is hungry"). At most once every 4 hours. Not while the user is away (FR-07) or a fullscreen app is in front (FR-16); it waits until they are back. |
| FR-47 | Setting "Remind me when the cat is hungry", **off by default**. Uses the same notification path as the focus timer (FR-37). |

## 5. Focus history

| ID | Requirement |
| --- | --- |
| FR-48 | Keep completed focus sessions per local day for the last 30 days (focus.json version 2: `{ version: 2, days: { "YYYY-MM-DD": count } }`). A version 1 file is upgraded on load and keeps today's count. |
| FR-49 | The settings Focus timer section shows the last 7 days as small bars with the count and the weekday (Thai or English). No streaks, no targets. |
| FR-50 | Today's count in tooltips and menus works as in v3. |

## 6. Focus treats (optional)

| ID | Requirement |
| --- | --- |
| FR-51 | Setting "Earn treats by focusing", **off by default**. When on, each completed focus earns 1 treat, up to a stock of 5. Skipped or interrupted sessions earn nothing. |
| FR-52 | With at least one treat, the cat's menu and the tray menu offer "Give a treat (N)". The cat plays `eat` (or `happy` when full) and gets happiness +10 and hunger +10 (config). Same rules as feeding: ignored during another care animation, wakes a sleeping cat. |
| FR-53 | Treats belong to the cat: they are saved in pet.json and wiped with it when adopting a new cat (FR-25). Turning the setting off hides the menu item but keeps the stock. |
| FR-54 | The focus-done notification mentions the treat when one was earned ("+1 treat"). |

## 7. Livelier cat

| ID | Requirement |
| --- | --- |
| FR-55 | Sad mood: instead of some wanders, the cat plays `sad` now and then (at most every 10 minutes, like the hungry reminder; never while the user is away or the cat is hidden). Without the `sad` clip, v2 behavior stays (wanders less, no animation). |
| FR-56 | Look at the mouse (from v1 FR-08): while the cat is idle and visible, and the cursor is within 200 DIP of the cat but not over it, the cat shows `look` facing the cursor's side (the clip is mirrored for the other side, like `walk`). It goes back to `idle` when the cursor leaves the area or anything else happens. Without the `look` clip the feature is off. |
| FR-57 | The cursor position comes from the main process (`screen.getCursorScreenPoint()`), polled at most 4 times per second and **only** while the cat is idle and visible (NFR-21). |
| FR-58 | Morning stretch: the first time the cat wakes (app start or user back from away) between 05:00 and 11:00, it plays `stretch` once. Without the clip it plays `happy`. |
| FR-59 | Night: between 23:00 and 05:00 the cat falls asleep after half the usual idle time (FR-07 setting), and plays `yawn` now and then before sleeping (Could; skipped without the clip). |

## 8. Non-functional requirements (additions)

| ID | Topic | Target |
| --- | --- | --- |
| NFR-21 | Cost | Cursor polling runs only while the cat is idle and visible, at most 4 Hz; idle CPU and RAM stay within NFR-01. |
| NFR-22 | Memory | The real 8-hour run (NFR-05, deferred since v1) is done on the installed 4.0.0: private RAM must not keep growing after warm-up. |
| NFR-23 | Config | Treat amounts, stock, reminder thresholds, look radius, poll rate and time-of-day windows live in config modules (careConfig, focusConfig or a new behavior config), not in components. |
| NFR-24 | Language | All new text in both language tables (NFR-20). |

## 9. Art needed from the user

A new sheet `cat-life.png`, made like the care sheet: 8 columns, one clip per row from column
0, 224 x 224 px cells, **real transparent background**, feet at about y = 210, the cat the same
size and style as before, no frame crossing its cell. (An off-spec sheet can still go through
`npm run sprite:regrid`, but a clean sheet looks better.)

| Row | Clip | Priority | Idea (free to change) | Playback |
| --- | --- | --- | --- | --- |
| 1 | `sad` | Must for FR-55 | Ears down, small sigh, a little rain cloud | once |
| 2 | `look` | Must for FR-56 | Sitting like idle, head and eyes turn to the **right**; last frames hold the look | intro then hold (loop from the last 2 frames) |
| 3 | `stretch` | Should | Big front stretch and a happy shake | once |
| 4 | `yawn` | Could | Big yawn, sleepy eyes | once |

Without the sheet: FR-55 and FR-56 stay off, FR-58 uses `happy`, FR-59 skips the yawn.

## 10. Behavior state machine additions

New states `sad`, `look`, `stretch`, `yawn`, `treat` (treat plays `eat` or `happy`).

| From | Event | To |
| --- | --- | --- |
| idle | sadReminder | sad |
| idle | cursorNear(side) | look |
| look | cursorAway, click, dragStart, wander, sleep, care or focus cue | as for idle |
| idle, sleep | wake in the morning window | stretch |
| idle | night yawn | yawn |
| idle, walk, sleep | giveTreat | treat |
| sad, stretch, yawn, treat | clipFinished | idle |

## 11. Milestones (v4)

Same phase approval rule as before. The first two phases need no art.

| Phase | Work | Gate | Status |
| --- | --- | --- | --- |
| V4-M1 | Hungry notification, focus history (focus.json v2, 7-day bars) | Notification rules unit tested and seen once in the app; history survives restart; v1 file upgrades | - |
| V4-M2 | Focus treats (setting, stock in pet.json, menu item, notification text) | Earn, give, cap, wipe and setting-off rules unit tested and checked in the app | - |
| V4-M3 | Art import (`cat-life.png`), sad reminder, morning stretch, night sleepiness | Each clip plays at the right moment; feet steady; time windows unit tested | - |
| V4-M4 | Look at the mouse (cursor polling, mirroring) | Looks toward the cursor on both sides; never blocks clicks; polling stops when not idle or hidden | - |
| V4-M5 | Polish: tuning review, NFR-01/21 measurement, installer 4.0.0, upgrade from 3.0.0, 8-hour memory run | Acceptance criteria below pass | - |

## 12. Acceptance criteria (v4)

- [ ] With the setting on, a hungry cat triggers at most one notification per 4 hours; off by default.
- [ ] The last 7 days of focus sessions show in settings and survive restart; a v3 focus.json upgrades.
- [ ] With treats on, a completed focus earns a treat (max 5); giving one plays the reaction and changes the needs; adopting a new cat clears them; off by default.
- [ ] A sad cat shows the sad animation now and then.
- [ ] The cat looks toward a nearby cursor on either side and returns to idle; clicks still pass through empty areas.
- [ ] Morning stretch and night sleepiness happen in their time windows.
- [ ] Idle CPU and RAM still meet NFR-01; cursor polling only while idle and visible.
- [ ] 8-hour run on the installed app: no continuous memory growth (NFR-22).
- [ ] Upgrading from 3.0.0 keeps settings, pet and focus data.

## 13. Open questions

Defaults are used until the user decides:

- Treat effect: +10 happiness and +10 hunger, stock 5. Right amounts?
- History: 7 days shown, 30 kept. Enough?
- Look radius 200 DIP. Too far or too close?
- Morning 05:00-11:00, night 23:00-05:00. Do these match your day?
- Tuning from v2 (hunger empties in 10 h, happiness in 12 h): feels right after using it?
- Windows 10 and multi-monitor checks still need hardware; keep them out of the v4 gate?
