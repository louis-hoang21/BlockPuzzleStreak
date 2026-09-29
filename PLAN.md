# PLAN — Block Puzzle: Streak (iOS)

> Trạng thái: **đang code** (Phase 0–6 xong, đã bỏ Daily/streak/đo giờ). Cập nhật: 2026-09-28.

## 1. Phạm vi

| Hạng mục | Quyết định |
|---|---|
| Nền tảng | Chỉ iOS (iPhone). Không hỗ trợ iPad (`supportsTablet: false`) |
| Công nghệ | React Native (Expo) + TypeScript |
| Kiếm tiền | Miễn phí 100%, không quảng cáo, không IAP |
| Mạng | 100% offline, không gọi API, không SDK bên thứ ba có network/telemetry |
| Chế độ | **Nổ hũ** (id `jackpot`, vô tận). **Cổ điển, tôn trọng** (id `classic`, khối rơi) đang lên kế hoạch, §3.2. Tên hiển thị toàn tiếng Việt; id trong code giữ nguyên vì dữ liệu lưu theo id |
| Không làm | Daily Challenge, nhiệm vụ/streak theo ngày, đo thời gian chơi, Adventure, bảng xếp hạng online, Game Center, iCloud, analytics, crash reporting, push notification từ server |
| Thời gian chơi | Không giới hạn số ván và giờ chơi |

## 2. Luật chơi cốt lõi

### 2.1 Lưới và khối
- Lưới 8x8.
- Khay có 3 khối. Đặt hết 3 khối thì sinh 3 khối mới.
- Kéo khối vào lưới: hiện bóng mờ ở vị trí sẽ đặt và highlight trước các hàng/cột sắp bị xoá.
- Vị trí không hợp lệ thì khối trả về khay.
- Hàng hoặc cột đầy thì bị xoá (có animation + haptic).
- Không còn khối nào trong khay đặt vừa lưới ở hướng hiện tại thì Game Over, kể cả khi còn lượt xoay. Lượt xoay là để người chơi chủ động dùng trước khi bí.

### 2.2 Bộ khối
Khoảng 20–30 hình: 1x1; thanh thẳng 2/3/4/5/6 ô (ngang, dọc); chéo 2 ô và chéo 3 ô (chỉ chạm góc, hướng \ và /); L, J, T, S, Z; vuông 2x2, 3x3; chữ nhật 2x3, 3x2; góc 2x2, 3x3.

### 2.3 PieceGenerator
- Random có trọng số theo độ khó. Độ khó tăng theo **điểm trong ván**, không giới hạn: `1 − e^(−điểm/8000)` (khoảng 47% ở 5k, 71% ở 10k, 92% ở 20k, tiến dần tới 100% nhưng không chạm). Càng khó thì khối lớn càng nhiều, tới mức gần như toàn khối lớn. Thanh thẳng (2–6 ô) là một nhóm riêng, độ dài random đều, và càng khó càng hiếm (khoảng 20% số khối lúc đầu, còn khoảng 7% khi rất khó).
- Khối trong khay luôn hiện rõ, kể cả khi không còn chỗ đặt: người chơi tự nhìn và tính.
- Bảo đảm công bằng ở mọi mức khó: **cả 3 khối của mỗi bộ luôn đặt hết được** theo một thứ tự nào đó (có tính việc nổ hũ giữa các lượt). Kiểm tra bằng tìm kiếm có giới hạn; không thoả thì sinh lại tối đa 20 lần, rồi thay dần khối to nhất bằng một khối nhỏ (thanh 2, góc 2, chéo 2), không được mới dùng khối 1 ô, cho tới khi thoả (3 khối 1 ô luôn đặt được).
- Ngoại lệ "bộ ác" (`toughSet` trong `config/balance.json`): từ **8.000** điểm, mỗi bộ có **2%** khả năng bỏ bảo đảm trên; từ 10.000 là 3%, rồi cứ thêm 5.000 điểm tăng 0,5% (15k 3,5%, 20k 4%…), tối đa 10%. Game rút 24 bộ ngẫu nhiên và phát bộ có ít chỗ đặt nhất, miễn là ít nhất 1 khối đặt được ngay. Các khối còn lại có thể không vừa: người chơi phải xếp khéo hoặc dùng lượt xoay.
- Màu nền theo mốc điểm (`core/stages.ts`, `colorStageEvery` = 5.000): 5k sáng (vẫn cảnh của theme, nền trắng), 10k cam, 15k hồng, 20k đỏ; từ 25k cứ mỗi 5k random một trong 4 màu (không trùng màu liền trước, cố định theo seed ván). Lên mốc: pháo hoa, rung màn hình, âm pháo hoa. Chữ trên header đổi tông cho dễ đọc.
- Điểm không có trần; giao diện co chữ để hiện được từ 1.000.000 điểm trở lên.
- Dùng PRNG có seed (`mulberry32`), Jackpot lấy seed ngẫu nhiên. Trạng thái PRNG lưu trong ván nên chơi tiếp được.

