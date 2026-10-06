import type { Localized } from '../i18n';

const fmt = (n: number) => n.toLocaleString();

type Line = (score: number, best: number, gap: number, losses: number) => Localized;

const NEW_BEST: Line[] = [
  () => ({ en: 'Top of the top! A brand-new record.', vi: 'Đỉnh của chóp! Kỷ lục mới toanh.' }),
  (s) => ({ en: `${fmt(s)} points! Those are golden hands.`, vi: `${fmt(s)} điểm! Tay này là tay vàng rồi.` }),
  () => ({ en: 'Record smashed. Keep that form!', vi: 'Phá kỷ lục ngon lành. Giữ phong độ nhé!' }),
  () => ({ en: 'Your old record just got sent into retirement.', vi: 'Kỷ lục cũ vừa bị bạn cho về hưu.' }),
];

const SO_CLOSE: Line[] = [
  (_s, _b, gap) => ({ en: `So close! Just ${fmt(gap)} points short.`, vi: `Suýt nữa thôi! Thiếu đúng ${fmt(gap)} điểm.` }),
  (_s, _b, gap) => ({
    en: `Only ${fmt(gap)} points off your best. One more round and it falls!`,
    vi: `Chỉ cách kỷ lục ${fmt(gap)} điểm. Làm ván nữa là phá!`,
  }),
  (_s, b) => ({ en: `Your ${fmt(b)} record is shaking in its boots.`, vi: `Kỷ lục ${fmt(b)} đang run lẩy bẩy rồi đấy.` }),
  () => ({ en: "You're so close, don't quit now!", vi: 'Gần lắm rồi, đừng bỏ cuộc lúc này!' }),
];

const ENCOURAGE: Line[] = [
  () => ({ en: 'Next round will be even better!', vi: 'Ván sau chắc chắn ngon hơn!' }),
  () => ({ en: "Warm-up's over, now it gets real.", vi: 'Khởi động xong rồi, giờ mới chơi thật nè.' }),
  () => ({ en: 'Place a bit smarter and the blasts keep coming.', vi: 'Xếp khéo một chút là nổ liên tục đó.' }),
  () => ({ en: 'Keep your combo going longer and watch the points fly.', vi: 'Thử giữ combo lâu hơn xem, điểm tăng vù vù.' }),
  () => ({ en: 'Everyone has an off day. One more!', vi: 'Ai cũng có ngày xui. Ván nữa nào!' }),
];

const TEASE: Line[] = [
  () => ({ en: 'Did a little kid really out-stack you?', vi: 'Bạn thực sự xếp hình thua một đứa trẻ ư?' }),
  () => ({ en: "The neighbor's 5-year-old just beat this score.", vi: 'Em bé 5 tuổi nhà hàng xóm vừa phá kỷ lục này đấy.' }),
  () => ({ en: 'My cat could stack like that.', vi: 'Xếp kiểu này thì mèo nhà mình cũng làm được.' }),
  () => ({ en: 'Shaky hands? Or are the blocks slippery today?', vi: 'Tay run à? Hay khối hôm nay trơn quá?' }),
  () => ({ en: "It's just an 8x8 grid, not rocket science.", vi: 'Lưới 8x8 thôi mà, đâu phải giải toán cao cấp.' }),
  (s, b) => ({
    en: `Only ${fmt(s)} points? Your best is ${fmt(b)}!`,
    vi: `Mới ${fmt(s)} điểm thôi á? Kỷ lục của bạn là ${fmt(b)} cơ mà!`,
  }),
  (_s, _b, _g, losses) => ({
    en: `Lost to your record ${fmt(losses)} times. Gonna let that slide?`,
    vi: `Thua kỷ lục ${fmt(losses)} lần. Định để yên vậy sao?`,
  }),
  () => ({ en: 'Out of moves for real? Your record is smirking.', vi: 'Hết chiêu thật rồi à? Kỷ lục đang cười khẩy đấy.' }),
  () => ({ en: "Looks like the blocks don't like you much today.", vi: 'Có vẻ hôm nay các khối không ưa bạn lắm.' }),
  () => ({ en: 'The 3x3 block says hi.', vi: 'Khối 3x3 nhờ mình gửi lời hỏi thăm.' }),
  () => ({ en: 'Play like that and your record sleeps easy.', vi: 'Chơi thế này thì kỷ lục ngủ ngon rồi.' }),
  () => ({ en: 'Even the board feels sorry for you.', vi: 'Bàn cờ còn thấy thương bạn nữa là.' }),
  (_s, b) => ({ en: `Where's the you who scored ${fmt(b)}?`, vi: `Bạn của ván ${fmt(b)} điểm đâu rồi?` }),
  () => ({ en: 'Scared?', vi: 'Bạn sợ à?' }),
  () => ({ en: 'Go again, come on!', vi: 'Chan tiếp đê' }),
];

const LOW_SCORE = 1000;
const LOW: Line[] = [() => ({ en: 'Oops', vi: 'Quêêêê' })];

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

export type LineTone = 'newBest' | 'close' | 'encourage' | 'tease';

export interface GameOverLine {
  tone: LineTone;
  text: Localized;
}

export function gameOverLine(score: number, best: number, newBest: boolean, losses: number): GameOverLine {
  if (newBest) return { tone: 'newBest', text: pick(NEW_BEST)(score, best, 0, losses) };
  const gap = best - score;
  if (score < LOW_SCORE) return { tone: 'tease', text: pick(LOW)(score, best, gap, losses) };
  if (score >= best * 0.8) return { tone: 'close', text: pick(SO_CLOSE)(score, best, gap, losses) };
  const tone = Math.random() < 0.5 ? 'encourage' : 'tease';
  return { tone, text: pick(tone === 'tease' ? TEASE : ENCOURAGE)(score, best, gap, losses) };
}
