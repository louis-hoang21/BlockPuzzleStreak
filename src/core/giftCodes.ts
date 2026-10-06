import gift from '../../config/giftCodes.json';
import { sha256, toHex, utf8 } from './hmac';

const GIFT_SALT = 'block-puzzle-streak/gift/v2';

export const GIFT_CODES_ENABLED = gift.enabled;

const TESTER_HASHES: readonly string[] = gift.testerHashes;

export function compactCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return raw.startsWith('BPS') ? raw : `BPS${raw}`;
}

const digestOf = (input: string) => toHex(sha256(utf8(`${GIFT_SALT}:${compactCode(input)}`)));

export function isValidGiftCode(input: string): boolean {
  if (!gift.enabled) return false;
  return gift.hashes.includes(digestOf(input));
}

export function isTesterCode(input: string): boolean {
  if (!gift.enabled) return false;
  return TESTER_HASHES.includes(digestOf(input));
}
