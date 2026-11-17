# One Small Detour: submission draft

**Status: a private development build is deployed to Reddit for testing;
the hackathon submission is still pending.**
One public example post was created in the owner-approved test community.
Initial native expansion, authenticated play, automatic score saving, ranking and
score persistence across reload/update have been verified in the desktop
browser. No broad app publication or Devpost submission has been performed.
The GitHub source repository is private; public source and a demo video are
optional under the current event rules. Complete the required submission items
and review the separate native-readiness checks below before submitting.

## Copy-ready project description

### Tagline

Swap a small piece of the world. Find today's way home.

### What it is

One Small Detour is a daily landscape-repair puzzle built for Reddit. Everyone
receives the same checked island for a UTC date. Exchange two matching patches
of terrain to make a continuous trail through the lettered homes, in order,
using the fewest exchanges.

Grass, paving, ponds and wooden bridges trade places together. Homes and
boulders stay pinned. Bridges only connect along their planks, so moving a
piece is also a question of where its connections will work.

The little courier waits at A until the complete ordered road is connected.
He then walks the whole trail and celebrates at each home on arrival.
At the final home, the scene stays visible for 1.5 seconds of celebration
before the result panel appears. Menus and background tabs pause that visual
time; the solve clock and automatic saving are unaffected.
Connecting only an early home does not start a partial walk. Undo cancels
the walk and returns him to A; no delivery checkpoint is carried forward.
Players can experiment freely with Undo; there is no normal Restart control.
A bounded replay limit
of 2,000 exchanges protects score submissions; there is no small puzzle budget.

The daily island is not a 200-day season. Date-seeded generation continues beyond
the practice collection. Existing editions through 2026-11-15 are preserved.
From 2026-11-16 UTC, date-seeded minimums begin at three, vary within 3-5 in
week one and 3-7 in week two, then mix 3-10 with fewer very hard days. Changes
are limited to two moves between consecutive dates, with weekly recovery
targets. Every player still receives the same shared, certified Daily.

### A daily ritual, not a feed of level cards

The daily puzzle opens directly. A separate practice campaign has **212 checked
places** on one continuous, winding landscape. The numbered road progresses
from one-exchange repairs to 15-exchange expeditions. Completing each unfinished
stop unlocks the next; older discoveries stay replayable. The original 200 keep
their relative order and IDs; three certified 12x12 landscapes come last.
Nine new lessons teach three-square strips, 2x2 squares and four-square Ls,
starting at stops 13, 40 and 79. Each island offers only its own family, with
one-, two- and three-exchange lessons. L notches remain outside the patch.
Stop numbers can shift, but previous island IDs, boards, completion flags and
scores remain. Daily frame rules and existing editions are unchanged.

Tapping a number previews the stop, with its illustrated goal card and visible
Ready/Completed/Locked state. A clear Play or Replay button starts it.
Find my stop only moves the map camera, while the daily challenge is always
available without campaign prerequisites.
After a Daily or Practice finish, Continue your journey opens the next unfinished
unranked stop directly; Practice map remains a separate optional browsing action.
Opening the map after a finish automatically centres the next unlocked row
and previews the next stop, including after viewport changes.

Everyone can compare the same daily challenge. The interface shows only the
player's own rank and inclusive top percentage among that day's genuine
finishers only after the current attempt finishes and saves. No old rank appears
before play. Ties share a percentage; a sole finisher sees a rank without a
fabricated percentile or an "Only finisher" label.
Daily wins save automatically. Fewest exchanges remain
the main score; fastest solve time breaks ties. A three-second countdown starts
each attempt, and solve time freezes at the winning exchange, before the final
arrival animation. Undo retains the original start; menus/background time counts.
The server measures time and retains recorded timestamps for safe retries.
From edition November 16, the first saved valid Daily completion is final;
later replays are unranked. Already-saved rollout scores remain frozen.
Server-side first-result reservations cover simultaneous devices and failed-save
retries. Removing a score does not grant another ranked turn for that edition.
Daily Top 10 replaces Practice map in the fixed result footer, beside Continue
your journey, so opening standings never requires scrolling through the result.
There is no sharing form or clipboard control, and saving never posts a comment.

### Design and accessibility

