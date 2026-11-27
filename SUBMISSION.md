# Submission and release status

The complete [step-by-step submission guide](SUBMIT_STEP_BY_STEP.md) includes
ready-to-paste project text, required links, gallery order, YouTube settings,
personal eligibility checks and the final confirmation step.

## Current release

**Devvit `small-detour` v0.1.1** (submitted for unlisted Reddit launch review) is installed in
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
