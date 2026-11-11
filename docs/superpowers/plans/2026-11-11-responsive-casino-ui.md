# Responsive casino interface

**Goal:** Replace fixed canvas menu layouts with responsive casino-styled HTML and add a pulsing-logo entry gesture for music and immersive display.

**Design:** User approved responsive menus preserving the game's casino identity and delegated visual decisions. Use plum, felt green, cream, gold and marquee accents. Entry is a fullscreen button with the existing logo and “Click or tap to start”. Its click synchronously starts audio unlocking and requests fullscreen, then reveals the menu even if fullscreen fails. Returning from results goes to the menu without repeating entry. Keep gameplay rendering and touch movement behavior.

**Architecture:** Native menu surfaces own flow, scrolling and minimum 48px controls. Reuse existing controls and handlers to preserve account, leaderboard, name and shop behavior. The shop's 3D preview remains a canvas asset within HTML. Keep only gameplay HUD drawing in the canvas UI.

**Alternatives:** Reflowing canvas controls retains manual sizing and hitbox coordination. Responsive HTML was selected with the user for native sizing, accessibility and scrolling.

## Tasks

- [x] Add a browser regression for entry, gesture API calls, fullscreen rejection, menu navigation, results return, small viewports and touch targets. Observe entry test fail before implementing.
- [x] Implement entry and responsive title/results/leaderboard/achievement menu surfaces; preserve native handlers and player name validation. Gate keyboard/gamepad start behind entry.
- [x] Move shop and account screens to native flow layouts, retaining purchase, conflicts, deletion confirmation, recovery and 3D preview behavior.
- [x] Add casino styling, reduced-motion behavior and safe-area spacing. Inspect screenshots at portrait phone, landscape phone and desktop sizes.
- [x] Update browser harnesses to enter the new splash. Replace obsolete canvas menu assertions with browser coverage; retain HUD tests. Run unit suite, production build and relevant browser flows. Review and fix findings.

## Review focus

- Fullscreen unavailable/rejected: entry still reveals usable menu and audio unlock runs in gesture.
- Short landscape and portrait screens: menus scroll without overlapping buttons; only gameplay requires landscape.
- Live rankings update without replacing focused controls or accepting user HTML.
- Shop/account navigation and confirmations retain behavior and reachable actions.
- First click and keyboard activation do not accidentally start a round; return from results does not show the splash again.

## Execution notes

Continue in the current shared checkout so the earlier Main Menu fix and active preview remain reviewable together. No publish or deployment. Implement directly in this session; final independent review under the review skill.

Validation details and environment limits: [responsive-ui-verification.md](../../responsive-ui-verification.md). Independent review findings on notice layering and focus were corrected and the repeated-pause regression passed.