The world uses original procedural Three.js scenery: connected stone lanes,
shader water, grass, cottages, bridges, boulders and an animated courier.
Recessed ponds use depth shading, connected banks and soft moving reflections;
seeded wildflowers and subtle submerged fish remain decorative. Their identities
match across views, move with each patch and return exactly with Undo. Reduced
motion leaves them still, and menus/background tabs pause scenic animation.
Hand-carved A-F letterforms with restrained sprout details appear on home
plaques and matching coloured route badges. The same vector shapes are used
in 3D, Flat, the preview and guide. Normal spoken letters remain available to
screen readers; expressive headings do not replace readable instructions or timers.
Reached homes light up. Selection frames match the actual camera projection.
White-backed arrows point to the starting square directly inside ordinary
orange/blue patch highlights in both views, not only from the tutorial coach.
Invalid selections identify the offending cells with a direct on-board warning.
Paving and fixed boulders have distinct appearances; bridge arrows show their
permitted directions. A visible **?** button opens the illustrated tile rules
and Replay walkthrough directly.
The Web Audio soundscape is original, opt-in and has a visible persistent mute.
Direct header buttons open the practice map and guide, mute sound or switch
light/dark mode with a sun/moon. A small
3D/Flat selector beside the board defaults to 3D; Undo stays directly
reachable. There is no Settings or scoreboard navigation. Saved-data removal
remains available in the guide, and device reduced motion is handled automatically.
Appearance starts in Light, even on dark-mode devices; a chosen mode is remembered
in the browser and applies to the whole UI and matching island lighting rather
than an inversion filter. Theme changes do not reset moves or timing. First visits begin with skippable, untimed hands-on
practice and a short feature walkthrough before the daily countdown. An original
drawn courier moves near actual frame/patch targets with a short pointer.
The player makes three guided exchanges with tall/wide frames before the
complete A-B-C road is ready. Guidance follows Undo and does not cover the
playable targets, selected patches or controls. The hint can cover inactive
scenery and teaches tapping the same starting square again to deselect.
The arrow and ring target only the starting square, with
top/left instructions rather than pointing to the whole two-square patch. Guide
acknowledgements are remembered across app updates for signed-in players; new
boulder/bridge rules are introduced before the relevant island starts.
The guide, privacy confirmation and completion
panels use original illustrations, contextual icons, readable typography
and semantic border colors. Buttons describe their actions instead of using
generic acceptance prompts. Map previews do not start a timer accidentally.

The game fits a single viewport in portrait and landscape, with a fitted flat
alternative, keyboard navigation and reduced motion. The heavy landscape module
loads separately from the lightweight inline Reddit preview and flat view.
Flat patches visibly travel and land over 520ms, with their own colors and
contents intact. Undo animates the reverse; extra input is gated during motion.
Menus and visibility events pause visual movement, while reduced motion keeps
instant exchanges. Winning-tap timing and saved ranking rules are unchanged.
The preview itself is an original miniature island: cosy homes, trees, water
and a courier waiting for a way home. A silent example exchange lets him walk
home and wave; it does not reveal the daily solution. The clear
**Play today's island** button launches the game. Offscreen animation pauses,
reduced motion gets a static scene, and feed scrolling is never captured.
Completion uses one dismissible popup with prominent earned rank/percentage.
Player-facing navigation says **Practice**, with **Continue your journey**
after a win and a separate Practice map browsing action.

### How it was built

React, TypeScript, Three.js, Web Audio, Hono and Devvit Web, with Reddit identity
and Redis behind the native adapter. The server replays submitted exchanges
and recomputes results instead of trusting client scores or user IDs.

Generation retains a legal solution and matches it against a lower bound on
the initially missing paving. This certifies the displayed minimum; a shuffle
count alone would not prove difficulty. The actual solver enforces bridge
directions, ordered stops and a non-retracing final trail.
Small square-frame Practice lessons use exhaustive replay of all shorter
sequences when the paving bound is not tight, within an explicit 20,000-state
limit. Their displayed minimums are not inferred from scramble counts.

### Honest limits

Rearranging worlds is an established puzzle family, including Carto and
Continuity. Our Daily interaction chooses two-cell patches anywhere while
homes stay fixed. We do not claim worldwide novelty or guaranteed prize odds.
Solvability checks and frame-timing samples do not establish human enjoyment,
retention or native phone performance.

## Under-one-minute demo script

Record the actual Reddit example post after the authorized native playtest.
Do not present the local rehearsal as a live Reddit installation.

