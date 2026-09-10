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
- `public/img/game-*-3d.webp`: four original AI-generated 3D illustration assets, optimized for the web. Both checkers variants share the checkers illustration. The interactive board remains a DOM grid; the cover artwork is not a WebGL renderer.

The server reads the room HTML template at startup. Restart the server after changing `room.html` to see template updates. Changes in static CSS/JS need a browser refresh.

The September 2026 refresh keeps the existing engine, hosting architecture, dependencies, public routes, and radio functionality. Self-promotional banners were removed from the play area to make game controls easier to reach. The refresh is ready for the existing Render production service.

## Studio interface (September 10, 2026)

- Room settings are expanded. Increment choices remain visible, with a time-control prerequisite explained next to them.
- Live room cards show actual board positions, public player names, turn, time control and viewers. Private-room player identities remain withheld from lobby metadata.
- Boards use generated transparent piece atlases plus a CSS perspective camera (not WebGL meshes). Tilt 0–45°, rotate −180–180°, top view and both player viewpoints are available. Camera settings and eight board palettes persist locally. Connect Four retains its upright gravity layout.
- Chat supports multiline text, Enter/Shift+Enter, timestamps, reactions and a new-message button while reading older messages.
- Radio uses validated HTTPS streams, a 24-hour cache, bounded directory failover, custom stations and favorites. Invalid saved data does not crash the widget. Late audio callbacks cannot affect a newer station. Pause releases connections, stream timeouts are recoverable, and autoplay denial requires an explicit play gesture.
- HLS.js 1.7.2 light is vendored with its Apache license and lazy-loaded only for browsers without native HLS. Native audio streams need no additional library. Some provider streams can still fail due to availability, certificates, CORS or regional restrictions; the UI offers retry/change station. Volume behavior on iOS depends on browser/device support.
- The radio directory excludes entries explicitly identified as TV/video. No stream recording or relay proxy is used. Source documentation: https://docs.radio-browser.info/ and https://github.com/video-dev/hls.js.

Verification: `npm test` covers server gameplay/reconnect/privacy and radio validation, timeout, failover, cancellation and HLS cleanup. Browser checks cover all five games, perspective clicks, responsive layouts, chat and radio interactions. Local demo rooms are created by a separate development script and are not production seed data.
