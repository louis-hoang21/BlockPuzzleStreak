const fmt = (n: number) => n.toLocaleString();

type Line = (score: number, best: number, gap: number, losses: number) => string;

const NEW_BEST: Line[] = [
  () => 'Đỉnh của chóp! Kỷ lục mới toanh.',
  (s) => `${fmt(s)} điểm! Tay này là tay vàng rồi.`,
  () => 'Phá kỷ lục ngon lành. Giữ phong độ nhé!',
  () => 'Kỷ lục cũ vừa bị bạn cho về hưu.',
];

const SO_CLOSE: Line[] = [
  (_s, _b, gap) => `Suýt nữa thôi! Thiếu đúng ${fmt(gap)} điểm.`,
  (_s, _b, gap) => `Chỉ cách kỷ lục ${fmt(gap)} điểm. Làm ván nữa là phá!`,
  (_s, b) => `Kỷ lục ${fmt(b)} đang run lẩy bẩy rồi đấy.`,
  () => 'Gần lắm rồi, đừng bỏ cuộc lúc này!',
];

const ENCOURAGE: Line[] = [
  () => 'Ván sau chắc chắn ngon hơn!',
  () => 'Khởi động xong rồi, giờ mới chơi thật nè.',
  () => 'Xếp khéo một chút là nổ liên tục đó.',
  () => 'Thử giữ combo lâu hơn xem, điểm tăng vù vù.',
  () => 'Ai cũng có ngày xui. Ván nữa nào!',
];

const TEASE: Line[] = [
  () => 'Bạn thực sự xếp hình thua một đứa trẻ ư?',
  () => 'Em bé 5 tuổi nhà hàng xóm vừa phá kỷ lục này đấy.',
  () => 'Xếp kiểu này thì mèo nhà mình cũng làm được.',
  () => 'Tay run à? Hay khối hôm nay trơn quá?',
  () => 'Lưới 8x8 thôi mà, đâu phải giải toán cao cấp.',
  (s, b) => `Mới ${fmt(s)} điểm thôi á? Kỷ lục của bạn là ${fmt(b)} cơ mà!`,
  (_s, _b, _g, losses) => `Thua kỷ lục ${fmt(losses)} lần. Định để yên vậy sao?`,
  () => 'Hết chiêu thật rồi à? Kỷ lục đang cười khẩy đấy.',
  () => 'Có vẻ hôm nay các khối không ưa bạn lắm.',
  () => 'Khối 3x3 nhờ mình gửi lời hỏi thăm.',
  () => 'Chơi thế này thì kỷ lục ngủ ngon rồi.',
  () => 'Bàn cờ còn thấy thương bạn nữa là.',
  (_s, b) => `Bạn của ván ${fmt(b)} điểm đâu rồi?`,
  () => 'Bạn sợ à?',
  () => 'Chan tiếp đê',
];

const LOW_SCORE = 1000;
const LOW: Line[] = [() => 'Quêêêê'];

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

export type LineTone = 'newBest' | 'close' | 'encourage' | 'tease';

export interface GameOverLine {
  tone: LineTone;
  text: string;
}

export function gameOverLine(score: number, best: number, newBest: boolean, losses: number): GameOverLine {
  if (newBest) return { tone: 'newBest', text: pick(NEW_BEST)(score, best, 0, losses) };
  const gap = best - score;
  if (score < LOW_SCORE) return { tone: 'tease', text: pick(LOW)(score, best, gap, losses) };
  if (score >= best * 0.8) return { tone: 'close', text: pick(SO_CLOSE)(score, best, gap, losses) };
  const tone = Math.random() < 0.5 ? 'encourage' : 'tease';
  return { tone, text: pick(tone === 'tease' ? TEASE : ENCOURAGE)(score, best, gap, losses) };
}
