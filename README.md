# Playmakruk

Five real-time board games: Thai chess, international chess, Thai checkers, English checkers, and Connect Four. Express and Socket.IO serve the browser app, multiplayer rooms, spectators, chat, and AI opponents.

## Run locally

Use Node.js 18 or later.

```sh
npm ci
npm start
```

Open http://localhost:3000. For a loopback-only preview on another port:

```sh
HOST=127.0.0.1 PORT=3217 npm start
```

`HOST` is optional; when absent, Node's default binding is preserved. Production may set `PORT`. Redis persistence uses the existing `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables. Local runs do not require Redis; without it, room state is in memory and visit counts are local.

## Verify changes

```sh
npm test
```

Tests use Node's built-in test runner and a separate temporary server with Redis disabled. They cover malformed socket payloads, room options for all five games, private-room entry, spectator restrictions, synchronized moves/chat, reconnect clock behavior, AI responses, and language fallbacks. No browser packages are needed for these tests.

## Interface

- `public/index.html`, `public/lobby.js`: game selection and room setup.
- `public/room.html`, `public/room.js`: board, controls, spectators, and chat.
- `public/style.css`: original game, piece, and component styles.
- `public/refresh.css`: shared responsive layouts and accessible controls.
- `public/arena.css`: final navy/lime design and 3D game artwork presentation.
- `public/i18n.js`, `public/theme.js`: Thai/English and saved light/dark preference. New visitors default to dark; saved light mode is respected.
- `public/img/game-*-3d.webp`: four original AI-generated 3D illustration assets, optimized for the web. Both checkers variants share the checkers illustration. These cover illustrations are separate from the interactive WebGL board.

The server reads the room HTML template at startup. Restart the server after changing `room.html` to see template updates. Changes in static CSS/JS need a browser refresh.

The September 2026 refresh keeps the existing engine, hosting architecture, dependencies, public routes, and radio functionality. Self-promotional banners were removed from the play area to make game controls easier to reach. The refresh is ready for the existing Render production service.

## Studio interface (September 10, 2026)

- Room settings are expanded. Increment choices remain visible, with a time-control prerequisite explained next to them.
- Live room cards show actual board positions, public player names, turn, time control and viewers. Private-room player identities remain withheld from lobby metadata.
- Rooms open with an interactive WebGL 3D board and solid pieces. Drag or swipe to orbit through 360 degrees, pinch or use the wheel to zoom, and tap a piece then its destination to move. Top, own-side, opponent-side and focus presets sit below the board. All five games, eight board materials and five applicable piece styles are supported. Connect Four uses an upright board with physical holes and discs.
- Chat supports multiline text, Enter/Shift+Enter, timestamps, reactions and a new-message button while reading older messages.
- Radio uses validated HTTPS streams, a 24-hour cache, bounded directory failover, custom stations and favorites. Invalid saved data does not crash the widget. Late audio callbacks cannot affect a newer station. Pause releases connections, stream timeouts are recoverable, and autoplay denial requires an explicit play gesture.
- HLS.js 1.7.2 light is vendored with its Apache license and lazy-loaded only for browsers without native HLS. Native audio streams need no additional library. Some provider streams can still fail due to availability, certificates, CORS or regional restrictions; the UI offers retry/change station. Radio plays at full native element volume; use device volume controls. The widget deliberately has no volume slider, plus/minus or mute controls. Game sound has its own volume and preview.
- The radio directory excludes entries explicitly identified as TV/video. No stream recording or relay proxy is used. Source documentation: https://docs.radio-browser.info/ and https://github.com/video-dev/hls.js.

Verification: `npm test` covers server gameplay/reconnect/privacy and radio validation, timeout, failover, cancellation and HLS cleanup. Browser checks cover all five games, perspective clicks, responsive layouts, chat and radio interactions. Local demo rooms are created by a separate development script and are not production seed data.

## Immersive board

`public/board-3d.js` builds the table, pieces, studio lighting, move animations and raycast picking. Three.js 0.185.1 and its OrbitControls/RoomEnvironment addons are pinned and served locally from `public/vendor/three-0.185.1/` with the upstream MIT license. No runtime CDN or new server dependency is required.

`room.js` sends canonical board coordinates to the viewer and routes taps through the existing move validation and promotion flow. Dragging and multi-touch never submit a move. Camera changes cannot change the game state. The DOM board remains an accessible, flat 2D alternative; keyboard focus switches it into view. If WebGL2 fails to initialize or its context is lost, play continues in 2D. Focus mode keeps players and turn status above the board and controls below it.

Rendering stops when the scene is still, hidden or disposed. Pixel ratio is capped at 1.6, shadows at 1024, and geometries/materials are released on replacement or navigation. Reduced-motion preference disables move animations. The persistent shell continues to own radio and game audio.

Run the server/rules suite with `npm test`. For the opt-in browser suite, start a separate local server (`HOST=127.0.0.1 PORT=3218 UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= node server.js`), then run `node scripts/test-immersive.cjs` with Playwright installed. Optional environment variables: `PLAYWRIGHT_MODULE` (shared runtime module path), `PLAYWRIGHT_BROWSERS_PATH`, `QA_BASE` and `QA_OUTPUT`. The suite opens private AI rooms and resigns them after checking all games, themes, pieces, rotation, canvas moves from the opponent's view, touch/pinch, focus layout, idle rendering, no-WebGL and context-loss fallback. WebKit mobile emulation is not physical iPhone verification.
