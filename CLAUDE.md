@AGENTS.md

## Project rules

- Do NOT write unit tests or feature tests, and do not add Jest or any test framework. Verify changes with `npm run check` (typecheck + lint). Visual checks on the iOS Simulator only as allowed by the rule below.
- NEVER boot, open, launch, or attach the iOS Simulator on your own — no `xcrun simctl boot/launch/openurl`, no `open -a Simulator`, no `npx expo run:ios` / `npm run ios`, and never the Claude desktop embedded simulator panel or its tap/screenshot tools. Only do it when the user explicitly allows it in the current request; otherwise the user starts the Simulator manually. When a change needs a visual check, say so and ask.
- The app is 100% offline: never add packages that make network calls (ads, analytics, crash reporting, `expo-updates`, remote push).
- iOS (iPhone) only. See `PLAN.md` for game rules and scope.
- NEVER use the word "Tetris" (or "tetromino", or any close variant) anywhere: code, identifiers, comments, file names, assets, UI text, App Store metadata, commit messages, or docs. The falling-blocks mode is named **Classic** (`classic` in code). Also don't copy that game's trade dress (look, colors, layout).
- Expo native packages are pinned to the SDK 57.0.11 release set (via `overrides` in `package.json`) so the project builds with Xcode 26.2. Do not run `npx expo install --fix` or bump Expo packages without checking the Xcode requirement.
