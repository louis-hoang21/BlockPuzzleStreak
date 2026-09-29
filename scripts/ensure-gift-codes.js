#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'config');
const file = path.join(dir, 'giftCodes.json');
if (!fs.existsSync(file)) {
  fs.copyFileSync(path.join(dir, 'giftCodes.example.json'), file);
  console.log('Created config/giftCodes.json from the example (gift codes disabled).');
}