| Time | Show | Say |
|---|---|---|
| 0-7 s | Inviting miniature preview, expand into the first-visit guide | "Today's small world has a broken way home. The courier shows your first steps." |
| 7-20 s | Two taps exchange a patch; Undo once | "Don't move the traveler. Move two matching pieces of the world." |
| 20-30 s | A boulder and a directional bridge | "Homes and boulders stay put. Bridges must face the right way." |
| 30-40 s | The whole road connects; courier visits the ordered homes | "Finish the whole road first. Then watch every arrival." |
| 40-48 s | Frozen solve time and earned-rank popup after a saved daily finish | "Fewest exchanges first. Time breaks ties. Your score saves itself." |
| 48-57 s | The 212-stop winding road, preview card and one-click mute | "One connected campaign. Preview a stop, then play. The daily island stays available." |

Use genuine recorded gameplay. Do not invent player counts, scores or community
activity. Keep the final video below the event's stated one-minute ceiling.

## Local verification evidence

- Current local source check: **114 tests passed**, all three TypeScript checks passed,
  and the production build passed.
- The final browser gate passed **651 assertions** in three fresh-process
  batches (380 + 191 + 80), with no uncaught browser errors. Batching keeps
  accumulated headless GPU state out of the result; it is not native-phone
  performance evidence.
- Browser verification covers the preview/onboarding/result/header/movement/selection
  flow, including light/dark inline layouts, explicit Play and error
  behavior, static reduced motion, natural feed scrolling and offscreen pause,
  three guided repairs, unblocked tap targets and the earned-rank popup.
  Result actions remain visible on short landscape screens, and closing the
  popup or practice map does not reopen a previous result. Additional checks
  verify manual theme overrides, preserved preferences and live attempts,
  question-mark help, and actual clicks on all six start-square markers in both
  3D and Flat (including resized 3D views).
- Fresh game and preview visits start Light even on dark-mode devices. Saved
  manual Dark choices survive reload, and legacy automatic settings migrate
  without resetting other preferences. Enlarged couriers are checked against
  actual 3D camera bounds and Flat map bounds on all four supported board sizes.
- Invalid first/second feedback expires after one second in both views. Timed
  touch, mouse and keyboard checks cover homes, rocks, bounds and overlap,
  repeat-tap renewal, stationary hover expiry, preserving a good first patch,
  and preventing an old timeout from clearing a newer valid preview.
- The new strip, square and L lessons complete through the actual interface in
  both views. Checks compare occupied-cell highlights and terrain exchanges with
  authoritative replays; L notches remain still during normal swaps and Undo.
  Earlier completion flags remain, and Practice finishes never save a Daily rank.
