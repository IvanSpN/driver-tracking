# Project instructions

## Frontend: iPhone-first product

- The application is primarily used on smartphones, especially iPhones in Safari. Treat mobile behavior as a required acceptance criterion for every change under `apps/frontend`, even when the task does not explicitly mention mobile support.
- Design mobile-first: make the base layout work on narrow screens, then add enhancements for wider screens. Preserve desktop and tablet usability, but prioritize the iPhone experience when tradeoffs are unavoidable.
- Before finishing any frontend task, review every affected screen and state at narrow viewport widths. At minimum, account for 320, 375, 390, and 430 CSS-pixel widths, portrait orientation, and landscape where the changed UI could be constrained.

## Responsive layout

- Do not introduce horizontal page scrolling at supported mobile widths. Long text, identifiers, tables, maps, and action rows must wrap, scroll within an intentional container, collapse, or switch to a mobile presentation.
- Prefer fluid sizing (`width: 100%`, `max-width`, flex/grid wrapping, `minmax()`, and `clamp()`) over fixed widths. Avoid fixed heights for content that can grow or wrap.
- Stack controls and actions vertically when they no longer fit comfortably. Primary actions should remain easy to find and should normally become full-width on narrow screens when that improves usability.
- Keep essential content and controls visible without relying on hover. Do not make hover the only way to reveal an action or explanation.
- For fixed, sticky, fullscreen, modal, sheet, or bottom navigation UI, account for iPhone notches and the home indicator with `env(safe-area-inset-top)`, `env(safe-area-inset-right)`, `env(safe-area-inset-bottom)`, and `env(safe-area-inset-left)` where relevant.
- Do not rely on `100vh` alone for full-height mobile UI. Prefer modern dynamic viewport units such as `dvh`/`svh` with a sensible fallback when necessary, and consider Safari's expanding browser chrome and on-screen keyboard.

## Touch controls and buttons

- Interactive targets must be comfortable for touch. Buttons, links used as controls, icon buttons, checkboxes, and similar controls should have a touch target of at least 44 by 44 CSS pixels, even when the visible icon is smaller.
- Leave sufficient spacing between adjacent actions to reduce accidental taps. Do not place several small text links tightly together as the primary mobile interaction.
- Button labels must not be clipped. Allow wrapping or adapt the layout for long/localized labels. Avoid fixed button widths unless the content is guaranteed to fit.
- Every interactive element must have clear pressed, focus-visible, disabled, loading, and error behavior where applicable. Prevent duplicate submissions while an action is in progress.
- Icon-only controls require an accessible name such as `aria-label`. Use semantic `button` and `a` elements instead of clickable generic containers.
- Support touch, pointer, and keyboard input. Do not depend on mouse-specific events or gestures without an accessible alternative.

## Forms and the iOS keyboard

- Keep form-control text at least 16 CSS pixels to avoid unwanted Safari zoom on focus.
- Use the appropriate HTML `type`, `inputmode`, `autocomplete`, and `enterkeyhint` so iPhone users get the correct keyboard and autofill behavior.
- Give every field a persistent label. Keep validation messages close to the field and do not communicate errors using color alone.
- Ensure focused fields and primary actions remain reachable when the iOS on-screen keyboard is open. Be cautious with nested scrolling, fixed-position elements, autofocus, and scroll locking in modals.

## Mobile accessibility and performance

- Preserve readable text, adequate contrast, visible focus indicators, semantic structure, and support for larger text without clipping or overlapping controls.
- Respect reduced-motion preferences for nonessential animation.
- Keep mobile interactions responsive and avoid unnecessary large assets, excessive JavaScript, or layout shifts. Assume that users may have a slow or unstable cellular connection.

## Frontend completion checklist

- For every frontend implementation or review, explicitly check mobile layout, touch targets, text wrapping, form behavior, loading/error/empty states, and iPhone safe areas relevant to the change.
- When a browser preview is available, inspect the affected UI using responsive device emulation and, when feasible, iPhone Safari or an equivalent WebKit environment. Do not claim device or browser testing that was not actually performed.
- After frontend changes, run the smallest relevant checks and normally run `npm test --workspace=apps/frontend` and `npm run build --workspace=apps/frontend` before declaring the task complete. If a check cannot run, report that clearly.
