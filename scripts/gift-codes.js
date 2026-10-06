#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'config', 'giftCodes.json');
const SALT = 'block-puzzle-streak/gift/v2';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function compactCode(input) {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return raw.startsWith('BPS') ? raw : `BPS${raw}`;
}
const hash = (code) => crypto.createHash('sha256').update(`${SALT}:${compactCode(code)}`).digest('hex');

const args = process.argv.slice(2);
if (!fs.existsSync(FILE)) fs.copyFileSync(path.join(__dirname, '..', 'config', 'giftCodes.example.json'), FILE);
const config = JSON.parse(fs.readFileSync(FILE, 'utf8'));

config.testerHashes = config.testerHashes || [];

if (args.includes('--list')) {
  console.log(`${config.hashes.length} gift code(s), ${config.testerHashes.length} tester code(s), enabled: ${config.enabled}`);
  process.exit(0);
}

const newCode = () => {
  const body = Array.from(crypto.randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `BPS-${body.slice(0, 4)}-${body.slice(4)}`;
};

const testers = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tester') testers.push(args[++i]);
  if (args[i] === '--tester-new') testers.push(newCode());
}
if (testers.length > 0) {
  for (const code of testers) {
    const h = hash(code);
    if (!config.testerHashes.includes(h)) config.testerHashes.push(h);
  }
  config.enabled = true;
  fs.writeFileSync(FILE, JSON.stringify(config, null, 2) + '\n');
  console.log(testers.join('\n'));
  process.exit(0);
}
if (args.includes('--reset')) config.hashes = [];

const codes = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--add') codes.push(args[++i]);
}
const count = Number(args.find((a) => /^\d+$/.test(a)) || 0);
for (let i = 0; i < count; i++) codes.push(newCode());

for (const code of codes) {
  const h = hash(code);
  if (!config.hashes.includes(h)) config.hashes.push(h);
}
if (codes.length > 0) config.enabled = true;
fs.writeFileSync(FILE, JSON.stringify(config, null, 2) + '\n');
console.log(codes.join('\n'));
