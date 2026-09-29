import * as SecureStore from 'expo-secure-store';
import * as StoreReview from 'expo-store-review';

import balance from '../../config/balance.json';
import { KEYCHAIN_OPTIONS } from '../persistence/storage';

const KEY = 'review-prompts-shown';

function shownCount(): number {
  return Number(SecureStore.getItem(KEY, KEYCHAIN_OPTIONS) ?? 0) || 0;
}

export function reviewPromptDelay(): number | null {
  const { chance, maxPerDevice, minDelayMs, maxDelayMs } = balance.reviewPrompt;
  if (shownCount() >= maxPerDevice || Math.random() >= chance) return null;
  return minDelayMs + Math.random() * (maxDelayMs - minDelayMs);
}

export function markReviewPromptShown() {
  SecureStore.setItem(KEY, String(shownCount() + 1), KEYCHAIN_OPTIONS);
}

export async function requestStoreReview() {
  try {
    if (await StoreReview.isAvailableAsync()) await StoreReview.requestReview();
  } catch {}
}
