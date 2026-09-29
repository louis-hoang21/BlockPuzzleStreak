# App Store submission: Block Puzzle: Streak

Everything needed to fill in App Store Connect. Character limits are Apple's.

## 1. Links

| Field | Value |
|---|---|
| Privacy Policy URL (required) | `https://louis-hoang21.github.io/BlockPuzzleStreak/privacy.html` |
| Support URL (required) | `https://louis-hoang21.github.io/BlockPuzzleStreak/support.html` |
| Marketing URL (optional) | `https://louis-hoang21.github.io/BlockPuzzleStreak/` |

The pages live in `docs/`. Turn on GitHub Pages: repo **Settings → Pages → Build and deployment → Deploy from a branch → `master` / `/docs`**, save, wait a minute, then open the links in a private browser window. GitHub Pages is free on a public repo; a private repo needs a paid GitHub plan.

## 2. App Information

| Field | Value |
|---|---|
| Name (≤30) | `Block Puzzle: Streak` |
| Subtitle (≤30) | `Xếp khối, nổ chuỗi, phá kỷ lục` |
| Primary language | Vietnamese |
| Category | Games → Puzzle (secondary: Games → Casual) |
| Content rights | Does not contain third-party content |
| Age rating | 4+ (answer **None** to every question) |

## 3. Version page (Vietnamese)

**Promotional text (≤170)**

```
Kéo khối, nổ hàng và cột, giữ chuỗi combo để điểm tăng vù vù. Thêm chế độ khối rơi Cổ điển. Chơi offline, không quảng cáo.
```

**Description (≤4000)**

```
Block Puzzle: Streak là game xếp khối gọn nhẹ, chơi hoàn toàn offline, không quảng cáo, không mua trong ứng dụng.

CHUỖI NỔ
• Kéo khối từ khay vào lưới 8×8, lấp đầy hàng hoặc cột để nổ.
• Nổ nhiều hàng cùng lúc và nổ liên tiếp để lên combo, điểm tăng theo cấp số.
• Nổ sạch bàn để nhận Amazing và mở theme mới.
• Lượt xoay giúp bạn xoay khối khi bí, nhận thêm khi vượt mốc điểm.
• Càng lên cao càng khó: khối lớn nhiều hơn, thỉnh thoảng có bộ khối “ác”.

CỔ ĐIỂN
• Chế độ khối rơi: di chuyển, xoay, thả thẳng, giữ khối, xem trước 3 khối tiếp theo.
• Lên cấp sau mỗi 10 hàng, khối rơi nhanh dần.

SƯU TẬP
• 5 theme và 5 skin khối, mở bằng điểm, combo và nổ sạch bàn.
• Nền đổi màu theo mốc điểm, pháo hoa khi phá kỷ lục.

• Âm thanh, rung, nút điều khiển và nhắc chơi mỗi ngày tuỳ chỉnh trong Cài đặt.
• Không cần mạng, không thu thập dữ liệu.
```

**Keywords (≤100, comma separated, no spaces needed)**

```
xếp khối,khối,block,puzzle,chuỗi nổ,giải đố,offline,combo,xếp gạch,trí tuệ,khối rơi,brain
```

Do not put other games' names (competitors or trademarks) in the name, subtitle or keywords (guideline 2.3.7).

**What's New (for updates)**

```
Thêm chế độ Cổ điển, hiệu ứng nổ mới, rung mượt hơn và cân bằng lại độ khó.
```

## 4. Optional English localization

| Field | Value |
|---|---|
| Subtitle | `Drag, clear lines, set records` |
| Promotional text | `Drag blocks, clear rows and columns, chain combos for big scores. Plus a falling-block Classic mode. Offline, no ads.` |
| Keywords | `block,puzzle,blocks,brain,offline,combo,line clear,falling blocks,casual,relax` |

Description: translate section 3 (same structure).

## 5. App Privacy

- **Data collection:** "No, we do not collect data from this app" → label **Data Not Collected**.
- Tracking: none. No App Tracking Transparency prompt is needed.
- The privacy manifest is already set in `app.json` (`ios.privacyManifests`).

## 6. Export compliance

`usesNonExemptEncryption: false` is set in `app.json`, so App Store Connect does not ask again. The app only encrypts its own local save data.

## 7. Screenshots

Required: **iPhone 6.9"** (1320×2868 or 1290×2796, portrait), 3 to 10 images. Suggested set:

1. Chuỗi Nổ board with the rainbow line preview while dragging.
2. A multi-line clear with the "xN Combo" banner.
3. New record fireworks.
4. Classic mode mid-game.
5. Collection screen (themes and skins).
6. Game over card.

Avoid showing any other game's name or artwork.

## 8. App Review Information

- Sign-in required: **No**.
- Contact: your name, phone and email (only Apple sees these).
- Notes (paste, then replace the placeholder with the two reviewer codes; never commit the codes):

```
The app is fully offline: no account, no network, no ads, no in-app purchases, no data collection.
Two modes: "Chuỗi Nổ" (drag blocks onto an 8x8 grid to clear rows/columns) and "Cổ điển, tôn trọng" (a falling-block mode).
Themes and skins unlock by playing (score milestones, combos, clearing the whole board).
Daily reminders are optional local notifications; permission is asked only when the player turns them on in Settings.
Settings has an optional gift code field. A code unlocks all cosmetic themes and skins, the same ones players earn by playing. Codes are handed out for free by the developer; nothing is sold and no money is involved. Codes for review: <CODE 1>, <CODE 2>
```

## 9. Before pressing Submit

- [ ] Version `1.0.3` (or newer) and a build number not used before (`ios.buildNumber` in `app.json`).
- [ ] `.env` has the real `IOS_BUNDLE_ID`, `APPLE_TEAM_ID`, `APP_STORE_URL`, then `npx expo prebuild --platform ios`.
- [ ] Decide on gift codes (see below), then build: Xcode → Clean Build Folder → Archive → Distribute App → App Store Connect.
- [ ] Build finished processing, tested on TestFlight.
- [ ] Build attached to the version (Distribution → the version → Build → Add Build).
- [ ] GitHub Pages is on and both links open in a private browser window.
- [ ] Screenshots, description, keywords, category, age rating, App Privacy filled in.
- [ ] Pricing: Free, availability: chosen countries.

### Gift codes and review

Decision: keep the gift code field on. The review notes above explain it and give Apple two working codes. Guideline 3.1.1 bars codes that unlock paid content; here codes only unlock free cosmetics and nothing is sold. If review still objects, set `"enabled": false` in `config/giftCodes.json` and resubmit.
