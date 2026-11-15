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

Campaign unlocking is based on those browser-local discoveries. It is not a
competitive or server-authoritative entitlement. Undo history and unfinished
attempts remain in page memory; refreshing starts a fresh attempt. The traveler
waits for the complete road; no partial-delivery history is stored.

The app does not load external analytics, advertising, runtime AI or remote
fonts. Nature geometry, sound and fonts are bundled or created locally.

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
the next visit. Campaign progress, view and sound choices remain. A fresh
attempt can rank again after a new countdown.
Changed game rules use separate score keys. Timed daily scores use version-5
keys while puzzles remain version 4. Older untimed and classic results remain
separate and erasable.

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
