import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync, type AudioPlayer } from 'expo-audio';

import { useSettingsStore } from '../store/settingsStore';

const SOURCES = {
  place: require('../../assets/sounds/place.m4a'),
  drop: require('../../assets/sounds/drop.m4a'),
  clear: require('../../assets/sounds/clear.m4a'),
  combo2: require('../../assets/sounds/combo2.m4a'),
  combo3: require('../../assets/sounds/combo3.m4a'),
  combo4: require('../../assets/sounds/combo4.m4a'),
  gameOver: require('../../assets/sounds/gameover.m4a'),
  newRecord: require('../../assets/sounds/newRecord.m4a'),
  newRecordWin: require('../../assets/sounds/newRecordWin.m4a'),
  tieRecord: require('../../assets/sounds/tieRecord.m4a'),
  rotate: require('../../assets/sounds/rotate.m4a'),
  fireworks: require('../../assets/sounds/fireworks.m4a'),
  amazing: require('../../assets/sounds/amazing.m4a'),
};

export type Sfx = keyof typeof SOURCES;

const REPEATED: readonly Sfx[] = ['place', 'drop', 'clear', 'rotate', 'combo2', 'combo3', 'combo4'];
const voicesFor = (name: Sfx) => (REPEATED.includes(name) ? 2 : 1);

let players: Record<Sfx, AudioPlayer[]> | null = null;
const nextVoice: Partial<Record<Sfx, number>> = {};

export function initSfx() {
  if (players) return;
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  setIsAudioActiveAsync(true).catch(() => {});
  players = Object.fromEntries(
    Object.entries(SOURCES).map(([name, source]) => [
      name,
      Array.from({ length: voicesFor(name as Sfx) }, () => createAudioPlayer(source, { keepAudioSessionActive: true })),
    ]),
  ) as Record<Sfx, AudioPlayer[]>;
}

const tryPlay = (player: AudioPlayer) => {
  try {
    player.play();
  } catch {}
};

export function playSfx(name: Sfx) {
  if (!useSettingsStore.getState().sound) return;
  try {
    if (!players) initSfx();
    const voices = players![name];
    const i = nextVoice[name] ?? 0;
    nextVoice[name] = (i + 1) % voices.length;
    const player = voices[i];
    if (player.currentTime > 0) {
      player.seekTo(0, 0, 0).then(
        () => tryPlay(player),
        () => tryPlay(player),
      );
    } else {
      tryPlay(player);
    }
  } catch {}
}

export function comboSfx(combo: number): Sfx {
  return `combo${Math.min(4, Math.max(2, combo))}` as Sfx;
}
