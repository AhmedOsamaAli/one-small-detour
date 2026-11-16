# One Small Detour

A living daily landscape puzzle. Don't move the traveler: move a little piece
of the world.

The daily island is the main game: one shared, date-seeded puzzle per UTC day,
not a finite queue of levels. The separate practice campaign has **212 checked
places**: the original 203 islands, including three late 12x12 landscapes, plus
nine gradual lessons for three-square strips, square patches and four-square Ls.
Proved minimums range from one through fifteen exchanges.

[Private source repository](https://github.com/AhmedOsamaAli/one-small-detour) |
[Play on Reddit](https://www.reddit.com/r/one_small_detour_dev/comments/1xweqdk/one_small_detour_a_little_change_a_different_way/)

The Reddit preview is a lightweight illustrated invitation: a courier, two
homes and a broken road. In a silent example, equal two-tile patches exchange
and the courier walks home and waves. This is not today's puzzle solution.
**Play today's island** explicitly opens the game. The preview respects feed
scrolling, pauses offscreen/background animation and has a static reduced-motion
alternative. It does not load the full 3D game or create a timed attempt.

## Play locally

Requires Node.js 22.18 or newer. Tested with Node.js 22.23.4.

```powershell
npm ci
npm run dev
```

Open [the local game](http://127.0.0.1:5173/). The server binds to loopback only.
Do not expose the local rehearsal server to the internet: its local player ID
is a convenience identifier, not production authentication.

## How to play

1. Follow the displayed journey: **A, then B, then C**, and so on. Later maps
   can include six pinned stops. Use the fewest exchanges you can.
2. Choose a picture frame matching this island's family. Daily and the first
   tutorial use two-square frames. Later Practice introduces three-square strips,
   2x2 squares and four-square Ls, one family at a time. The buttons show
   the real map orientation; the terrain itself never rotates.
3. Tap a patch, then another matching, non-overlapping patch. They exchange
   immediately on the second valid tap. Neither may include a pinned building
   or a fixed boulder.
4. Paving, grass, water and decorations move together. There is no separate
   Exchange confirmation. Tap the same starting square again or press Escape
   to cancel a selection; use Undo to reverse a completed swap.
5. Make one continuous orthogonal trail in the shown order. It cannot visit a
   later stop early, skip a stop, or revisit a square. Undo remains free.
6. Wooden bridges connect only along their planks: horizontal bridges connect
   east/west; vertical bridges connect north/south. Boulders cannot move or carry
   the traveler.

There is no small puzzle move budget and no forced failure after a few mistakes.
The counter shows exchanges used, not exchanges remaining. A technical submission
limit of 2,000 net exchanges bounds replay requests; Undo remains free. There is
no normal Restart or retry-the-whole-journey control.

Daily and practice attempts begin with **3, 2, 1, Go** after the board is ready.
The board cannot be selected during the countdown. The solve timer stops on
the winning exchange, before the final walking celebration. Undo resumes the
same original clock. Reloading or recovering a failed/expired countdown begins
a fresh attempt. Menus and background tabs do not pause elapsed time. Necessary
error-recovery and save-retry buttons remain available.

First visits open an untimed, skippable walkthrough before any daily attempt is
created. An original drawn courier moves near the current frame or starting
square with a short pointer. The hint may cover inactive scenery, but not the
current patch, selected patch or controls. The lesson guides
**three real exchanges**, using tall and wide frames, before the traveler walks
through A, B and C. Only the last guided repair completes the road. This is a
teaching sequence, not a claimed optimal score. Guidance follows Undo back to
the relevant repair; there is no duplicated instruction line at the bottom.
The stronger arrow and tap ring target only the patch's starting tile, not the
centre of the two-tile frame. Courier prompts say **Tap orange here.** or
**Tap blue here.**, so they stay correct in either view and camera angle
without calling a projected tile "left" or "top".
On-board arrows follow that frame's long axis: down for tall and right for wide
in Flat, or the corresponding real camera projection in 3D. Their tips remain
at the first square when the view changes or resizes.
The welcome explicitly offers **3D (the default)** or **Try Flat** before the
untimed lesson. Choosing a view does not start a ranked attempt.
The guide then introduces the tools, views, daily ranking and 212 practice places. New rocks and
bridges get a short explanation before that island's countdown starts.
Completing or skipping the guide is remembered; the question-mark help button
can replay it anytime.

Orange frame **1** is the first patch; blue frame **2** is the second. Solid,
white-backed borders are confirmed selections; dashed frames are previews.
Invalid feedback clears after one second, including retained touch hover.
This applies to fixed homes/boulders, overlapping patches and off-island starts,
on either pick and in both views. A valid first patch remains selected after a
bad second pick. Another invalid pick restarts the feedback window.
Flat view frames the exact occupied patch, leaving an L's notch outside the
outline, with numbered badges and the same
orange/blue/red feedback as 3D. Hovering or focusing the next patch previews it;
frames never intercept tile clicks. A preview on the selected origin is hidden
so it cannot repaint the confirmed orange patch.
Both Reddit entrypoints suppress the browser's page-wide tap flash on phones.
The game's colored patch frames and visible keyboard-focus outlines remain.
Small white-backed arrows also appear **inside the highlighted starting square**
during ordinary play, not just during the walkthrough. They follow the confirmed
orange and valid blue-preview frames in both views; the frame still shows the
whole patch. Number badges sit outside the Flat frame corner so they do not
hide the arrow. All markers are click-through and reproject when the board fits
a new viewport.
Red previews with **!** indicate an invalid candidate.
The offending home, boulder or overlapping square is highlighted individually,
with a short warning beside the board. Paving is movable; boulders are fixed.
Bridge arrows show their two permitted directions.

The header has direct **Practice map**, **sound/mute**, **sun/moon** and **?**
buttons on every screen size. The question mark opens the illustrated guide,
tile rules and an untimed
guided garden. The garden does not submit scores or count as a daily completion.
The sun/moon switches to light/dark immediately, without restarting the board.
All four controls retain 44px tap targets; very narrow screens simplify the
wordmark instead of squeezing the controls.
Undo is beside the board. A small **3D / Flat** selector changes
the same puzzle's view; first use defaults to 3D and remembers later choices.
There is no Settings menu or duplicate navigation.

### Moving the Flat map

Flat exchanges visibly lift and slide both complete patches into each other's
places over **520ms**. The orange/blue frames travel with their original terrain;
grass, paving, water and bridge directions are not morphed, rotated or replaced
by an unrelated effect. Undo animates the reverse repair.

Extra exchanges and Undo are blocked until the patches land, without discarding
keyboard focus. The courier waits for landing before starting the completed
journey. Menus and hidden-tab visibility events pause the movement, not the
solve clock; the winning tap still freezes solve time immediately. Reduced
motion uses instant exchanges. Resizing during a swap settles to the correct
fitted board, and leaving the puzzle cancels the old animation. A browser
animation failure is reported explicitly without losing the legal move or
leaving the controls locked.

**The traveler stays at A until the whole ordered road is ready.** Connecting
only an early home does not start a partial walk or earn an arrival. Once one
continuous, non-retracing trail reaches every home in order, the traveler walks
it with a pause, glow and optional chime **on each arrival**. The full
celebration starts at the final arrival, with the character still visible.
The completion popup appears only after **1.5 seconds of visible celebration**.
Menus and background tabs pause this animation time, not the solve clock.
Earned daily rank and percentage are prominent inside that one popup, only
after successful saving. Closing it returns to the island and Undo; it does
not immediately reopen. **Continue your journey** starts the next unfinished
unranked Practice stop directly; **Practice map** remains available for browsing.

Undo during or after the walk cancels old arrival events and returns the
traveler to A. There is no partial-delivery or checkpoint history. New attempts
and puzzles also begin at A. Pending result reveals are cancelled, so a previous
journey cannot open a popup on a new attempt. Reduced motion preserves the full ordered arrival
stamps without continuous walking. Help and map overlays pause playback.
Existing Daily rules, certified minimums and timed-score keys are unchanged.

### Keyboard and accessibility

- Focus the living island; arrow keys choose a square and Space/Enter selects it.
  Home/End jump to the first/last square.
- Escape clears the cuts.
- The puzzle fits one viewport without page or board scrolling. Short landscape
  screens place the controls beside the map. Completion overlays the scene
  without pushing the board or Undo off-screen.
- Living maps fit the complete board automatically, including buildings and
  landmark labels. The 3D stage uses the side gutters when controls are stacked;
  its camera includes fixed-pixel labels and the courier's possible road
  positions instead of reserving a blanket zoom margin. Controls and the Flat
  layout keep their own space. Zooming and panning are not needed.
- Flat map fits all individually labeled cells to the available width and
  height, for 6x6, 8x8, 10x10 and 12x12 maps. Its cells adapt to the screen; keyboard
  navigation remains available when a narrow pane makes them small.
- The device's reduced-motion preference is respected automatically, including
  changes while the game is open. There is no manual motion switch.
- Light is the default, including on devices using dark mode. Legacy automatic
  preferences migrate to Light without discarding progress. A manually chosen
  Light or Dark mode is remembered in this browser. Both entrypoints, dialogs, flat tiles,
  practice scenery and living-island lighting use the same effective theme
  without resetting the puzzle or recreating the 3D scene. An already open preview
  also reflects saved changes from the game. There is no extra appearance menu.
- Sound is opt-in. The sound button starts the original Web Audio score; a
  successful route plays its own short pentatonic melody. The header includes
  a visible one-click mute on phones and desktop; the choice is remembered.
- Text uses a 16px body, 14px control labels and a 12px secondary-text floor.
  Primary text palettes exceed 4.5:1 contrast, and toolbar controls use 44px
  targets. The guide, adventure map and data-removal confirmation open in bounded
  dialogs; their longer content can scroll without scrolling the game.
- The campaign is one connected, winding landscape, not separate region screens.
  Drag or use arrows, Page Up/Down, Home/End inside its camera view. **Find my
  stop** returns to the next unfinished stop without starting a puzzle.
- Frame picture buttons use the actual camera's projected grid directions.
  The highlighted piece is previewed directly on the map, not in unrelated
  mini-cards. Switching to flat map switches the pictures to flat geometry.

## Daily content and the atlas

The season begins on **11 November 2026 UTC**. Everyone opening today's game
receives the same numbered, versioned edition, changing at UTC midnight.

Daily content is now **generated from the UTC date**, rather than stopping at
the end of a 42-map season:

- The same date and ruleset produce the same topology, stops, terrain, and
  solution conditions for every player.
- A new winding network and checked corruption sequence create the daily map.
  This is not just recoloring grass or rotating a static finished picture.
- Daily maps range from 6x6 to 10x10, with three to six ordered homes. Advanced maps
  use fixed-rock corridors, directional bridge stock and longer ordered routes.
- The introductory edition has a certified minimum of one; the following weekly
  cycle originally used 2, 3, 4, 5, 7, 10 and 15 exchanges. All editions through
  2026-11-15 remain unchanged.
- From **2026-11-16 UTC**, date-seeded difficulty starts at three moves, varies
  within 3-5 for its first week and 3-7 for its second, then mixes 3-10 with
  fewer very hard days. Consecutive minimums change by at most two moves;
  weekly recovery targets ease the pace. The same schedule applies to everyone.
  Three/four-move islands use 8x8; harder ones use 10x10. The displayed minimum
  is proved, not the number of shuffles used to create a board.
- A bounded generator certifies both solvability and the minimum before serving
  the map. It throws explicitly rather than return unchecked random content.
- A small server-process cache avoids regenerating frequently requested dates.
- **212 checked campaign places** follow one continuous scenic road. The original
  203 keep their IDs, boards and relative order, including three final 12x12
  challenges with certified minimums of 10, 12 and 15 exchanges. Opening islands
  stay 6x6 with a one-exchange repair.
  New shape lessons begin at stops **13, 40 and 79**: three-square strips, then
  2x2 squares, then four-square Ls. Each family has one-, two- and three-exchange
  lessons and only its own frames. Ls have pictured tall/wide orientations;
  their two notch cells stay behind, including any pinned rock or home there.
  Existing completion flags use island IDs, so later numbering can shift without
  erasing discoveries. Daily seeds, frame sizes and rankings are unchanged.
  Finishing the first unfinished stop opens the next. Older discoveries remain
  replayable, but do not skip unfinished earlier stops.
- **Tap a number to preview, then Play/Replay to start.** The next unfinished
  stop is preselected. Its illustrated card shows the title, board size, proved
  move goal and whether it is Ready, Completed or Locked. Locked stops explain
  which earlier stop to finish; previewing them never starts a puzzle.
- The map legend distinguishes completed, ready and locked stops. **Find my
  stop** moves the camera; **Daily challenge** opens the separate daily puzzle.
- After a Practice finish, opening the map centres the newly unlocked row and
  previews the next stop. Resizing keeps that row in view while following it;
  manual dragging and keyboard browsing are not pulled back.
- Campaign progress is browser-local and unranked. Today's daily island is
  always accessible without completing campaign prerequisites.
- Browser discoveries from older builds remain stored, but independent-delivery
  maps are no longer in the live ordered-journey catalog.

Release verification samples a full year: **365 distinct terrain and road
decision layouts**, all certified and regenerated independently, with **no
campaign repeats** in that sample. Run
`npm run verify:daily` to repeat the check, or supply a UTC start date with
`npm run verify:daily -- 2026-11-13`. This is measured coverage, not a proof of worldwide novelty, endless
non-repetition, human enjoyment or retention. Native mobile performance still
needs Reddit platform testing.

### Minimum moves are proved, not counted from a shuffle

The generator starts with an ordered journey and corrupts it, retaining only
states whose lower bound rises to the target. For every generated challenge:

1. A binary-cost shortest-path calculation bounds the initially unpaved cells
   required between stops and between the journey's first and last stops.
   Fixed boulders are impassable; bridge directions are optimistically relaxed
   in this lower bound, but enforced in the actual solution replay.
2. One area-N exchange can add at most N newly paved cells: every corresponding
   pair can add only one, and deleting roads cannot improve that bound.
3. The lower bound divided by N, rounded up, must equal the length of a legal
   solution witness. A matching lower and upper bound certifies the exact minimum.

This lower bound relaxes ordered-stop constraints; it does not incorrectly sum
overlapping paths. The witness is separately checked as a single ordered,
no-retrace journey. Independent endpoint connectivity is not enough.
The small square-frame lessons use exhaustive legal replay when that paving
bound is not tight: every shorter sequence is searched, with an explicit
20,000-state limit. A repeated shuffle is never accepted as an optimality proof.

The daily generator is shared with the practice-bank tool. Regenerate the
checked practice fixtures deterministically with:

```powershell
node --experimental-strip-types --no-warnings=ExperimentalWarning tools\generate-challenges.ts
```

The original 45 campaign places are preserved. Regenerate the additional 155
checked places with `npm run generate:campaign`. These original 200 distinct
road-decision layouts regenerate byte-for-byte identically. Three separately
seeded, certified 12x12 Practice islands are appended, not mixed into daily
generation. Snapshot tests protect all original islands and sampled daily editions.
The daily seed namespace is separate and does not index into this bank.

Changing the generator or fixtures requires rerunning the proof and replay tests.
The minimum shown applies to the daily/practice fixed-area rules, not to the
legacy mixed-size footprint API. Attempts may exceed the minimum;
Undo remains free.

Solvability and minimum exchanges are tested, not a claim that every map has
been human-playtested or that move count alone determines perceived difficulty.
Review the content with players before public launch.

## My rank today

The normal daily leaderboard ranks **fewest exchanges first, then fastest solve
time**. Fewer tiles moved remain a final tie-break for compatibility; fixed-area
daily puzzles move the same tile count at equal exchanges. Equal results share
a rank.

The game shows no rank before or during a daily attempt, even if an earlier
recorded result exists. The client does not fetch a saved rank at startup.
Only after the current attempt finishes its celebration and successfully saves
or loads its original result for an unranked replay
does the completion popup prominently reveal the rank and **Top 10% today**.
A compact line such as **#5 of 50 - Top 10% today** remains available on the finished
island after the popup is closed.
The percentage compares unique valid finishers on
that day's puzzle in this installation, not viewers, all Reddit users or scores
from different days. It includes everyone whose recorded result is at least as good
as yours, so tied results share an inclusive percentage. Displayed whole
percentages round up, never exaggerating performance; values below 1% show
**Top <1%**. A sole finisher sees **Rank #1 of 1 finisher today**, not an invented
percentile. An optional Top 10 is available from the fixed result footer, never
before finishing. Local
rehearsal is labeled **Local** rather than pretending to be an online community
ranking. Save errors show an explicit retry state without revealing an older
rank. Undo and changing attempts hide the comparison again; saved results
remain intact on the server.
The popup identifies saved finishers in this community and says that the rank
is a snapshot when saved, not the day's final position.

### Ranking system design and scale

The Reddit hot path uses a **Redis sorted set**, not an application-side sort
of everyone's attempts. Each edition has one member per player. Its integer
score is `exchanges * (MAX_ATTEMPT_MS + 1) + serverSolveMs`; all supported values
fit exactly below JavaScript/Redis's 53-bit integer precision. Smaller is better,
so no duration can outrank a result using fewer exchanges.

- A per-player best-record key is watched with **WATCH/MULTI/EXEC**. A better
  record and its sorted-set membership commit together. Different players do not
  watch the shared leaderboard key, avoiding global optimistic-lock contention.
  Conflict retries are bounded, and failures produce Retry save rather than a
  fabricated rank. From edition **2026-11-16**, a separate per-player first-result
  reservation freezes the first valid completed save before updating the index.
  Same-solve retries recover that result; another attempt cannot replace it.
  Scores already present when this policy was enabled remain frozen baselines.
- Redis `ZRANK` is **O(log N)** and `ZCARD` is **O(1)**. Equal-score endpoint
  queries plus a small read transaction preserve competition ranks (1, 1, 3)
  and the inclusive tied percentile, without downloading a large tie group.
  Metadata stays server-side; the hot response contains only the personal best,
  cohort count and percentile, not other players' identities.
- A normal indexed read uses **13 Redis API operations**, independent of N.
  Production adds one bounded housekeeping range read; at most four stale
  account checks are performed, rather than one Reddit lookup per finisher.
  Deleted-account reconciliation is incremental, not guaranteed instantaneous.
  Explicit Remove saved scores synchronously removes indexed and legacy records;
  a 24-hour erasure marker rejects old in-flight saves.
- Existing score hashes are retained and backfilled resumably, eight records at
  a time. An incomplete migration returns an explicit retry state, never a
  partial ranking. Older editions retain personal-best behavior; new editions
  retain only the first result (or the preserved rollout baseline) per player.
  Records and index keys expire 30 days after their edition date.

`node --experimental-strip-types --no-warnings=ExperimentalWarning src\server\rankingFixture.ts --benchmark`
checks 1,000, 10,000 and **100,000 synthetic finishers**. Tests also compare the
100,000-player result with an independent full-sort oracle and cover concurrent
updates, ties, legacy backfill, failure responses and erasure. This is an
**in-memory algorithm/call-count check**, not measured Redis/Reddit latency,
load capacity or an SLA. The local Docker engine was unavailable; no hosted
throughput number is claimed.

[Reddit's Redis limits](https://developers.reddit.com/docs/capabilities/server/redis)
currently document 40,000 commands/second per installation, 20 concurrent
transaction blocks with a five-second timeout, five-MB requests, 100-MB
unpublished storage and five-GB published storage. These are platform ceilings,
not this game's proven requests/second. Storage scales with **unique retained
finishers across all 30 days**, plus active timers, not only today's cohort.
Plan capacity using measured Redis memory and RPC timings in the actual
installation. The algorithm is checked at 100,000 participants per edition;
native throughput and storage headroom still need a controlled platform load test.

Each puzzle fixes its patch area and family. The frame pictures are orientations, not
different scoring modes. Legacy footprint APIs/records remain compatible for
erasure and regression testing, but are not offered as a second player mode.

Speed never outranks a better repair. The board keeps a genuine personal best,
not merely the latest attempt. "Best known" does not claim proven global optimality.
Server validation prevents forged totals but cannot prevent outside solvers or
players learning from shared solutions.

**Daily scores save automatically** when the trail is solved. Saving runs in the
background while the courier finishes; the result card still waits for actual
arrival and celebration delay, and reports the saved rank. Failed saves display an error and **Retry
save**, not a success state. Practice remains unranked. Logged-out players can
play, but must sign in for ranking. There is no sharing panel, copy text box or
clipboard button. No Reddit comment, post or subscription is created by saving
a score.

The server issues an identity-bound countdown start and measures time until it
receives the solved repair. Client-supplied elapsed times are ignored.
Networking and unavoidable time between exchanges can affect elapsed time;
the final walking celebration does not. An already recorded solve timestamp
is retained on retry, even if the score write or response failed. A request
that never reached the server cannot establish an earlier server timestamp.
For Daily editions from **2026-11-16**, the first saved valid completion is final.
A failed save can be retried with its original solve identifier and timestamp.
Reloading or abandoning before finishing does not spend the ranked turn.
After a completion, replay countdowns are explicitly unranked. Undo and another
solve cannot improve the original result, including across simultaneous devices.
The result separates replay metrics from the recorded ranked result.
For earlier editions only, Undo followed by another solve creates a distinct
best-score candidate with later elapsed time from the same original start.
This is not a claim that outside solvers or rehearsed solutions can be prevented.

### Honest local and live behavior

- **Local atelier:** the village board contains only actual submissions to this
  local server. There are no seeded neighbors, scores or fake activity counts.
  Records persist in the ignored `.local/scores.json` file.
- **Reddit:** identity comes from the authenticated Devvit request context.
  Records use Reddit Redis in that community's installation. Ranking data
  expires within 30 days of its edition.
- The backend replays every exchange and verifies the actual route objective,
  including no-retracing waypoint trails. It ignores supplied score/identity
  claims.
- The personal-rank endpoint returns only the current player's rank, exchange
  count and solve time, not other players' names or leaderboard entries.
- Score-specific immutable fields prevent concurrent worse submissions from
  replacing a player's better repair.
- Puzzles remain ruleset **4**. Timed daily ranking uses separate score keys
  under version **5**, without changing the date seed or today's board.
  Earlier untimed results are not compared with timed results. Rock/bridge expeditions are not compared with
  classic version-3 scores or older independent-delivery results. Existing
  records are retained separately; erasure covers versions 1-5 and indexed
  daily records. Classic practice discoveries are preserved.
- Reddit records maintain a bounded, expiry-pruned player index, so removing
  scores does not depend on enumerating a fixed season.
- **Guide -> Manage saved data** lets the current player remove their score records.
  This also removes active timers and suppresses automatic re-saving of the
  current completed attempt. From edition 2026-11-16, a used-turn marker survives
  score removal until that edition's 30-day expiry, without the score or name.
  A fresh countdown cannot obtain another ranked turn for that edition.
- Native attempt metadata and hashed replay identifiers expire within 24 hours.
  Only recent attempts are retained. The local preview keeps attempts in memory;
  restarting its server invalidates open timers, but not saved scores.

See [privacy and data handling](PRIVACY.md).

## Build and verification

```powershell
npm run typecheck
npm test
npm run build
```

Or run all three with `npm run check`.
Run `npm run check:release` to include the repeatable 365-day content audit.

Tests cover all authored and generated witnesses, unique daily layouts,
UTC rollover, the seven research examples' 3,627 legal one-exchange cases,
certified classic minimums 1-6 and advanced minimums through 15, every shorter witness prefix failing, larger-map bounds
and E/F landmarks, collateral damage to another delivery, waypoint dead ends,
conservation, invalid moves, multi-exchange scores, genuine ties,
identity/score forgery, ruleset isolation, API failures, persistence and erasure.
Additional tests cover forbidden stop order, exact arrival times and pauses,
single-fire celebrations, reduced motion, date determinism, distinct road
layouts after the old season end, personal-rank data minimization, and an
independent lower-bound oracle. Campaign tests cover all 212 certificates,
unique layouts, strict ordered unlocking, replay preservation, migration and
the absence of progression dead ends.
Browser checks cover automatic two-tap swaps, invalid overlaps, free Undo,
waiting at A while an early home is connected, full A-F arrivals, cancelling
the walk back to A, fixed-cell highlights in both views, bridge arrows,
17-exchange completion, map unlocks, mute and saving a score without opening a
leaderboard.
Additional browser checks cover preview-before-play, locked-stop explanations,
camera navigation through stop 200, touch-drag suppression, explicit Replay,
load-error retry, persistent mute and the styled guide/privacy
panels, including sticky close buttons and narrow portrait/landscape layouts.
Timing tests cover countdown boundaries, same-move speed ties, forged timing,
identity/edition binding, expiry, idempotent retries and timed-score persistence.
Daily-comparison tests cover unique-player counting, ties, sole finishers,
players outside the legacy response's first 20 entries and wire validation.
Flat whole-patch frames were checked on 6x6, 8x8 and 10x10 boards at seven
portrait/landscape sizes: 21 combinations with no document scrolling, clipped
frames or out-of-bounds primary controls. Both frame orientations, keyboard
focus, invalid previews and click-through overlays were checked separately.

The compiler checks browser and server conditional exports separately.
Dependencies are locked; all fonts are self-hosted.
The interface uses a consistent field-guide style: original landscape
illustrations, contextual dialog emblems, semantic status colors, illustrated
tile rules and a completion seal. Reduced
motion disables scenic and UI animations without changing the puzzle.

The garden-village art direction uses shared, tested day/night terrain colours
in 3D, Flat and the preview: recessed cobbled paving, faceted granite, arched
wood-plank bridges with posts and stone piers, and view-dependent pond glints.
Ponds sit below the grass, with depth shading, connected shorelines and gentle
reflections. Seeded flowers vary in position, colour, size and group count across
grass, with a few subtle fish in open water. Decorations match between views,
travel with exchanged patches and restore exactly with Undo; they never become
input targets. Scenic motion pauses behind menus/background tabs and stays still
under reduced motion.
Original hand-carved A-F vector letters identify homes, their matching filled
route badges and guide/preview plaques, with sprout details on larger lettering.
Flat cottages use small roof-corner plaques, leaving their roofs, walls, windows
and doors visible; the 3D home art and lettering are unchanged. Screen
readers retain the ordinary letters. Expressive self-hosted headings keep
instructions, buttons and timers in the clean interface face.
The courier has the same teal coat, amber hat, scarf and satchel across views.
Its in-game scale is increased by about 35% in 3D and Flat, with tile-relative
Flat dimensions and a 3D upper cap; the Flat offset keeps it inside edge cells.
Dialogs use noninteractive botanical corners, and the landscape backdrop follows
the chosen appearance. Decorative art never adds puzzle obstacles.

### Living-island polish

The island uses a tactile-world presentation: carved earth,
rigid garden-parcel swaps, the courier watching the exchange, and a completed
village with opening doors, growing gardens and a few greeting residents.
The completed scene stays visible for three seconds before
results. Daily results show a capped illustrative crowd derived from the exact
saved-finisher count, plus an optional Top 10 fetched only after finishing.
On Daily results, Top 10 replaces Practice map in the fixed footer beside
Continue your journey, so it remains reachable without scrolling. The same
button returns to the result; each view starts at the top. Practice results
keep their map shortcut, and the normal map button remains available.
Local rehearsal counts are labeled; the crowd is not a set of player avatars.
Rankings remain fewest exchanges first, then server-measured time. There are
no postcard albums, stamps, currency shops, permanent community gardens, paid
hints, automated messages or cross-community rank claims.
It preserves the puzzle, timing and scoring rules, whole-board fitting, reduced
motion and animation pausing. Undo and a new island clear the completed scene.
This presentation is enabled by default in production builds. The existing
`?postcard=0` switch selects the previous presentation for comparison;
`?postcard=1` explicitly selects the default. The current native installation
is documented below.

The 3D renderer batches repeated terrain into instanced draws, compacts invisible
connections out of those draws, reuses frame geometry/materials and caches static
shadows. Pointer movement is coalesced to animation frames. Conservative tile
bounds narrow exact hit tests; input layers exclude decorative rock-edge lines
and grass blades. Clicks stay immediate. Idle scenery draws at up to 30 fps;
swaps, walking, celebrations and interaction invalidations are not held to that
idle cadence. Menus/background pause, instant reduced motion, and authoritative
solve timing are unchanged. No new rendering dependencies are required.
3D lifts are limited to the available viewport headroom, so enlarging the map
does not cut off exchanged patches. Landing refits the changed landscape, and
resizing safely settles an exchange before fitting the new viewport.
Both views use the same board-first layout: larger screens put controls beside
the island, while phones keep them above and below it. Opaque themed panels
keep landscape lighting away from text. The 3D backbuffer is pixel-budgeted on
high-density screens.
The expanded view measures the visible viewport rather than assuming the full
phone-screen height, reserves safe-area insets, and refits when browser chrome
changes. Compact walkthroughs omit the large decorative vignette, not the
instructions. Dialog actions stay reachable; shorter dialogs scroll internally.
iPhone 13-sized portrait/landscape, high-density and simulated notch/home-indicator
cases are browser checks, not a substitute for testing the native Reddit app.
Completion tests verify the 1500ms visible celebration hold, menu/background
pausing and cancellation when an attempt is rewound or replaced.
Browser checks also covered the 3D greeting, paused flat celebration pulses,
automatic live device-motion changes and Undo/Restart cancellation. A
reduced-motion flat result appeared after 1539ms, not before the 1500ms hold;
the solve timer remained frozen throughout.
The header/targeting update adds preference-migration checks and browser checks
for direct question-mark help, manual themes against the opposite device theme,
saved choices across reload and entrypoints, active-attempt preservation and
non-overlapping 44px controls. All six guided tap targets were actually clicked
in 3D after resizing; Flat checks also independently compare each ring with the
starting tile's centre before tapping it.
Additional movement checks cover ordinary-play in-board arrows, real intermediate
Flat positions, full patch identity, animated Undo, pause/resume, instant reduced
motion, viewport changes and animation-error recovery on fitted 6x6, 8x8 and
10x10 boards. Visibility events are simulated only in the isolated headless
browser; physical phone-background behavior still needs native device testing.

The production build includes:

- A separate lightweight, tap-only inline post preview.
- The full React/Three.js game.
- A Hono Devvit server, using the official server transport.

The Three.js landscape is lazy-loaded; the flat alternative does not request
it. The landscape chunk can produce a bundle-size advisory from Vite. It is not
loaded into the lightweight inline preview. Actual phone performance, loading targets,
native post behavior and screen-reader operation still require platform testing.

## Reddit test deployment

The owner-approved **private development build** is installed in a
dedicated public test community:

- Current test installation: **v0.1.9**, upgraded in place without changing
  score keys, puzzle IDs or saved campaign progress.
- [Play the Reddit example post](https://www.reddit.com/r/one_small_detour_dev/comments/1xweqdk/one_small_detour_a_little_change_a_different_way/).
- [Test community: r/one_small_detour_dev](https://www.reddit.com/r/one_small_detour_dev/).
- [Owner's app page](https://developers.reddit.com/apps/one-small-detour).

The community and example post are public; the app upload is a private
development version, not a reviewed public release. No `devvit publish`
command or Devpost submission has been performed. Building and playing
locally still does **not** upload anything.

Version 0.1.8 enables the living-island finish by default, keeps three visible
seconds before results, adds optional Daily Top 10, replaces viewpoint-dependent
tutorial directions with exact "here" prompts, and gives Flat cottages smaller
A-F plaques. The rejected album, stamps/shop, permanent garden and earned
cosmetics are not included. Release checks passed 119 source tests, all three
strict TypeScript checks, the production build and 288 focused browser checks.

Version 0.1.9 keeps the original camera, pins Daily Top 10 beside Continue your
journey, freezes first Daily completions from the November 16 edition, and
automatically reveals the next Practice row after a finish. Existing scores
remain rollout baselines, not reconstructed historical first attempts.
Validation passed 126 source tests, all three strict TypeScript checks, the
production build and 100 focused final browser assertions. Native v0.1.9's
seven JS/CSS hashes and both platform-serialized HTML entrypoints match the
tested release. Physical iOS/Android testing still remains.

The GitHub source repository is private. A public code repository is optional
under the [hackathon rules](https://redditgameofday2026.devpost.com/rules), so
judges can use the public Reddit game without public access to the source.
Changing repository visibility does not revoke earlier downloads or make
browser-delivered JavaScript inaccessible.

Deployment used the official private upload and an explicit, version-pinned
installation. The game does not depend on a running local server or playtest
watcher. The `dev.subreddit` value in [devvit.json](devvit.json) pins
`one_small_detour_dev`; keep future test installs scoped to that community.
Always specify a target when playtesting, because an untargeted command can
create a different development subreddit.

Exactly one example post was created through the moderator menu. There is no
automatic post creation on install or scheduled public posting. Do not invoke
that action again just to update the existing game.

The current post is an evergreen entrypoint: it serves today's edition when
opened. Edition IDs distinguish result discussions; the atlas is unranked.

Initial native desktop checks verified inline-to-game expansion, a real authenticated
countdown and four-exchange solve, automatic score saving, own rank, the frozen
solve timer through the arrival celebration, and score persistence after a
fresh reload and a development version update. The earned-rank display uses
**Rank #1 today** for a sole finisher, not an invented percentile. Guide, campaign access,
3D/Flat switching and sound/mute controls were also checked.

The native modal exposed a toolbar overlap. Metrics now keep their intrinsic
width and controls wrap rather than overlap. Eleven viewport sizes, including
724x596, were checked for pairwise overlap, bounds, 44px targets and document
scrolling, with both ordinary and maximum-length counters.

Real Reddit iOS/Android devices, logged-out behavior, cold-load performance,
actual account-deletion responses, permission failures and rate limits still
need testing before a broader release. The CLI's Node.js 24 recommendation
also remains to be reviewed; the current Node.js 22 build/upload succeeded
without changing the machine's runtime. Journeys telemetry is not simulated
or assumed allowlisted.

See the remaining [submission checklist](SUBMISSION.md). A working test post
is not platform review approval or a completed hackathon submission.

## Project layout

- [Puzzle rules](src/shared/rules.ts): immutable exchanges and valid trails.
- [Content bank](src/shared/puzzles.ts): authored places and checked arrangements.
- [Difficulty proof](src/shared/difficulty.ts): conservative terrain lower
  bounds and exact-minimum certification.
- [Shared generator](src/shared/generation.ts): date-seeded daily topology and
  checked practice content.
- [Practice fixtures](src/shared/challenges.generated.ts): the generated
  practice bank, with private solution witnesses.
- [Arrival timing](src/shared/playback.ts): ordered traveler movement, stop
  pauses and arrival events shared by the living and flat views.
- [Living landscape](src/client/island.ts): original procedural terrain, grass,
  water, cottages, exchange movement and traveler.
- [Soundscape](src/client/audio.ts): original synthesized sound; no recordings.
- [Shared API](src/server/service.ts): server validation and ranking.
- [Reddit adapter](src/server/index.ts): authenticated context and Redis.
- [Local adapter](src/local/preview.ts): explicitly labeled loopback rehearsal.

Original game code/assets/levels are not copied from another game. See
[third-party notices](THIRD_PARTY_NOTICES.txt) for the Devvit template
configuration, engine and font licenses.
