import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { playSfx } from '../audio/sfx';
import { clearedPercent, piecesLeft, placeInPuzzle, STAR_MARKS, starsFor, type PuzzleResult, type PuzzleState } from '../core/stormPuzzle';
import { hapticCelebrate, hapticClear, hapticPlace, hapticWarning } from '../haptics';
import { useT } from '../i18n';
import { GameBoard, type ClearEvent, type ClearingCell, type FireEvent, type StormWave } from '../render/GameBoard';
import { computeLayout, type BoardLayout } from '../render/layout';
import type { BoardTheme, Skin } from '../render/theme';

export const STAR = '#FFB547';
const STAR_LIT = '#FFC21A';
const STAR_RIM = '#FFFFFF';
const STAR_EMPTY = 'rgba(122, 85, 53, 0.35)';
export const INK = '#4E2F17';
export const INK_DIM = '#7A5535';
export const RESULT_DELAY_MS = 700;

const NO_SLOTS: readonly number[] = [];
const GIFT_SFX_DELAY_MS = 120;
const FLASH_MS = 1600;
const LOW_PIECES = 3;

const [ONE_STAR, TWO_STARS] = STAR_MARKS.map((v) => Math.round(v * 100));

type Tr = ReturnType<typeof useT>;

export type Reason = 'clear' | 'stuck' | 'timeout' | 'pieces';

export function endReason(puzzle: PuzzleState): Reason {
  if (puzzle.won) return 'clear';
  return piecesLeft(puzzle) === 0 ? 'pieces' : 'stuck';
}

export function lostTitle(tr: Tr, reason: Reason): string {
  if (reason === 'timeout') return tr("Time's up!", 'Hết giờ!');
  if (reason === 'pieces') return tr('Out of pieces', 'Hết khối');
  return tr('No room left', 'Hết chỗ đặt');
}

export function puzzleRules(tr: Tr): string {
  return tr(
    `Clear the dotted blocks to fill the star bar: ${ONE_STAR}% cleared lights 1 star, ${TWO_STARS}% lights 2 stars, all of them lights 3 stars and ends the level. A lit star stays lit, so keep playing. The level ends when your pieces run out, there is no room left or the time runs out. You lose only if no star is lit.`,
    `Phá các khối có chấm để làm đầy thanh sao: phá ${ONE_STAR}% sáng 1 sao, ${TWO_STARS}% sáng 2 sao, phá hết sáng 3 sao và xong màn ngay. Sao đã sáng thì giữ nguyên, cứ chơi tiếp. Màn kết thúc khi hết khối, hết chỗ đặt hoặc hết giờ. Chưa sáng sao nào mới tính là thua.`,
  );
}

export function endedText(tr: Tr, reason: Reason): string {
  if (reason === 'pieces') return tr('Out of pieces. ', 'Hết khối. ');
  if (reason === 'stuck') return tr('No room left. ', 'Hết chỗ đặt. ');
  if (reason === 'timeout') return tr("Time's up. ", 'Hết giờ. ');
  return '';
}

export function resultText(tr: Tr, stars: number, percent: number): string {
  if (stars === 0) {
    return tr(
      `You cleared ${percent}% of the dotted blocks. Clear ${ONE_STAR}% to light the first star.`,
      `Phá được ${percent}% khối có chấm. Cần phá ${ONE_STAR}% để sáng sao đầu tiên.`,
    );
  }
  if (stars === 3) return tr('Every dotted block cleared!', 'Đã phá hết khối có chấm!');
  return tr(`You cleared ${percent}% of the dotted blocks. Clear them all for 3 stars.`, `Phá được ${percent}% khối có chấm. Phá hết để được 3 sao.`);
}

export function howToPlay(tr: Tr): string {
  return tr(
    `The blocks on the grid at the start carry a white dot. Each level gives a limited number of pieces, counting down as you place them. Gifts and lightning work like in Storm Combo. Watch out for tray pieces with a flame (clearing its line sets every block on the crossing line on fire and spoils it) or swirling arrows (clearing its line shuffles the board). ${puzzleRules(tr)}`,
    `Các khối có sẵn trên lưới lúc đầu mang chấm trắng. Mỗi màn có số khối giới hạn, đếm lùi mỗi lần đặt. Quà và sét hoạt động như Chuỗi Nổ. Cẩn thận khối trên khay có ngọn lửa (nổ đường chứa nó thì lửa lan sang mọi khối trên đường vuông góc, làm chúng hỏng) hoặc vòng mũi tên xoáy (nổ đường chứa nó thì cả bàn bị xáo trộn). ${puzzleRules(tr)}`,
  );
}