### 2.4 Tính điểm
- Đặt khối: +5 điểm cho mỗi ô.
- Nổ hũ n đường (hàng + cột) trong cùng một lượt đặt: `150 × n × n`.
- Combo: mỗi lượt đặt liên tiếp có xoá thì hệ số nhân tăng 1 (x2, x3...). Lượt đặt không xoá gì thì combo về 0.
- Xoá sạch lưới: +1.500 (kèm pháo hoa + "Amazing!").
- Mọi hệ số đặt trong `config/balance.json` để chỉnh lại sau khi test.

### 2.5 Lượt xoay hình (power-up)
- Chạm vào một khối trong khay để xoay 90° theo chiều kim đồng hồ, mỗi lần tốn 1 lượt.
- Tích trữ tối đa **10** lượt. Nhận thưởng khi đã đầy thì hiện "Kho xoay đã đầy" và không cộng thêm.
- Không hoàn lại lượt khi xoay rồi mà không đặt được.

## 3. Chế độ chơi

### 3.1 Nổ hũ (`jackpot`)
Chơi vô tận. Lưu điểm cao nhất, số ván và tổng nổ hũ; không xếp hạng. Kỷ lục lưu riêng theo từng chế độ (`records.<mode>`).

**Màn giải đố (lưới có sẵn khối)** — cấu hình `prefill` trong `config/balance.json`:
- Kỷ lục Nổ hũ < 20.000: mọi ván bắt đầu với lưới trống.
- Kỷ lục ≥ 20.000: mỗi ván mới 30% lưới trống, 70% lưới có sẵn khối để giải đố.
- Màn giải đố có 3 mức, random theo kỷ lục (kỷ lục 20k: dễ 60% / vừa 30% / khó 10%; từ 40k: dễ 25% / vừa 45% / khó 30%; ở giữa nội suy):
  - Dễ (độ khó 0–30%): lấp khoảng 20–27% lưới, 2–3 hàng/cột gần đầy khe rộng, chỉ khối nhỏ và vừa.
  - Vừa (30–60%): lấp khoảng 27–33%, 2 hàng/cột gần đầy khe khoảng 2 ô; từ 50% có thể rải cả khối lớn.
  - Khó (60–90%): lấp khoảng 33–40%, 1–2 hàng/cột gần đầy khe 1–2 ô, có khối lớn.
  - Sau đó khó dần theo điểm như mọi ván.
- Không bao giờ có sẵn hàng/cột đầy; bộ 3 khối đầu tiên luôn có ít nhất 1 khối đặt được.

**Game Over:** phá kỷ lục thì khen; không phá thì hiện ngẫu nhiên câu khích lệ hoặc câu trêu (gần kỷ lục trong 20% thì ưu tiên "suýt nữa"). Câu trong `src/ui/gameOverLines.ts`.

### 3.2 Cổ điển, tôn trọng (`classic`) — khối rơi (KẾ HOẠCH, chưa code)

Nút thứ hai ở màn welcome (hiện đã hiện tên nhưng chưa mở được). Thể loại xếp khối rơi kinh điển: khối rơi từ trên xuống, người chơi di chuyển và xoay để lấp đầy hàng ngang.

