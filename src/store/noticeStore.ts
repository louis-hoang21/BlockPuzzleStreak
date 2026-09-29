import { create } from 'zustand';

export type RewardKind = 'rotation' | 'theme' | 'skin';

export interface Notice {
  id: number;
  text: string;
  reward?: RewardKind;
}

interface NoticeStore {
  queue: Notice[];
  push: (text: string, reward?: RewardKind) => void;
  shift: () => void;
}

let nextId = 0;

const MAX_QUEUE = 3;

export const useNoticeStore = create<NoticeStore>()((set, get) => ({
  queue: [],
  push: (text, reward) => {
    const queue = get().queue;
    if (queue.some((n) => n.text === text)) return;
    const next = [...queue, { id: ++nextId, text, reward }];
    for (let i = 1; next.length > MAX_QUEUE && i < next.length; ) {
      if (next[i].reward) i++;
      else next.splice(i, 1);
    }
    set({ queue: next });
  },
  shift: () => set({ queue: get().queue.slice(1) }),
}));