export function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function clearedCells({ placed, cleared, cracked, cured }: PuzzleResult): ClearingCell[] {
  const n = placed.size;
  const seen = new Set<number>(cracked);
  const out: ClearingCell[] = [];
  const add = (row: number, col: number) => {
    const i = row * n + col;
    if (seen.has(i) || placed.cells[i] === 0) return;
    seen.add(i);
    out.push({ row, col, color: placed.cells[i] - 1 });
  };
  for (const r of cleared.rows) for (let c = 0; c < n; c++) add(r, c);
  for (const c of cleared.cols) for (let r = 0; r < n; r++) add(r, c);
  for (const i of cured) add(Math.floor(i / n), i % n);
  return out;
}

export interface PuzzleFx {
  clearing: ClearEvent | null;
  wave: StormWave | null;
  fire: FireEvent | null;
  flash: { id: number; text: string } | null;
  reset: () => void;
  place: (puzzle: PuzzleState, slot: number, row: number, col: number) => PuzzleState | null;
}

export function usePuzzleFx(): PuzzleFx {
  const tr = useT();
  const eventId = useRef(0);
  const [clearing, setClearing] = useState<ClearEvent | null>(null);
  const [wave, setWave] = useState<StormWave | null>(null);
  const [fire, setFire] = useState<FireEvent | null>(null);
  const [flash, setFlash] = useState<{ id: number; text: string } | null>(null);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash((f) => (f?.id === flash.id ? null : f)), FLASH_MS);
    return () => clearTimeout(t);
  }, [flash]);

  const reset = useCallback(() => {
    setClearing(null);
    setWave(null);
    setFire(null);
    setFlash(null);
  }, []);

  const place = useCallback(
    (puzzle: PuzzleState, slot: number, row: number, col: number) => {
      const result = placeInPuzzle(puzzle, slot, row, col);
      if (!result) return null;
      const lit = starsFor(result.state);
      const starText = lit > starsFor(puzzle) ? tr(lit === 1 ? '1 star!' : `${lit} stars!`, `Đạt ${lit} sao!`) : null;
      if (result.lines === 0) {
        hapticPlace();
        playSfx('place');
        return result.state;
      }
      setClearing({
        id: ++eventId.current,
        cells: clearedCells(result),
        rows: result.cleared.rows,
        cols: result.cleared.cols,
        lines: result.lines,
      });
      hapticClear(result.lines);
      playSfx('clear');
      if (result.gift || result.bolt) {
        setTimeout(() => {
          hapticCelebrate();
          playSfx('rotate');
        }, GIFT_SFX_DELAY_MS);
      }
      if (result.burned.length > 0 || result.mixed) {
        const id = ++eventId.current;
        if (result.mixed) setWave({ id, before: result.mixed });
        if (result.burnFrom !== undefined && result.burned.length > 0) setFire({ id, from: result.burnFrom, cells: result.burned });
        setFlash({
          id,
          text:
            starText && !result.state.won
              ? starText
              : result.burned.length > 0 && result.mixed
              ? tr('Fire and shuffle!', 'Cháy và xáo bàn!')
              : result.mixed
                ? tr('Shuffle! The board was mixed up', 'Xáo bàn! Các khối bị trộn lại')
                : tr(`Fire! ${result.burned.length} blocks burnt`, `Cháy! ${result.burned.length} khối bị cháy`),
        });
        setTimeout(() => {
          hapticWarning();
          playSfx('rotate');
        }, GIFT_SFX_DELAY_MS);
      } else if (starText && !result.state.won) {
        setFlash({ id: ++eventId.current, text: starText });
      }
      if (starText) hapticCelebrate();
      return result.state;
    },
    [tr],
  );

  return { clearing, wave, fire, flash, reset, place };
}

const noRotate = () => false;