**Luật**
- Bảng chơi dạng giếng đứng. Khối 4 ô (I, O, T, S, Z, J, L) xuất hiện ở giữa phía trên, rơi dần xuống.
- Người chơi di chuyển trái/phải, xoay, thả nhanh. Khối chạm đáy hoặc chạm khối khác thì khoá lại sau một khoảng trễ ngắn.
- Hàng ngang đầy thì biến mất, các hàng phía trên rơi xuống. Ghi điểm theo số hàng xoá cùng lúc.
- Kết thúc khi khối mới không còn chỗ xuất hiện (chồng lên tới đỉnh).
- Tốc độ rơi tăng theo cấp; lên cấp sau mỗi N hàng.

**Đề xuất kỹ thuật**
- `src/core/classic/`: engine thuần TS, dạng `step(state, input, dtMs) → state`. Tách hoàn toàn khỏi UI, giống `core/game.ts`.
- Vòng lặp game theo thời gian thực: `useFrameCallback` của Reanimated hoặc `requestAnimationFrame`. Tự tạm dừng khi app xuống nền hoặc rời màn chơi (bắt buộc, vì khác Jackpot, game chạy theo thời gian).
- Render bằng Skia, tái dùng `Block`, theme và skin hiện có.
- Điều khiển cảm ứng: vuốt ngang để di chuyển từng ô, chạm để xoay, vuốt xuống để rơi nhanh, vuốt mạnh xuống để thả thẳng. Có thể thêm nút ảo nếu thử thấy khó dùng.
- Lưu ván dở và tạm dừng (`current-game.classic`); kỷ lục riêng (`records.classic`).

**Cần quyết cùng nhau trước khi code**
1. Kích thước bảng (10×20 là kích thước quen thuộc, xem lưu ý pháp lý bên dưới).
2. Cách sinh khối: ngẫu nhiên thuần hay "túi 7" (mỗi 7 khối có đủ 7 loại, công bằng hơn).
3. Có "hold" (giữ một khối để dùng sau), xem trước mấy khối kế tiếp, bóng mờ chỗ khối sẽ rơi xuống không.
4. Bảng điểm: 1/2/3/4 hàng được bao nhiêu điểm, có nhân theo cấp không.
5. Tốc độ rơi theo cấp và số hàng để lên cấp.
6. Có mốc điểm thưởng lượt xoay / mở khoá theme-skin như Jackpot không. Lượt xoay không có nghĩa trong Classic vì xoay là miễn phí; có thể chỉ tính mở khoá.
7. Điều khiển: chỉ cử chỉ, hay có thêm nút ảo.

**Lưu ý pháp lý (quan trọng khi lên App Store)**
- Tên chế độ là **Classic**. Không dùng tên thương hiệu của trò xếp khối rơi nổi tiếng, hay chữ gần giống, ở bất kỳ đâu (xem CLAUDE.md).
- Luật chơi không được bảo hộ, nhưng "diện mạo" thì có thể. Vụ kiện *Xio Interactive* (2012) xử bên sao chép thua vì giống quá mức về hình thức, trong đó có bảng 10×20 và cách hiển thị khối. Nên tạo khác biệt rõ về giao diện: màu, kiểu khối (dùng skin sẵn có), bố cục, có thể cả kích thước bảng.
- Kết hợp với guideline 4.1 (copycat) của Apple. Nên kiểm tra lại trước khi submit.

## 4. Mốc điểm

Mọi phần thưởng tính theo **điểm đạt trong một ván** (Jackpot). Không có phần thưởng theo ngày hay theo thời gian chơi, nên không cần chống chỉnh giờ. Giá trị trong `config/milestones.json` và `config/cosmetics.json`.

### 4.1 Mốc lượt xoay — lặp lại mỗi ván
Mỗi ván, lần đầu điểm vượt mốc: +1 lượt xoay (vẫn theo giới hạn kho 10; đầy thì hiện "Kho xoay đã đầy").

