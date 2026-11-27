# Submission and release status

The complete [step-by-step submission guide](SUBMIT_STEP_BY_STEP.md) includes
ready-to-paste project text, required links, gallery order, YouTube settings,
personal eligibility checks and the final confirmation step.

## Current release

**Devvit `small-detour` v0.1.5** (submitted for unlisted Reddit review update and installed in `r/small_detour_dev`) is live in
[r/small_detour_dev](https://www.reddit.com/r/small_detour_dev/), on the
[interactive post](https://www.reddit.com/r/small_detour_dev/comments/1y6qwml/one_small_detour_a_little_change_a_different_way/).

It includes the shared next-Daily countdown and local opening time on Home.
The Daily still resets at 00:00 UTC for everyone. The timer is isolated from
the game/3D renderer, stops while hidden or unmounted, and adds no per-second
API requests.

The installed Practice campaign is now the complete four-family replacement:
1,000 active puzzles with exact necessary-road inventory and proved minima
from 3 through 8 exchanges. All 1,448 earlier routes remain archived under their
original IDs. Prior stars/access remain credit, not fabricated new-board solves
or move records. Older campaign clients remain supported.

Daily generation, ranking keys and first-result policy are unchanged. No
player reset, new Reddit post or broad marketplace publication was performed.

### Phone controls and optional inbox reminders (v0.1.26)

Phone completion actions have larger continuation targets and more space, with
secondary buttons stacked on narrow screens. The portrait Practice map keeps
Play/Replay on its own full-width row rather than squeezing it beside the title.

Home also includes explicitly opted-in daily Reddit inbox reminders. Installing
the release activates the scheduler, not automatic subscriptions. Existing
player choices are preserved; phone alerts still depend on Reddit settings.

- All 256 tests, three TypeScript checks and the build passed. Earlier phone/
  desktop layout and real navigation checks passed without persistent guest
  account or score writes.
- All 170 release inputs stayed unchanged during upload. Every one of the 41
  delivered client files matches the upload-built release: 39 byte-identical
  assets and two HTML entrypoints with only the official Devvit SDK injection.
- An explicit in-place upgrade and an independent installation listing confirm
  v0.1.26 in the same authorized test community.
- The signed-in Reddit web post loaded its v0.1.26 inline splash and expanded
  Home. The live reminder preference was read successfully. No new post, score
  or reminder subscription was created by these deployment checks.

Actual scheduled inbox delivery, fresh signed-out play and physical-phone
behavior remain separate checks; opening Home does not certify them.
No public launch review, App Directory publication or promotional post was made.

### Top 10 username/badge fit + backend, map, and transition performance (v0.1.5)

- Fixed Top 10 player cell layout with flex alignment so full usernames
  (including 16+ char names) and the `You` badge never clip across 1, 2, 6, 10,
  and 11 rows on Galaxy Fold (`344×660`), Galaxy S24 (`360×650`), Ultra, iPhone
  15, Galaxy Tab, and Desktop (`0px` scroll).
- Backend: cached the 2,448-entry catalog per revision, indexed `findPuzzle` in
  O(1) maps, and added `Cache-Control: public, max-age=3600` for immutable
  `/api/places/:id` puzzle responses.
- Dashboard & Practice Map: virtualized the 50-island map to mount only nearby
  islands (40 stops / 2 SVG regions on open instead of 1,000 stops / 50 regions,
  a ~96% DOM reduction) and switched star totals to O(20) achievement lookups.
- Transitions: added client-side puzzle caching, silent background prefetching
  of the next Practice stop on Home and during play, and idle 3D engine/model
  warm-up on Home.
- All 258 unit tests, three TypeScript checks, production build, and multi-device
  browser checks passed. Published as `small-detour` `v0.1.5` (unlisted review)
  and installed in `r/small_detour_dev`.

### Equal buttons, auto-sized Top 10, full stop names, and Light Mode contrast (v0.1.4)

- Matched sibling button widths and heights across Home, Daily completion,
  Practice completion, Saved Top 10, and Tutorial Cards (no oversized/tiny pairs).
- Auto-scaled Top 10 table density by row count (`16px` for 1–4 rows, `15px` for
  5–8 rows, `13–14px` for 9–11 rows) and widened the Top 10 popup to `640px`.
- Moved Practice Map stars into the stop eyebrow so full stop names always show
  without truncation, renamed `Find stop` to `My stop`, and fixed Light Mode
  disabled/`Locked` button contrast (`9.78:1`).
- Verified across 6 devices (`344×660` Galaxy Fold through `1280×740` desktop)
  with 0 layout, contrast, or clipping issues; all 258 unit tests pass.

### Galaxy & real-device Reddit WebView polish (v0.1.3)

- Verified across 9 realistic Reddit WebView dimensions (Galaxy Fold cover
  `344×660`, Galaxy S24 `360×650`/`360×720`, Galaxy Ultra `384×710`, Galaxy
  A55/Pixel `412×760`, Galaxy Landscape `720×330`, iPhone 15 Pro `393×720`,
  Galaxy Tab S9 `800×1080`, Desktop `1280×740`) plus inline splash `344×320`
  and `360×320` (0px scroll).
- Saved Top 10 uses natural card height (no empty vertical stretching), readable
  13–14px font, a header Home icon, and two roomy 1-line bottom buttons
  (`Practice` and `Replay unranked`).
- Practice Map puts stars beside the stop name with a compact `Play` button on a
  60px bottom bar so the map stretches taller on phones.
- Practice completion uses a Home button instead of `X`, trims wording/spacing
  for 0px scroll on compact phone webviews, and uses proportional 40–42px buttons.

### UX, Top 10 scoreboard, 45-star gate, and bigger gameplay map (v0.1.2)

- Top 10 scoreboard fits all 10 entries (plus the player's own row when outside
  the top 10) without scrolling across phones, tablets, and desktop, with aligned
  tabular numbers.
- Home places Today's Daily and Practice above the fold without scrolling, moves
  Remind me daily into a compact expandable strip below both cards, and styles
  Replay unranked, Map, Top 10, and Guide as clear clickable buttons.
- First-visit Home and the final tutorial card make the Demo-to-Daily unlock
  explicit, with Play today's Daily and Home choices; the Practice Map and
  walkthrough dialogs use a Home button to return to the homepage.
- Island star requirement is raised from 30 to 45 of 60 stars per 20-stop island
  (preserving previously unlocked islands) and displayed on Home, Practice Map,
  Practice completion, and Help.
- Gameplay trims outer margins, borders, and HUD chrome so the playable board
  fills 97% of phone width and 91% of desktop height.
- All 258 unit tests, three TypeScript checks, production build, and responsive
  browser checks passed. Installed in `r/small_detour_dev` as private `v0.1.2`;
  `v0.1.1` remains queued for unlisted Reddit review.

### Route-rule tutorial cards and `small-detour` launch submission (v0.1.1)

The walkthrough now has six illustrated cards. Two new leading cards
contrast A-B-C with A-C-B and show why returning over a road square is invalid,
with the repeated square marked `2x`. The illustrations use the actual journey
rules to distinguish correct and incorrect routes.

All 258 tests, three TypeScript checks and the build passed. Forty-eight browser
layout cases cover the six cards on phones, short landscape views and desktop
in Light/Dark. Real lesson completion, early-close Daily locking, final-card
unlocking and preservation of genuinely earned Practice progress also passed.

The release is uploaded as `small-detour` v0.1.1, submitted for unlisted Reddit
launch review, and installed in public
[r/small_detour_dev](https://www.reddit.com/r/small_detour_dev/) with its live
[interactive post](https://www.reddit.com/r/small_detour_dev/comments/1y6qwml/one_small_detour_a_little_change_a_different_way/).

### Water-tile clarity update (v0.1.24)

Water squares retain individual rims beside neighbouring water in both 3D
and Flat. Usable bridge ends remain open, and the rims follow actual exchanges.
Water animation, puzzle data, account records and ranking policy are unchanged.

- All 237 source tests, three TypeScript checks and production build passed.
- The exact upload-built client passed 53 water-boundary browser checks across
  Light/Dark, Flat/3D, phone and desktop layouts, including real selection,
  deselection and exchanges. The fixtures made no live account or score writes.
- All 34 delivered runtime files match the tested v0.1.24 output.
- The upload-built server is byte-identical to v0.1.23.
- Explicit installation and a separate CLI listing confirm v0.1.24 in the same
  authorized test community. No new post or marketplace publication was made.

### Player-chosen star replays (v0.1.25)

When an island needs stars, Home and result continuation now opens the Practice
map without assigning a replay. The map starts unselected on the relevant
island and asks the player to choose a completed stop with fewer than three
stars. Normal next-stop continuation and explicit replays remain unchanged.

All 237 source tests and type checks/build passed. The exact upload-built client
passed 98 navigation checks using a genuinely earned twenty-stop star gate,
player-selected replays, improvements to the unchanged 30-star threshold and
ordinary continuation to the next new stop. The same upload also passed all 53
water-boundary checks.

All 34 delivered runtime files match the tested v0.1.25 output. The upload-built
backend remains byte-identical to v0.1.24. Explicit installation and a separate
CLI listing confirm v0.1.25 in the same authorized test community. No new post,
progress reset or marketplace publication was performed.

### Retained campaign/tutorial verification (v0.1.23)

The following content and migration evidence was established for v0.1.23.
Those shared rules, puzzle banks and existing progress storage are unchanged in v0.1.26.

- All 235 source tests, three TypeScript checks and production build passed.
- A fresh full audit replayed/regraded every new puzzle: 295 pairs, 271 strips,
  234 squares and 200 Ls. All paving/bridge tiles are used in each legal repair.
  Exact minima, all four global non-regression measures, functional duplicate/
  near-clone limits, family revisits and preparation quotas passed.
- 599 puzzles have a proved necessary preparation step. Sixty-eight generation
  recipes were independently reconstructed; all 1,448 old routes replayed
  unchanged. Structural grades are not a calibrated human-difficulty study.
- The annual Daily audit verified 365 distinct editions from 21 November 2026
  through 20 November 2027, with no campaign repeat in that sample.
- 232 tutorial/Help browser checks cover four no-scroll cards, first-card
  replay, actual lesson completion, early close, unlocks and genuine progress.
- 65 browser checks played late 12x12 boards in all four families in Flat and
  normal-motion 3D, with actual controls, free deselection and layout checks.
- Nineteen genuine frozen-v0.1.22 upgrade/save/reset checks passed against both
  source and the actual upload-built client. An old-client account reset no
  longer resurrects newer unknown completion IDs.
- The exact upload-built client passed three timezone/layout Home/Help/guide
  cases with real lesson swaps, all four cards, final unlock and the expected
  ephemeral guest countdown. These fixtures made no live account/score writes.
- All 34 delivered runtime files match that checked output: 32 binary assets
  and two HTML entrypoints normalized for the normal Devvit bridge.

Devvit invokes its build during upload. Asset-name ordering can change between
builds, so the upload-built output was checked and compared directly rather
than assuming an earlier hash manifest still described it.

The existing post page was also opened successfully signed out. That is not
proof of embedded-game play, fresh authenticated play or physical-phone
certification. The owner still needs the native-device checks in the guide.

## Installed tutorial and Help

Lesson one retains its three genuine swaps and courier journey. Its completion
now leads directly to six illustrated rule cards instead of the fixed-tile
and bridge puzzle chapters. They cover home visit order (A-B-C vs A-C-B),
no repeated road squares (reused square marked `2x`), moving/fixed tiles,
horizontal bridges, vertical bridges, and wide-left/tall-top/square-and-L-top-left selection.
Grass and trees share a movable icon. Each bridge card contrasts a home's
four accepting sides with a valid bridge end and blocked bridge side.
Selecting the same start again clears the first choice at no move cost.

Back/Next follows the reader's pace. Only the final Ready to play action records
the guide flags; closing early keeps a new player's Daily locked. Existing
unlocks and genuinely earned Practice results remain intact.

Opening the question mark presents a prominent Replay walkthrough card first;
the detailed tile rules and account-data controls follow it.

Essential card content fits the measured 320x480, small portrait, landscape
and reduced-visible-height layouts without scrolling. An accessible scrolling
fallback remains for exceptionally small windows. The checks include real
Flat/3D lesson completion, partial close/reload, keyboard completion,
reduced motion and light/dark appearance.

## Source

[GitHub repository](https://github.com/AhmedOsamaAli/one-small-detour).
The public privacy page ([PRIVACY.md](PRIVACY.md)) includes daily reminder data handling.
The owner authorized publication of the reviewed release and selected MIT for
original code. Template, font and CC0 source-art notices are retained separately.
Local/private records, environment files and generated caches are excluded.

See [README](README.md), [architecture](ARCHITECTURE.md),
[license](LICENSE), [third-party notices](THIRD_PARTY_NOTICES.txt) and
[privacy](PRIVACY.md).

A local full-history and staged-release secret scan found no leaks.
No private environment/data paths are in the reachable history or release.
This is a targeted secrets/hygiene check,
not a claim that every possible vulnerability has been eliminated.

The locked dependency set builds on the preparation machine. A fresh public
npm-registry check failed at TLS; external clean installation is not certified.

## Film and gallery

The owner approved the final **80-second coded 3D film** on 21 November 2026.
Both MP4 and WebM contain 4,800 individually rendered 1080p60 frames, have
passed full decoding, and place all eight genuine Gemini Puck narration clips
within 5 ms of their intended starts. Both played to completion without
buffering waits or stalls in the local check; no universal zero-drop claim is made.

The film includes legal gameplay, moving/fixed tile cards, bridge rules,
real 3/4/5-minimum Practice examples, landscapes, views, Daily and devices.
Harder excerpts are explicitly opening moves, not fabricated wins. The
film contains no invented players or scores. Some filmed Practice examples
belong to preserved earlier banks; their exchanges remain legal.

The separate cinematic-v2 package contains seven newly rendered gallery scenes
and 4K/1280 thumbnails using actual game models. Its Daily scene uses the real
unsolved November 21 board. Its dedicated Top 10 scene uses Demo 01 through
Demo 10, a podium, and clearly labeled illustrative scores, not live standings.
Keep that disclaimer visible. Device images are local responsive captures,
not evidence of native community activity. No YouTube/Devpost upload was made.

The earlier native recordings and Blender film were rejected and remain
archived outside the public source. They are not selected submission footage.

### Video limitation to acknowledge

The [official rules](https://redditgameofday2026.devpost.com/rules) say the
optional video should be under one minute, judges need not watch beyond one
minute, and it should show the app functioning on its intended device.
The selected film is an **80-second designed trailer**, not uninterrupted
native device footage. The owner declined a separate short cut.

Do not claim it is under one minute or hide that limitation. Keep the written
explanation and real game link complete.

## Final submission is still an owner action

- [ ] Personally confirm eligibility and register for the event.
- [ ] Confirm the live subreddit is public, below 200 members, and accessible
  to judges. No extra post or broad app publication is required.
- [ ] Complete fresh signed-in/logged-out and physical-device checks.
- [ ] Upload the approved video on the intended YouTube channel and test
  public visibility, HD, audio, captions and embedding.
- [ ] Enter the English project fields, images and links on Devpost.
- [ ] Preview, accept declarations personally, submit and retain confirmation.
- [ ] Keep the game free and accessible through the judging period.

**Deadline:** 8 December 2026, 6:00 PM Pacific (9 December, 02:00 UTC).
**Judging access through:** 16 December, 6:00 PM Pacific
(17 December, 02:00 UTC).

No YouTube upload, final Devpost submission, extra Reddit post or broad
`devvit publish` is implied by preparation or source publication.