export function PuzzleStage({
  puzzle,
  fx,
  running,
  onDrop,
  theme,
  skin,
  text,
}: {
  puzzle: PuzzleState | null;
  fx: PuzzleFx;
  running: boolean;
  onDrop: (slot: number, row: number, col: number) => boolean;
  theme: BoardTheme;
  skin: Skin;
  text: string;
}) {
  const tr = useT();
  const [layout, setLayout] = useState<BoardLayout | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout(computeLayout(width, height));
  };
  const left = puzzle ? piecesLeft(puzzle) : 0;
  return (
    <View style={kit.boardArea} onLayout={onLayout}>
      {layout && puzzle && (
        <GameBoard
          layout={layout}
          board={puzzle.board}
          wear={puzzle.wear}
          tray={puzzle.tray}
          clearing={fx.clearing}
          storm={fx.wave}
          gift={puzzle.gift}
          bolt={puzzle.bolt}
          burn={puzzle.burn}
          mix={puzzle.mix}
          seeds={puzzle.seeds}
          fire={fx.fire}
          disabled={!running}
          onDrop={onDrop}
          onRotate={noRotate}
          hintSlots={NO_SLOTS}
          theme={theme}
          skin={skin}
        />
      )}
      {layout && puzzle && (
        <View style={[kit.info, { left: layout.trayX, top: layout.meterY, width: layout.trayWidth, height: layout.meterHeight }]}>
          <View style={[kit.pieces, left <= LOW_PIECES && kit.piecesLow]}>
            <Text style={kit.piecesText}>
              {tr(`Your blocks: ${left}`, `Khối của bạn: ${left}`)}
            </Text>
          </View>
          <StarMeter puzzle={puzzle} />
        </View>
      )}
      {layout && fx.flash && (
        <View pointerEvents="none" style={[kit.flash, { top: layout.boardY + 8 }]}>
          <Text style={kit.flashText}>{fx.flash.text}</Text>
        </View>
      )}
      {!puzzle && (
        <View style={kit.loadingBox}>
          <ActivityIndicator size="large" color={text} />
        </View>
      )}
    </View>
  );
}

function StarMeter({ puzzle }: { puzzle: PuzzleState }) {
  const tr = useT();
  const percent = clearedPercent(puzzle);
  return (
    <View style={kit.meter} accessibilityLabel={tr(`${percent}% of dotted blocks cleared`, `Đã phá ${percent}% khối có chấm`)}>
      <View style={kit.meterTrack}>
        <View style={[kit.meterFill, { width: `${percent}%` }]} />
        {STAR_MARKS.filter((mark) => mark < 1).map((mark) => (
          <View key={mark} style={[kit.meterMark, { left: `${mark * 100}%` }]} />
        ))}
      </View>
      <Text style={kit.meterText}>{percent}%</Text>
      <Stars count={starsFor(puzzle)} size={14} />
    </View>
  );
}

export function Stars({ count, size }: { count: number; size: number }) {
  const tr = useT();
  return (
    <View style={kit.stars} accessibilityLabel={tr(count === 1 ? '1 star' : `${count} stars`, `${count} sao`)}>
      {[0, 1, 2].map((i) => {
        const inner = Math.round(size * 0.66);
        return (
          <View key={i} style={[kit.star, { width: size, height: size }]}>
            <SymbolView name="star.fill" size={size} tintColor={STAR_RIM} style={{ width: size, height: size }} />
            <SymbolView
              name="star.fill"
              size={inner}
              tintColor={i < count ? STAR_LIT : STAR_EMPTY}
              style={[kit.starInner, { width: inner, height: inner, top: (size - inner) / 2 + size * 0.03, left: (size - inner) / 2 }]}
            />
          </View>
        );
      })}
    </View>
  );
}

export function Overlay({ children }: { children: ReactNode }) {
  return (
    <View style={kit.overlay}>
      <View style={kit.card}>{children}</View>
    </View>
  );
}

export const kit = StyleSheet.create({
  container: { flex: 1 },
  header: { zIndex: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 22, height: 22 },
  titleBox: { flex: 1, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '900' },
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] },
  boardArea: { flex: 1 },
  loadingBox: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  info: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 },
  pieces: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#3FA9F5' },
  piecesLow: { backgroundColor: '#FF5A1F' },
  piecesText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  flash: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 5 },
  flashText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    backgroundColor: 'rgba(40, 22, 8, 0.75)',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  meter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 10 },
  meterTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(78, 47, 23, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  meterFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: STAR_LIT, borderRadius: 999 },
  meterMark: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: 'rgba(255, 255, 255, 0.9)' },
  meterText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'], minWidth: 34, textAlign: 'right', textShadowColor: 'rgba(0, 0, 0, 0.45)', textShadowRadius: 2 },
  stars: { flexDirection: 'row', gap: 4, justifyContent: 'center' },
  star: {
    shadowColor: '#5A2E08',
    shadowOpacity: 0.45,
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 1 },
  },
  starInner: { position: 'absolute' },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    backgroundColor: 'rgba(40, 22, 8, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#FFF4DE',
    borderWidth: 4,
    borderColor: '#A86A35',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: { color: INK, fontSize: 22, fontWeight: '900' },
  cardBody: { color: INK_DIM, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  row: { flexDirection: 'row', alignSelf: 'stretch', gap: 10, marginTop: 4 },
  primary: { flex: 1, borderRadius: 999, paddingVertical: 10, backgroundColor: '#3DCB4A', alignItems: 'center' },
  single: { alignSelf: 'stretch', flex: 0 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondary: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(78, 47, 23, 0.3)',
    alignItems: 'center',
  },
  secondaryText: { color: INK, fontSize: 15, fontWeight: '700' },
});
