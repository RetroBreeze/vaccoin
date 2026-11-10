# Vaccoin leaderboard implementation plan

**Goal:** Integrate the installed Supagame SDK into the existing name and results flow.
**Spec:** User's integration request in this session.
**Architecture:** A caller-owned Supabase client uses normal browser persistence. The existing Leaderboard controller owns coalesced identity setup, immutable round submissions, bounded UI waits and server standings; Canvas2D renders those states.
**Constraints:** Work only in Vaccoin; no backend deployments, gameplay changes, dependencies or fabricated live scores. Preserve pre-existing work. Execute inline in the explicitly requested checkout.

- [x] Add focused tests with injected SDK services for profile persistence, offline operation, score validation, deduplication, retries and rankings. Observe failures.
- [x] Replace placeholder bridge with installed SDK and VITE client bootstrap. Keep one in-flight identity operation and one immutable attempt per completed round; retries retain UUID and original player.
- [x] Wire the existing name confirmation without awaiting network before pointer lock. Show final score, server personal best, rank, top 10 and loading/error/retry states in existing Canvas UI.
- [x] Test rendered results and browser flows against intercepted HTTP only. Run existing tests, typecheck and production build. Review diff and commit only integration changes.

Review focus: auth failures must never create replacement identities; timeout must not clear pending submissions; late prior-round responses must not overwrite current-round status; rankings failure after accepted submission must not resubmit; absent config/storage/backend must preserve play.

Verification: 57 unit tests pass; TypeScript and production build pass. Browser flow, mocked SDK integration, production smoke, 60-second round (4,165 coins), storage/pointer-lock compatibility and explosions pass. Browser harness movement checks wait for target positions to accommodate slow headless rendering. No gameplay mechanics changed.

Review fixes: accepted submissions followed by hung ranking reads now allow fresh reads after a bounded wait; missing secure UUID APIs preserve offline completion. Both regressions were observed failing before fixes and now pass.

Final browser verification: all seven scripts pass, including springboards and the complete main browser flow.
