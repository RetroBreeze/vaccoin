# Immersive display and additional controls

**Goal:** Play the existing game with mobile touch or a standard gamepad, with fullscreen and mobile landscape handling.
**Architecture:** Input adapters translate into the existing Player and vacuum inputs. A display adapter handles optional fullscreen/orientation APIs. The existing mouse pointer-lock path stays available. The existing wall-clock round duration remains unchanged when input is suspended.
**Constraints:** Vaccoin only; preserve backend files/assets; no dependencies, backend writes/deployments or gameplay mechanics changes.

- [x] Write and run failing tests for gamepad dead zones, button edges, disconnect/reset, touch pointer ownership/cancellation and display fallbacks.
- [x] Implement input adapters, pixel-style touch overlay and fullscreen/landscape fallback.
- [x] Integrate input activation/pause/resume with existing name, round and results screens, clearing input on blur, hidden pages, rotation and disconnect.
- [x] Verify mocked browser flows on desktop, mobile and simulated gamepad, run unit tests/typecheck/build, review and commit.

Design decisions: left touch stick moves; right drag looks; separate jump and hold-vacuum buttons. Standard gamepad sticks move/look, A/Cross jumps, RT vacuums, Start plays/pauses/resumes and A plays from title/results. Fullscreen uses an explicit button or F; mobile Play requests fullscreen and landscape without blocking play on rejection. Unsupported portrait orientation displays a rotate prompt. No new gameplay pause mechanic: as with existing pointer-lock loss, input stops while the 60-second clock continues.

Verification: 69 unit tests, strict TypeScript and production build pass; all eight browser scripts pass. Mobile touch events and a standard gamepad were simulated in Chromium, including round restarts and gamepad-to-mouse takeover. Native fullscreen was exercised; rejection/missing APIs and orientation fallback have focused coverage. Mobile screenshots were inspected. Physical mobile devices and controllers remain a manual check.
