# Submit One Small Detour

Checked against the [official rules](https://redditgameofday2026.devpost.com/rules)
on **21 November 2026**. This is a preparation guide, not a record that the
entry has already been submitted.

**Current build: `small-detour` v0.1.3 (installed in `r/small_detour_dev`; `v0.1.1` remains in unlisted review).** It contains the complete 1,000-puzzle,
four-family no-surplus Practice replacement and preserved earlier routes/
progress. The tutorial uses one hands-on lesson followed by six illustrated
rule cards (including home order and no repeated road squares). The question
mark opens Help with Replay walkthrough first.
Water tiles now keep individual visible rims in both views; this visual-only
update does not change puzzles, ranking or saved progress.
When more Practice stars are needed, continuation opens the map so the player
chooses a completed stop to improve rather than being assigned a replay.
Phone completion controls now have larger continuation targets and more space;
the portrait map gives Play/Replay a full-width row. Home also offers explicitly
opted-in daily inbox reminders. Deployment does not subscribe anyone automatically,
and phone alerts depend on Reddit settings.

**Deadline:** 8 December 2026, 6:00 PM Pacific = 9 December, 02:00 UTC /
04:00 UTC+2.
**Keep judging access open until:** 16 December, 6:00 PM Pacific =
17 December, 02:00 UTC.

## 1. Confirm your personal eligibility and join

- [ ] Sign in to Devpost and
  [join the hackathon](https://redditgameofday2026.devpost.com/).
- [ ] Personally confirm age, location, team-representative authority and the
  rules' employment/family/judge/conflict exclusions. Do not assume eligibility
  from the fact the game works.
- [ ] Confirm the rights to the project and all submitted material. Original
  code is MIT; font, template and CC0 source-art notices are retained.

The rules allow either a new project or a significantly updated existing one.
Explain the substantial changes made during the submission period if needed:
the certified 1,000-stop revision, state-aware Home, four illustrated guide cards,
art/performance work, persistent progress and local-time reset display.
Do not give an invented creation date.

## 2. Check the working Reddit entry

Use these clean canonical URLs, not challenge-token or local preview URLs:

| Field | Link |
|---|---|
| App listing | https://developers.reddit.com/apps/small-detour |
| Test subreddit | https://www.reddit.com/r/small_detour_dev/ |
| Interactive post | https://www.reddit.com/r/small_detour_dev/comments/1y6qwml/one_small_detour_a_little_change_a_different_way/ |
| Source | https://github.com/AhmedOsamaAli/one-small-detour |

- [ ] Open the actual post signed out and signed in.
- [ ] Confirm the subreddit is public and remains below the rules' 200-member
  test threshold. These live settings must be checked, not inferred from CLI
  installation success.
- [ ] Test current native play on desktop and the Reddit phone clients:
  expand, guide, a real repair, result/save, Flat/3D, mute, and background return.
- [ ] Confirm the Home countdown shows the same next Daily instant in local
  time, not a different local-midnight puzzle.
- [ ] Keep the app free and accessible through the judging end date.

### Do we need more actions on Reddit?

**No extra post or broad `devvit publish` is required by the reviewed rules.**
They ask for an uploaded app listing, test subreddit and a post running the
game. The same existing post and community are the intended judging links.
The combined release, including the 6-card route tutorial, phone controls, and
opt-in inbox reminders, is installed in `r/small_detour_dev` under `small-detour`.

If the subreddit is public and judges can access the post, there is no reason
to install the optional `dr-admin-approve` app. The rules offer it as an
alternative for administrator access when necessary, not a mandatory dependency.
Do not install extra apps or create community posts without deciding to do so.

Local responsive checks, older authenticated checks and CDN hashes do **not**
certify fresh physical-phone behavior or live logged-out access. The unchecked
native checks above remain real work.

## 3. Upload the film to YouTube

Use the prepared **`upload-cinematic-v2`** package, not the older gallery.
It contains:

- The approved 80-second MP4.
- `youtube-thumbnail.jpg` and its smaller alternative.
- `youtube-title.txt`, `youtube-description.txt`, `transcript-en.txt`.
- `YOUTUBE_UPLOAD.md`, which walks through Studio settings and captions.

- [ ] Follow that upload guide on the intended channel.
- [ ] Use the exact transcript for auto-sync; preview the captions.
- [ ] Wait for HD/copyright processing and check audio.
- [ ] Make the video publicly visible and allow embedding.
- [ ] Test the watch link signed out, then paste it into Devpost.

### Be precise about the 80-second film

The optional video **should be under one minute**, and judges need not watch
beyond one minute. The approved film is **80 seconds**. The owner chose to keep
it and declined a separate short cut.

It is a designed coded-3D trailer using actual assets and valid examples, not
continuous footage of the native Reddit app. The rules also recommend showing
the game functioning on its intended device. Do not describe this as an
under-one-minute or unedited gameplay recording. The real game link and clear
written explanation are essential; ask the organizer if stricter video
interpretation needs resolving.

## 4. Add the project image and gallery

Use the seven cinematic PNGs in order:

1. **01-cover** - the distinctive idea.
2. **02-gameplay** - the actual interaction.
3. **03-terrain** - what moves and what stays.
4. **04-challenge** - deeper planning and the Practice campaign.
5. **05-daily** - the actual unsolved November 21 Daily board.
6. **06-your-view** - views and devices.
7. **07-daily-top-10** - podium and ten clearly illustrative move/time results.

Use the short captions in `GALLERY.md`. These are authentic designed
presentation assets, not evidence of community usage. The separate Top 10
scene explicitly says its Demo scores are illustrative, not live; keep that
disclaimer visible when cropping or publishing.

## 5. Fill the Devpost fields

### Project name

**One Small Detour**

### Tagline

**Move the world, not the traveler. A daily landscape puzzle on Reddit.**

### Inspiration

We wanted a daily puzzle that feels like a little place worth returning to.
Instead of steering a character, you move pieces of the landscape. A tiny
exchange can turn a broken route into a good road home.

Reddit gives that solitary moment a shared setting: everyone gets the same
daily island, can compare their first finished result, and can return to the
same community tomorrow.

### What it does

Pick two equal-shaped, non-overlapping terrain patches and swap them. Build a
single road through the homes in their displayed order, without revisiting a
square. The courier only starts once the complete route works.

Roads, grass, trees, water and bridges move together. Homes and boulders stay fixed.
Bridge ends connect along their planks, but their sides do not; nothing rotates.

Each UTC day brings one shared challenge. A signed-in player's first completed
result is ranked by fewest exchanges, then server-measured time. Replays are
unranked. Home shows when the next island opens in the player's local timezone.

Between Dailies, explore 1,000 Practice puzzles across 50 islands and seven
landscapes. Pairs, strips, squares and Ls combine with longer home orders.
Every road tile is necessary; proved minima rise from 3 to 8 exchanges without
restarting at each island. Older earned progress and original routes are kept.
Choose 3D or Flat, Light or Dark. One playable lesson teaches the swaps; four
concise cards show moving/fixed terrain, both bridge axes and selection.

### How we built it

Devvit Web hosts the interactive Reddit post. React handles the interface,
Three.js renders the miniature world, and TypeScript modules share the rules
between client, server, local rehearsal and offline content verification.

The server uses Reddit's authenticated context and Redis for timed attempts,
first-result reservations, rankings and account-scoped Practice progress.
It replays repairs instead of trusting a client score or elapsed time.

Practice is constructed offline from solved routes, then checked for exact road
inventory, move lower bounds, real preparation dependencies, structural variety
and a globally ordered curriculum. All 1,000 boards are freshly replayed and
graded; heuristic grades are kept separate from human-playtesting claims.
The shared Daily generator remains independent and date-seeded.
Batched terrain, bundled assets and visibility-aware presentation keep
the interface responsive. The local reset countdown is a small Home-only
component; its ticks add no requests or 3D work.

### Challenges we ran into

Whole-patch selection had to be understandable on touch screens. We used
complete outlines, visible start arrows and practical guides rather than
asking players to infer bridge or fixed-tile rules.

We had to preserve earned progress as the campaign evolved, distinguish
Practice results from ranked Daily finishes, and make retrying a failed save
recover the first result instead of awarding a new competitive attempt.

The miniature art needed to remain readable in Flat/3D and Light/Dark without
overlapping controls or hiding mistakes behind animations.

### Accomplishments we are proud of

- A clear world-swapping interaction followed by a genuine ordered journey.
- A complete shared Daily loop with authoritative first-result ranking.
- 1,000 active Practice puzzles, stable archived routes and preserved progress.
- A hands-on lesson, concise illustrated rule cards and coherent seasonal art in both views.
- A next-Daily display that respects local time without splitting the challenge.
- An approved branded trailer and gallery based on actual game assets.

### What we learned

A beautiful board is not enough: players need to know exactly what can move,
what can connect, and when a route is complete. Small interaction and timing
details matter as much as the puzzle generator.

Engineering checks can establish valid puzzles and safe persistence. They do
not establish human enjoyment or long-term retention; those need real players.

### What's next

Broader first-time-player testing, physical-device verification, and difficulty
refinement based on observed play. We want the daily ritual to stay easy to
enter while the planning grows deeper.

### Built with

Devvit Web, TypeScript, React, Three.js, Redis, Vite.
If a separate presentation-tools field is relevant, disclose Gemini for trailer
narration. **The playable game has no runtime AI requirement.**

## 6. Verify the public source

- [ ] Open the GitHub URL signed out.
- [ ] Confirm the README, architecture guide, MIT license and source are visible.
- [ ] Confirm private environment files, local scores, progress records and
  cache output are absent. Do not upload private backups or audit folders.

Public source is optional under the rules. The owner explicitly approved
publishing the cleaned release. Source visibility is separate from Devvit
marketplace publication and YouTube/Devpost submission.

The locked dependencies build locally. This machine's public npm-registry
probe failed at TLS, so a clean external install is not yet certified. Do not
claim a fresh-network setup test that was not completed.

## 7. Preview, then submit

- [ ] Recheck every required field and all links.
- [ ] Verify the playable post, images and video without owner-only access.
- [ ] Check the feature description against the installed game, not experimental
  review branches or presentation-only scenes.
- [ ] Save and preview the draft.
- [ ] Personally review the eligibility/rules declarations.
- [ ] Click the final submission button before the deadline.
- [ ] Confirm the entry appears as submitted to this hackathon, not merely in
  your portfolio. Keep the confirmation and project URL.

**Preparation does not equal submission.** No video upload or final Devpost
submission has been made by these steps.

## Optional extras

The developer-feedback form can qualify for the separate Most Valuable
Feedback prize. Use specific real SDK/documentation feedback, not invented bugs.
It is not required for the main project entry.

Do not market guaranteed prize odds, proven addiction, worldwide novelty,
fictional rankings or universal device performance.
