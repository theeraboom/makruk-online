# Game rules review — 10 September 2026

This review covers the five playable variants. The former “International Checkers” label was inaccurate: its engine is English/American 8×8 checkers, not FMJD 10×10 draughts. The game remains 8×8 and is now named English Checkers / หมากฮอสอังกฤษ. Existing room identifiers and saved games remain compatible; newly created English games start with Black.

## Corrections and verification

- Thai checkers: kings must land immediately behind the captured enemy; compulsory capture permits any route, not maximum capture. Captured pieces are removed immediately, including reverse captures. Crowning ends the turn.
- English checkers: Black moves first; men move/capture forwards, kings have short diagonal steps. Crowning ends a capture chain. Draw claims cover repetition and forty moves per side without capture or an uncrowned man advancing.
- Both checkers variants: the running clock continues through each jump and the increment is added once, after the complete turn. Bot search follows the same crowning boundary.
- International chess: four promotion choices are validated by the server and preserved in history. King capture is prohibited. Castling, en passant and pinned moves are checked. Perft counts match 20/400/8,902/197,281 from the initial position and 48/2,039/97,862 from the standard castling reference position.
- Repetition keys include side to move, castling rights and only a legally usable en-passant square. Threefold/50-move claims, optional claims before an announced qualifying move, fivefold/75-move automatic draws and checkmate precedence are implemented. Existing saved move histories reconstruct the counters; new snapshots store the draw state.
- Thai chess: movement, initial placement and sixth-rank Met promotion are checked. Counting is opt-in for the weaker side once no unpromoted pawn remains. Board count is 64. Bare-king piece count starts after the total number of pieces, with rook → khon → knight precedence and limits 8/16/22/44/32/64. The attacker retains the final reply; a started piece-count limit stays fixed after captures. The user can stop a count or change a board count to a piece count when eligible.
- Connect Four: gravity, full-column rejection, both diagonal directions, horizontal/vertical wins and move-history replay are checked. Invalid column indices are rejected.
- Draw offers require acceptance from the other player; spectators cannot accept. Draw claims cannot avoid a flag that has already fallen. A player with only a king cannot win an international-chess timeout. Thai timeout material uses the handbook’s minimum-force principle.

## Scope and remaining limits

These are online casual games, not a certified tournament arbiter. Physical touch-move rules, illegal-move penalties, seeding/ballots, and discretionary referee rulings are not simulated. Thai checkers’ discretionary 16-move count is not automated; agreement and repetition claims are available. The Thai book itself records different local counting conventions; this implementation explicitly uses its rook → khon → knight order.

Automatic dead-position recognition covers the common provable material cases: bare kings, a single bishop/knight against a bare king and bishops confined to the same colour in international chess; bare kings and a lone Met/knight against a bare king in Thai chess. It is not an exhaustive proof engine for every locked-pawn or unusual blocked position. Those positions can be resolved by player agreement or the applicable move/count limit. Two knights against a bare king are not automatically declared dead in international chess, because a cooperative mating sequence can exist.

Browser QA uses desktop Chrome and a 390px mobile viewport. Live COOL playback is measured through Web Audio; a deterministic audio signal also verifies the volume ratio and continuity through lobby → game → back → forward → rules → back. This does not claim a physical-iPhone listening test. For a stream that does not permit Web Audio and a browser that cannot change media-element volume, the interface explicitly asks the listener to use device volume. Reloading the entire tab or leaving the website is not an internal navigation and may require tapping Play again.

## Primary references

- [FIDE Laws of Chess](https://handbook.fide.com/chapter/E012023), especially articles 3, 5, 6.9 and 9.
- [WCDF English rules reproduced by North Carolina Checkers Association](https://nccheckers.org/NCCA/WCDF%20Checker%20-%20Draughts%20-%20English%20Rules.htm), 1.13, 1.16, 1.19–1.21 and 1.32. The WCDF rules endpoint was unavailable during review.
- [Thai government textbook ทช32004](https://cmi.dole.go.th/bookcenter/%E0%B8%97%E0%B8%8A32004.pdf), printed pages 74–82: movement, counting, time and draw rules. The web text was accessible; the direct download and screenshot endpoints were unavailable.
- [MindSports Thai Checkers implementation rules](https://mindsports.nl/index.php/arena/draughts/500-thai-checkers): exact capture landing, immediate removal and promotion boundary.
- [Hasbro Connect 4 instructions](https://instructions.hasbro.com/en-gb/instruction/the-classic-game-of-connect-4).

## Release verification

Run `npm test` for movement, draw, timing, persistence reconstruction, sharing and radio lifecycle regressions. Browser evidence and the release summary are retained in the Codex task outputs. Production is checked again after deployment; local passing tests alone are not a deployment result.