- Native Daily rankings use a sorted-set index with one personal best per player,
  exact integer move/time ordering, per-player optimistic transactions and
  tie-aware snapshot reads. Legacy records migrate without deletion.
  The indexed result matches an independent full-sort oracle for 100,000
  synthetic finishers, with a fixed 13 adapter operations per ordinary read
  before bounded housekeeping. This is algorithm/call-count evidence, not
  measured native Redis or Reddit throughput. See the
  [ranking system design and platform limits](README.md#ranking-system-design-and-scale).
- Expanded-game sizing uses the visible viewport and safe-area insets. iPhone
  13-sized, high-density portrait/landscape, short browser-height and simulated
  notch/home-indicator cases keep the walkthrough and actions reachable.
  Compact welcome content fits without being hidden below its footer. These are
  browser-emulation checks, not a claim of native iPhone/Reddit certification.
- On-board arrow shafts match the selected frame's actual projected direction;
  their tips still identify the first square. The direction is checked in Flat
  and 3D after portrait/landscape/desktop resizes.
- The board-first layout makes square edges **at least 25% larger at 876x770**
  than the prior layout in that actual user-window size. Both map views retain
  the same fitted controls. Real geometry, fixed-size
  labels, primary controls and the courier at every current road position
  remain inside the tested viewports. Exchanges and Undo also run with
  unclipped moving terrain. This is measured layout coverage, not a claim
  about physical-phone frame rates.
- The selection matrix compares accelerated 3D hit testing with full semantic
  geometry at **1,720 cell/edge samples** across real 6x6, 8x8, 10x10 and 12x12
  islands. Both views exercise every available first/second hover issue category:
  valid, fixed home, boulder, overlap and bounds. Separate rule tests enumerate
  every first/second placement pair on representative boards of all four sizes.
  This is a finite scenario matrix, not a claim about every possible device,
  pointer coordinate or future daily island.
- Shared text/surface token pairs pass 4.5:1 contrast checks in both palettes.
  Actual representative 3D road/grass pixel samples measure **3.17:1 in light**
  and **3.13:1 in dark**; raw terrain palettes are checked for every landscape
  theme. These checks are not a full accessibility certification.
- All 12x12 Practice controls and fitting are checked at nine portrait/landscape
  sizes, in both views and appearances. The original 200 puzzle objects and
  all five released Daily editions through 2026-11-15 match pre-change
  fingerprints exactly. Only future editions use the gradual difficulty schedule.
- Dedicated motion checks verify ordinary-play in-board arrows, real intermediate
  Flat positions, paired terrain identity, reverse Undo, input gating, menu and
  simulated visibility-event pauses, reduced motion, resize/new-attempt cleanup
  and explicit animation-failure recovery. Fitted 6x6, 8x8 and 10x10 boards were
  exercised. Headless visibility simulation is not a physical phone-background
  performance claim.
- Flat selection frames fit 6x6, 8x8 and 10x10 boards at seven screen sizes
  without document scrolling or clipped frames. Both frame orientations,
  numbered hover/focus previews and invalid cuts were checked in the browser.
- The latest date audit covers **14 November 2026 through 13 November 2027**:
  365 distinct terrain layouts, 365 distinct road-decision layouts and 365
  independent regenerations. No solution witness appeared in a public edition.
- The campaign has **212 distinct road-decision layouts**, all certified, and
  preserves every original place and discovery ID. Regenerating the 155 added
  places independently produces byte-for-byte identical content. The year of
  daily editions has no repeated campaign layout.
- All classic and advanced solution witnesses replay successfully.
- Dedicated tests cover bridge direction, immovable boulders, long attempts,
  actual difficulty through 15, rejecting partial-road playback and identifying
  the exact fixed or overlapping cells in an invalid patch.
- Timing tests cover 3-2-1 input blocking, server start/receipt time, forged
  client timing, player/edition binding, expiry, retry idempotency and persistent
  faster equal-move results. Version-5 score keys preserve earlier results
  without changing the version-4 daily puzzle.
- Re-solving after Undo records later time on the original attempt, while a
  save retry keeps its own first recorded timestamp. Faster prior personal
  results are retained rather than overwritten.
- Result reveal has a tested 1500ms visible-celebration hold. Undo, Restart and
  new puzzles cancel stale reveals; changing tabs or opening menus cannot
  consume the character's celebration time.
- A 365-date audit verifies distinct terrain and road-decision layouts,
  certified minimums, no public solution leak and independent regeneration.
  Run `npm run verify:daily` to reproduce it; its printed dates identify the
  exact sample, not the length of the game's season.
- Browser checks include a completed 17-exchange expedition; full A-B-C-D-E-F
  arrivals; unchanged A position while an early home is connected; and Undo
  cancelling a full-road walk back to A without ghost arrivals. Boulder and
  overlap feedback identify the same offending cells in the living and flat
  views. The timer still freezes before the final walking celebration.
- Campaign tests prove all 212 stops unlock in order without a progression
  dead end. Browser wins were used to check actual unlock transitions.
- Browser checks cover previewing without starting, explicit Play/Replay,
  locked-stop messaging, camera navigation to stop 200, touch drags without
  accidental selections and reduced-motion behavior.
- Checked viewport sizes: 320x568, 390x844, 844x390, 1024x768, 1440x900,
  568x360 and a narrow 248x568 pane. Controls, cells and result actions fit;
  primary controls remain at least 44px. Grid cells adapt to board size and can
  be small on narrow 12x12 layouts; Flat and keyboard navigation remain available.
- Renderer diagnostics use isolated headless Edge with SwiftShader on a shared
  machine. Draw/triangle counts, hit-test timings and frame samples are recorded
  separately; they are not physical-phone or native Devvit frame-rate evidence.
- Existing score records are retained under earlier ruleset keys rather than
  compared with the changed version-4 mechanics.

Commands for a local release check:

```powershell
npm run check:release
```

## Local UI previews

These are local UI screenshots, **not** evidence of native Reddit behavior or
community activity. Some validation captures use temporary in-memory fixtures
marked Local; those fixtures do not seed the actual game. Replace or supplement
them with native screenshots from the authorized playtest.

- [Inviting miniature-island preview](submission-assets/preview-mobile.png)
- [The preview in dark mode](submission-assets/preview-dark-mobile.png)
- [Courier-guided three-exchange lesson](submission-assets/tutorial-mobile.png)
- [Start-square arrows during ordinary play](submission-assets/board-start-arrows-mobile.png)
- [A Flat exchange in flight](submission-assets/flat-swap-mobile.png)
- [Daily island, portrait](submission-assets/daily-mobile.png)
- [Moonlit island, portrait](submission-assets/daily-dark-mobile.png)
- [Daily island, desktop](submission-assets/daily-desktop.png)
- [A late 12x12 Practice island](submission-assets/wide-practice-mobile.png)
- [Plant-framed welcome with a choice of views](submission-assets/welcome-mobile.png)
- [Connected campaign with a clear stop preview](submission-assets/campaign-mobile.png)
- [Numbered whole-patch flat selection](submission-assets/flat-selection-mobile.png)
- [Prominent earned-rank popup](submission-assets/completion-mobile.png)
- [Illustrated how-to-play guide](submission-assets/guide-mobile.png)

## Submission requirements and native readiness

All unchecked items are real outstanding work, not assumed successes.

### Required submission items

- [x] Re-read the current [official overview][event] and [rules][rules] in the
  browser on 16 November 2026 (UTC+2). Public source and a demo video are optional;
  the overview asks for upload/playtest rather than broad app publication.
- [ ] Confirm entrant eligibility personally and register for the event.
- [ ] Confirm ownership or suitable licences for all submitted code, art, fonts
  and other materials.
- [x] Prepare the app listing, test community and playable example-post links.
- [x] Include the root README with the game description and how to play.
- [ ] Complete the English Devpost entry and submit it before **8 December 2026,
  6:00 PM Pacific** (9 December, 02:00 UTC / 04:00 UTC+2).
- [ ] Keep the game free and accessible for the full judging period, ending
  **16 December 2026, 6:00 PM Pacific**.

### Deployment and quality checks

These are launch-quality checks; optional presentation items and runtime
advisories are not additional formal hackathon eligibility requirements.

- [x] Sign in with the owner's Reddit/Devvit account; never share passwords
  or authorization tokens in chat.
- [x] Confirm ownership/availability of the `one-small-detour` app name.
- [x] Approve the specific test subreddit and upload/playtest actions.
  The installed CLI says uploads are owner-visible and test installations
  require a subreddit below 200 members. A bare playtest command can create
  a development subreddit: do not run it without an approved target.
- [x] Upload/playtest rather than request broad app publication, as requested
  in the previously reviewed event brief. Do not run `devvit publish`.
- [x] Create the example post only after explicit approval of that public
  action, using the moderator menu.
- [x] Verify native inline expansion, authenticated countdown, a real solve,
  automatic rank/save and Redis persistence across reload and version update.
- [x] Check desktop 3D/Flat switching, mute, guide and campaign access.
  Correct the native modal's overlapping toolbar and verify non-overlapping
  controls with ordinary and maximum-length counters at eleven viewport sizes.
- [ ] Verify logged-out behavior, actual deletion responses and permission failures.
- [ ] Finish testing on real Reddit iOS/Android clients and desktop, including small
  screens, reduced motion, mute, interrupted/backgrounded playback and UTC
  rollover without losing the open board.
- [ ] Check native cold loading and interaction performance. Address the
  remaining large-landscape-chunk advisory based on actual measurements.
- [ ] Review the CLI's Node.js 24 recommendation before the broader release.
  The current Node.js 22 build/upload succeeded; no global runtime was changed.
- [ ] Obtain first-time player feedback on instructions, challenge and fun.
- [ ] Capture genuine native screenshots and, preferably, a 45-55-second demo.
  The video is optional; if supplied, keep it under one minute and publicly
  accessible on a video platform accepted by the rules.

The native configuration enables Redis and the Reddit API. It does not request
post-as-user permissions, telemetry, payments, external fetch domains or automatic
posting. The moderator's create-post action is explicit.

## Deployment and submission links

| Item | Status |
|---|---|
| App page | [one-small-detour](https://developers.reddit.com/apps/one-small-detour), private development upload; v0.1.11 installed only in the existing test community |
| Test subreddit | [r/one_small_detour_dev](https://www.reddit.com/r/one_small_detour_dev/), public |
| Playable Reddit example post | [Open the verified game post](https://www.reddit.com/r/one_small_detour_dev/comments/1xweqdk/one_small_detour_a_little_change_a_different_way/) |
| Demo video | Pending genuine native recording |
| Source repository (optional) | [Private GitHub repository](https://github.com/AhmedOsamaAli/one-small-detour); do not advertise it as public |
| Privacy description | [PRIVACY.md](PRIVACY.md) |
| How to play / technical README | [README.md](README.md) |

[event]: https://redditgameofday2026.devpost.com/
[rules]: https://redditgameofday2026.devpost.com/rules
