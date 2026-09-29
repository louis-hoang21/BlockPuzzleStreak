# Block Puzzle Streak

Offline block puzzle game for iPhone, built with Expo. Game rules and scope: see `PLAN.md`.

## Setup

```bash
npm install
npm run check   # typecheck + lint
npm run ios     # build and run on the iOS Simulator
```

## App identity (`.env`)

Values tied to one Apple developer account are not committed. `app.config.ts` reads them from environment
variables, and the Expo CLI loads a local `.env` file (gitignored) automatically:

```bash
cp .env.example .env
```

| Variable | Used for | When empty |
|---|---|---|
| `IOS_BUNDLE_ID` | iOS bundle identifier | `com.example.blockpuzzlestreak` |
| `APPLE_TEAM_ID` | Signing team written into the Xcode project by `npx expo prebuild` | Pick the team in Xcode |
| `APP_STORE_URL` | "Rate" button opens the App Store review page (`https://apps.apple.com/app/id<Apple ID>`) | Falls back to Apple's in-app rating sheet |

Changing these values needs a new `npx expo prebuild --platform ios` and a rebuild.

## Gift codes (`BPS-XXXX-XXXX`)

A gift code unlocks every theme and skin. The app checks codes offline against a list of SHA-256 hashes in
`config/giftCodes.json`, which is bundled into the build.

**`config/giftCodes.json` is never committed** (it is in `.gitignore`). The salt and the hashing logic are in
this repo, so anyone holding the hashes could brute-force short codes. A fresh clone gets an empty copy of
`config/giftCodes.example.json` (gift codes off) on `npm install`.

### Before building a release

1. Create codes. Each code is printed **once**; only its hash is saved. Keep the printed codes somewhere
   safe (a password manager): they cannot be recovered from the hashes.

   ```bash
   npm run gift-codes -- 5                      # add 5 random codes
   npm run gift-codes -- --add BPS-MY-CODE      # add a code you chose (repeatable)
   npm run gift-codes -- --reset 5              # remove all existing codes, then add 5
   npm run gift-codes -- --list                 # how many codes are active
   ```

   Adding codes turns the feature on (`"enabled": true`).

2. Build the app from this machine. The build uses the local `config/giftCodes.json`.

To turn gift codes off in a build, set `"enabled": false` in `config/giftCodes.json`.

Notes:

- Anyone who extracts the app bundle can still read the hashes. Keeping them out of git removes the easy
  path, not every path, so prefer long random codes over short or guessable ones.
- If the app is ever built with EAS in the cloud, the file is not uploaded (EAS skips gitignored files).
  Provide it to the build another way, for example an EAS file secret.
