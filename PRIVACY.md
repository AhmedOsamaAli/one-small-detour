# Privacy and data handling

This describes the implemented game. It is not a claim that a public Reddit
deployment has been reviewed or approved.

## Browser-only information

The browser stores display/sound preferences, including an explicit light/dark
choice, discovered-place IDs and a copy
of acknowledged or skipped guides. Local development also uses a random
rehearsal identifier, which is not a password or production authentication
credential. The production client does not send that local identity header.
Native identity comes from Reddit.

Practice worlds additionally keep the lowest move count for
each completed Practice stop and the number of opened campaign islands in that
same browser record. Stars are derived from those move counts, not time.
Earlier completion-only discoveries keep a completion star without inventing
move history. This browser-only record is included in the v0.1.10 and v0.1.11
test builds. From the v0.1.12 test build, the game additionally syncs
it for signed-in players; it is never part of a Daily leaderboard.

Campaign unlocking is based on those browser-local discoveries. It is not a
competitive or server-authoritative entitlement. Unfinished
attempts remain in page memory; refreshing starts a fresh attempt. The traveler
waits for the complete road; no partial-delivery history is stored.

The app does not load external analytics, advertising, runtime AI or remote
fonts. Nature geometry, sound and fonts are bundled or created locally.

The next-Daily countdown uses the server-provided shared UTC reset time.
The browser formats its opening time with the player's local timezone.
That timezone is not saved, transmitted or used to split leaderboards.
The display updates only while Home is visible; it adds no per-second requests.

## Account Practice sync

The game saves signed-in Practice progress to a per-player
record in this community: known completed Practice stop IDs, the player's
lowest move counts, opened-island count, revision and reset generation.
Reddit's authenticated context determines identity; submitted player IDs are
not trusted. It stores no Practice moves, unfinished boards, freeform text,
device identifiers or private messages. A same-community account token in
browser preferences prevents mixing records when switching Reddit accounts.
Guest progress stays on the device.

Practice records have no automatic 30-day expiry: they persist until the
player uses Guide -> Manage Practice progress -> Remove Practice progress.
This operation removes the stop/move records and keeps a minimal reset
generation so older devices cannot immediately re-upload cleared progress.
Daily records and view/sound choices are not removed. The separate existing
score-removal control continues to preserve Practice progress.

A separate browser-local copy of the existing opaque account identifier and
reset generation lets newer code detect resets made by older cached clients.
It contains no stop IDs, move records, scores or new tracking identifier.
The account's authoritative reset generation still decides which data is valid.

Sync occurs at load, after local progress changes and when returning to the
page. Failed sync is shown with a retry action; local progress remains.
The local server uses ignored `.local/practice.json` for rehearsal persistence.
Native storage uses per-player Redis records, isolated to this community's installation.

## Remembered walkthrough choices

The app remembers up to three fixed guide flags: basics, boulders and bridges.
This stops completed or skipped introductions repeating on every visit; synced
choices also survive app updates for signed-in players. No step-by-step history,
tutorial timings or tutorial moves are stored.
Acknowledging a guide does not create a timed attempt, score or ranked participant.

For signed-in players, these flags are also linked to the platform identifier
within this community's installation. Native flags expire within 31 days of
their last update. Guest choices stay in browser storage only; the local
development server keeps its synced flags in memory. Failed sync is reported,
and does not prevent play. The device motion preference is read locally.
Appearance starts in Light, independently of the device theme; manually saved
Light/Dark choices are preserved, and legacy automatic settings migrate to Light.
A chosen appearance stays in browser storage, is not synced to the
server, and is shared only between this app's same-origin preview and game.
Existing local progress is preserved when the new preference is introduced.
No appearance-tracking record is collected.

## Automatic daily scores and timed attempts

Signed-in daily results save automatically once the trail is solved. The backend
validates the moves and stores the player's identifier, displayed name, score,
exchange count, solve time and submission time. Practice does not submit scores.
Logged-out players can play without a leaderboard record. The backend does not
store a supplied client score or elapsed time as truth.

Starting a daily countdown creates a short-lived, player-bound attempt record:
random attempt ID, player ID, edition, rules/ranking versions and server start
and expiry times. Completed repairs retain a one-way hash of their normalized
exchanges, an opaque per-solve identifier and server-measured duration, not the
raw solution. Retries keep the same solve identifier; solving again after Undo
uses a new one. Native attempt
records expire within 24 hours and a per-player index prunes older attempts.
Local attempt records are memory-only; saved local scores remain on disk.

On Reddit, identity comes from the platform context, not a client-provided user
ID. The game displays the current player's rank and daily top-percentage only
after the current daily attempt has finished and successfully saved. It does
not fetch or display a previous rank before play. Own exchange count and solve
time remain available.
The percentage is derived from unique valid finishers on the same edition in
this installation. Viewers and scores on other days are not included, and a
sole finisher has no percentage comparison. Tied best results receive the same
inclusive percentage. No additional player data is collected for this statistic.
Legacy leaderboard responses can also contain submitted display names and repair
scores. No private messages or profiles are returned. No Reddit comment,
subscription or account action is performed by saving a score.

Reddit records are scoped to this app's community installation and expire within
30 days of their challenge edition. The game checks account existence while
refreshing the village board, with a short active-account cache, and removes
records when the account is reported unavailable. Actual Reddit deletion
responses must be verified in the authenticated platform playtest before
publication.

The current player can use **Guide -> Manage saved data -> Remove my records** to
remove their records from this installation. A per-player index records the
daily score keys needed for erasure; expired dates are pruned and the index
expires if inactive. It does not store solutions, private messages or profiles.
Removing records also removes active timed attempts and the synced guide flags,
clears the browser's guide acknowledgements, and prevents the current completed
run from automatically re-saving itself. The walkthrough can appear again on
the next visit. Campaign progress, view and sound choices remain. Earlier Daily
editions allow a fresh ranked attempt; editions from November 16 keep the
used-turn marker described below.
Changed game rules use separate score keys. Timed daily scores use version-5
keys while puzzles remain version 4. Older untimed and classic results remain
separate and erasable.

## First-result Daily ranking

From edition **2026-11-16**, each signed-in player has one ranked completed
result per edition in this community. A first-result reservation stores the
verified score, name, platform identifier and an opaque solve identifier, with
the same 30-day edition expiry as the leaderboard. It contains no raw exchanges.
If the ranking write fails after reservation, Retry save recovers that original
result instead of allowing a later faster replay to replace it. Scores already
present when the policy was enabled are preserved as the frozen baselines.
Later replays receive no ranked attempt token; previously opened attempts are
also checked against the first-result reservation on the server.

Removing records deletes the score, displayed name and original reservation
contents. A minimal used-turn marker remains for that player and edition until
the edition expires, so deletion cannot grant another ranked result. The marker
contains no name, score, elapsed time or solution. New Daily editions are still
eligible. Earlier editions retain the original personal-best rules.

## Local rehearsal

Local scores are private development data in `.local/scores.json` on the host
computer. The file is excluded from Git. Expired editions are filtered from
display and dropped on subsequent writes; a stopped local server cannot
automatically erase its disk file. Its owner can remove it, or use **Manage saved
data** in the game guide to remove their records.

The local server binds to `127.0.0.1`; do not expose this development service as
an authenticated public leaderboard.

## No extra profiling or collection

The app does not request passwords, read private messages, infer sensitive
personal characteristics or sell player information. Freeform user content,
payments and automated public posts are not part of this implementation.
