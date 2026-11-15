# One Small Detour

A living daily landscape puzzle. Don't move the traveler: move a little piece
of the world.

The daily island is the main game: one shared, date-seeded puzzle per UTC day,
not a finite queue of levels. The separate practice campaign has **200 checked
places**, including the original 42 classic places and three advanced expeditions.
Proved minimums range from one through fifteen exchanges.

[Public source on GitHub](https://github.com/AhmedOsamaAli/one-small-detour) |
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
2. Choose a picture frame matching the required patch area. The buttons show
   the real map orientation; there is no native dropdown.
3. Tap a patch, then another matching, non-overlapping patch. They exchange
   immediately on the second valid tap. Neither may include a pinned building
   or a fixed boulder.
4. Paving, grass, water and decorations move together. There is no separate
   Exchange confirmation. Tap the first patch again or press Escape to cancel
   a selection; use Undo to reverse a completed swap.
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
created. An original drawn courier speaks beside the board and points to the
actual frame or patch, without covering playable targets. The lesson guides
**three real exchanges**, using tall and wide frames, before the traveler walks
through A, B and C. Only the last guided repair completes the road. This is a
teaching sequence, not a claimed optimal score. Guidance follows Undo back to
the relevant repair; there is no duplicated instruction line at the bottom.
The guide then introduces the tools, views, daily ranking and 200 practice places. New rocks and
bridges get a short explanation before that island's countdown starts.
Completing or skipping the guide is remembered; the book can replay it anytime.

Orange frame **1** is the first patch; blue frame **2** is the second. Solid,
white-backed borders are confirmed selections; dashed frames are previews.
Flat view frames the whole rectangular patch, with numbered badges and the same
orange/blue/red feedback as 3D. Hovering or focusing the next patch previews it;
frames never intercept tile clicks. A preview on the selected origin is hidden
so it cannot repaint the confirmed orange patch.
Both Reddit entrypoints suppress the browser's page-wide tap flash on phones.
The game's colored patch frames and visible keyboard-focus outlines remain.
Red previews with **!** indicate an invalid candidate.
The offending home, boulder or overlapping square is highlighted individually,
with a short warning beside the board. Paving is movable; boulders are fixed.
Bridge arrows show their two permitted directions.

The header has direct **Practice map**, sound/mute and book buttons on every
screen size. The book opens the illustrated guide, tile rules and an untimed
guided garden. The garden does not submit scores or count as a daily completion.
Undo is beside the board. A small **3D / Flat** selector changes
the same puzzle's view; first use defaults to 3D and remembers later choices.
There is no Settings menu or duplicate navigation.

**The traveler stays at A until the whole ordered road is ready.** Connecting
only an early home does not start a partial walk or earn an arrival. Once one
continuous, non-retracing trail reaches every home in order, the traveler walks
it with a pause, glow and optional chime **on each arrival**. The full
celebration starts at the final arrival, with the character still visible.
The completion popup appears only after **1.5 seconds of visible celebration**.
Menus and background tabs pause this animation time, not the solve clock.
Earned daily rank and percentage are prominent inside that one popup, only
after successful saving. Closing it returns to the island and Undo; it does
not immediately reopen. **Play more** opens the separate unranked practice map.

Undo during or after the walk cancels old arrival events and returns the
traveler to A. There is no partial-delivery or checkpoint history. New attempts
and puzzles also begin at A. Pending result reveals are cancelled, so a previous
journey cannot open a popup on a new attempt. Reduced motion preserves the full ordered arrival
stamps without continuous walking. Help and map overlays pause playback.
Puzzle rules, certified minimums and existing timed-score keys are unchanged.

### Keyboard and accessibility

- Focus the living island; arrow keys choose a square and Space/Enter selects it.
  Home/End jump to the first/last square.
- Escape clears the cuts.
- The puzzle fits one viewport without page or board scrolling. Short landscape
  screens place the controls beside the map. Completion overlays the scene
  without pushing the board or Undo off-screen.
- Living maps fit the complete board automatically, including buildings and
  landmark labels. Zooming and panning are not needed.
- Flat map fits all individually labeled cells to the available width and
  height, for 6x6, 8x8 and 10x10 maps. Its cells adapt to the screen; keyboard
  navigation remains available when a narrow pane makes them small.
- The device's reduced-motion preference is respected automatically, including
  changes while the game is open. There is no manual motion switch.
- Light/dark appearance follows the browser's preferred color scheme, including
  Reddit/device appearance when the host supplies it. Both entrypoints, dialogs,
  flat tiles, campaign scenery and living-island lighting adapt without resetting
  the puzzle or recreating the 3D scene. There is no extra appearance menu.
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
- Maps range from 6x6 to 10x10, with three to six ordered homes. Advanced maps
  use fixed-rock corridors, directional bridge stock and longer ordered routes.
- The introductory edition has a certified minimum of one; the following weekly
  cycle is 2, 3, 4, 5, 7, 10 and 15 exchanges. These are proved minimums, not
  the number of shuffles used to create a board.
- A bounded generator certifies both solvability and the minimum before serving
  the map. It throws explicitly rather than return unchecked random content.
- A small server-process cache avoids regenerating frequently requested dates.
- **200 checked campaign places** follow one continuous scenic road. Stops are
  numbered in easy-to-hard order, with certified minimums from 1 to 15 exchanges.
  Finishing the first unfinished stop opens the next. Older discoveries remain
  replayable, but do not skip unfinished earlier stops.
- **Tap a number to preview, then Play/Replay to start.** The next unfinished
  stop is preselected. Its illustrated card shows the title, board size, proved
  move goal and whether it is Ready, Completed or Locked. Locked stops explain
  which earlier stop to finish; previewing them never starts a puzzle.
- The map legend distinguishes completed, ready and locked stops. **Find my
  stop** moves the camera; **Daily challenge** opens the separate daily puzzle.
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

The daily generator is shared with the practice-bank tool. Regenerate the
checked practice fixtures deterministically with:

```powershell
node --experimental-strip-types --no-warnings=ExperimentalWarning tools\generate-challenges.ts
```

The original 45 campaign places are preserved. Regenerate the additional 155
checked places with `npm run generate:campaign`. The campaign has 200 distinct
road-decision layouts; independent regeneration is byte-for-byte identical.
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
personal best exists. The client does not fetch a saved rank at startup.
Only after the current attempt finishes its celebration and successfully saves
does the completion popup prominently reveal the rank and **Top 10% today**.
A compact line such as **#5 - Top 10% today** remains available on the finished
island after the popup is closed.
The percentage compares unique valid finishers on
that day's puzzle in this installation, not viewers, all Reddit users or scores
from different days. It includes everyone whose best result is at least as good
as yours, so tied results share an inclusive percentage. Displayed whole
percentages round up, never exaggerating performance; values below 1% show
**Top <1%**. A sole finisher sees **Rank #1 today**, not an invented
percentile. There are no leaderboard tables, tickets or metric tabs. Local
rehearsal is labeled **Local** rather than pretending to be an online community
ranking. Save errors show an explicit retry state without revealing an older
rank. Undo and changing attempts hide the comparison again; saved personal
bests remain intact on the server.

Each puzzle fixes its patch area. The frame pictures are orientations, not
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
Undo followed by another solve creates a distinct result with later elapsed
time from the same original start. It does not reuse a prior win's timestamp.
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
  current completed attempt. A fresh countdown creates a new ranked attempt.
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
independent lower-bound oracle. Campaign tests cover all 200 certificates,
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
Completion tests verify the 1500ms visible celebration hold, menu/background
pausing and cancellation when an attempt is rewound or replaced.
Browser checks also covered the 3D greeting, paused flat celebration pulses,
automatic live device-motion changes and Undo/Restart cancellation. A
reduced-motion flat result appeared after 1539ms, not before the 1500ms hold;
the solve timer remained frozen throughout.

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

- [Play the Reddit example post](https://www.reddit.com/r/one_small_detour_dev/comments/1xweqdk/one_small_detour_a_little_change_a_different_way/).
- [Test community: r/one_small_detour_dev](https://www.reddit.com/r/one_small_detour_dev/).
- [Owner's app page](https://developers.reddit.com/apps/one-small-detour).

The community and example post are public; the app upload is a private
development version, not a reviewed public release. No `devvit publish`
command or Devpost submission has been performed. Building and playing
locally still does **not** upload anything.

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