| Mốc | 5.000 | 25.000 | 30.000 | 40.000 | 50.000 |
|---|---|---|---|---|---|
| Thưởng | +1 xoay | +1 xoay | +1 xoay | +1 xoay | +1 xoay |

50.000 là mốc có thưởng cao nhất; trên đó không còn thưởng.

Lượt xoay nhận giữa ván dùng được ngay, nhưng không cứu một ván đã hết chỗ đặt.

### 4.2 Mốc mở khoá — một lần trên mỗi thiết bị

| Mốc (một ván) | Mở khoá |
|---|---|
| 5.000 | Theme 2 |
| 10.000 | Skin 2 |
| 25.000 | Skin 3 |
| 50.000 | Theme 5 |

Máy mới được tặng sẵn 3 lượt xoay (`startingRotations` trong `config/balance.json`).

## 5. Theme và skin

Tổng cộng **5 theme + 5 skin**, không bổ sung thêm.

| # | Theme | Skin |
|---|---|---|
| 1 | Mặc định | Mặc định |
| 2 | Đạt 5.000 điểm trong một ván | Đạt 10.000 điểm trong một ván |
| 3 | Perfect Clear lần 1 | Đạt 25.000 điểm trong một ván |
| 4 | Perfect Clear lần 2 | Đạt combo x3 lần đầu |
| 5 | Đạt 50.000 điểm trong một ván | Đạt combo x5 lần đầu |

**Perfect Clear:** sau một lượt xoá hàng/cột, lưới trống hoàn toàn. Cộng dồn qua các ván. Mỗi lần Perfect Clear mở theme Perfect Clear kế tiếp còn khoá (Theme 3, rồi Theme 4). Mở hết thì Perfect Clear chỉ còn +1.500 điểm.

**Combo skin:** đạt combo x5 trong khi chưa mở Skin 4 thì mở cả Skin 4 và Skin 5.

Mở khoá xong thì giữ vĩnh viễn trên thiết bị (Keychain).

## 6. Chống gian lận (offline)

Không có phần thưởng theo ngày nên không kiểm tra đồng hồ. Chỉ chống sửa file save:

| Tình huống | Xử lý |
|---|---|
| Sửa file save | MMKV mã hoá AES-256 (key trong Keychain) + HMAC-SHA256 trên mọi payload (Keychain và MMKV). Sai chữ ký thì quay về bản hợp lệ gần nhất, không có thì về mặc định |
| Gỡ app cài lại | Theme/skin đã mở và lượt xoay lưu trong Keychain (`expo-secure-store`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`): còn sau khi cài lại, không chuyển sang máy khác |

> Ghi chú: Apple không cam kết Keychain luôn còn sau khi gỡ app. Thực tế hiện nay vẫn còn. Nếu mất, người chơi mở khoá lại từ đầu, không phải lỗi nghiêm trọng.

## 7. Công nghệ

| Mục | Thư viện |
|---|---|
| Framework | Expo SDK mới nhất, New Architecture, TypeScript strict |
| Render game | `@shopify/react-native-skia` (một Canvas cho lưới + khay) |
| Gesture | `react-native-gesture-handler` |
| Animation | `react-native-reanimated` (logic kéo chạy trong worklet trên UI thread) |
| Điều hướng | `expo-router` |
| State | `zustand` |
| Lưu trữ | `react-native-mmkv` (mã hoá) + `expo-secure-store` (Keychain) |
| Âm thanh | `expo-audio` |
| Haptic | `expo-haptics` |
| Nhắc chơi | `expo-notifications` (chỉ local notification) |

Loại bỏ bắt buộc: `expo-updates` (có gọi mạng), mọi SDK analytics/ads. CI kiểm tra dependency tree để không có package nào dùng network.

## 8. Kiến trúc

```
src/
  app/                  # expo-router screens (chỉ chứa route)
    _layout.tsx
    index.tsx           # Home
    game/jackpot.tsx
    collection.tsx      # Theme / Skin
    records.tsx         # Kỷ lục
    settings.tsx
  core/                 # TypeScript thuần, không import React
    board.ts
    pieces.ts
    pieceGenerator.ts
    scoreEngine.ts
    game.ts             # trạng thái ván: đặt, xoay, Game Over
    rng.ts              # mulberry32
    milestones.ts       # mốc điểm: lượt xoay, mở khoá
    cosmetics.ts        # mở khoá Perfect Clear / combo
    hmac.ts             # SHA-256 + HMAC thuần TS
  render/               # Skia components
  store/                # zustand slices
  persistence/          # mmkv + secure-store + HMAC
  ui/                   # component dùng chung (GameScreen, ModeButton…)
  audio/ haptics/
config/
  balance.json
  milestones.json
  cosmetics.json
plugins/
  withoutPushEntitlement.js  # gỡ aps-environment do expo-notifications thêm vào
assets/
```

`ios/` sinh ra bằng `npx expo prebuild` (CNG), không sửa tay, không commit.

Toàn bộ `src/core` là hàm thuần hoặc class không phụ thuộc UI.

Không viết unit test hay feature test. Kiểm tra bằng typecheck, lint và chơi thử trên Simulator/TestFlight.

### 8.1 Dữ liệu lưu

```ts
// Keychain (còn sau khi cài lại)
DeviceProgress {
  rotations: number              // 0..10
  unlockedThemes: string[]
  unlockedSkins: string[]
}                                // lưu dạng { v: payload, h: hmac } + bản dự phòng .bak

// MMKV mã hoá
LocalState {
  records.<mode>: { bestScore, totalLinesCleared, gamesPlayed }   // không xếp hạng, không top 10
  settings: { sound, haptics, theme, skin }   // reminderTime ở Phase 7
}
```

## 9. Ghi chú phát hành

1. **Tên trên App Store:** chốt **Block Puzzle: Streak**. Không tìm thấy app trùng tên trên App Store US (2026-09-28). Tạo App Store Connect record sớm để giữ tên.
2. Bundle ID: `com.<company>.blockpuzzlestreak`.

## 10. Lộ trình

| Phase | Nội dung | Ước lượng |
|---|---|---|
| 0 | Setup Expo, Skia, Reanimated, Gesture Handler, lint | 2–3 ngày |
| 1 | `core/`: board, pieces, generator, score, rng | 1 tuần |
| 2 | Render + kéo thả + animation xoá + haptic + âm thanh. Jackpot chơi được | 1–2 tuần |
| 3 | Lượt xoay, Game Over, kỷ lục, Settings | 3–4 ngày |
| 4–6 | Theme/skin, mốc điểm (lượt xoay + mở khoá), Keychain, HMAC. (Daily, streak, đo giờ, `trusted-clock` đã làm rồi bỏ) | xong |
| 7 | Onboarding, local notification, polish, cân chỉnh độ khó | 1 tuần |
| 8 | TestFlight, sửa bug, chuẩn bị submit | 1 tuần |

Tổng ước lượng: khoảng 7–9 tuần cho một dev.

## 11. Checklist App Store

- [ ] Apple Developer Program (99 USD/năm)
- [ ] App Store Connect record, bundle ID, tên app duy nhất
- [ ] Chỉ iPhone: `ios.supportsTablet: false`
- [ ] Icon 1024x1024, không có alpha
- [ ] Screenshot iPhone 6.9" (bắt buộc)
- [ ] Privacy Policy URL: trang tĩnh ghi "không thu thập dữ liệu"
- [ ] Support URL
- [ ] App Privacy: **Data Not Collected**
- [ ] Privacy manifest qua `ios.privacyManifests` (UserDefaults, file timestamp, system boot time — `NSPrivacyAccessedAPICategorySystemBootTime`, lý do `35F9.1`)
- [ ] Export compliance: `ITSAppUsesNonExemptEncryption = false` (chỉ dùng mã hoá lưu trữ local)
- [ ] Age rating 4+
- [ ] Không có ATT (không tracking)
- [ ] Mô tả, keyword, category Games > Puzzle
- [ ] TestFlight nội bộ, sau đó beta ngoài
- [ ] Kiểm tra guideline 4.1 / 4.3: không dùng tên, asset, màu nhận diện của Block Blast
