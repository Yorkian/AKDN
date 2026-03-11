#!/usr/bin/env node
/**
 * AKDN Setup — Generate permanent encryption keys
 * Run: node setup-keys.js
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const examplePath = path.join(__dirname, '.env.example');

console.log('');
console.log('╔════════════════════════════════════════════╗');
console.log('║    AKDN — 密钥生成工具                     ║');
console.log('╚════════════════════════════════════════════╝');
console.log('');

const encKey = crypto.randomBytes(32).toString('hex');
const jwtKey = crypto.randomBytes(32).toString('hex');

console.log('生成的密钥：');
console.log('');
console.log(`  AKDN_ENCRYPTION_KEY=${encKey}`);
console.log(`  JWT_SECRET=${jwtKey}`);
console.log('');

// Check if .env exists
if (fs.existsSync(envPath)) {
  let content = fs.readFileSync(envPath, 'utf-8');
  let changed = false;

  // Only fill empty values, don't overwrite existing
  if (content.match(/AKDN_ENCRYPTION_KEY=\s*$/m) || content.match(/AKDN_ENCRYPTION_KEY=\s*\n/)) {
    content = content.replace(/AKDN_ENCRYPTION_KEY=\s*/m, `AKDN_ENCRYPTION_KEY=${encKey}`);
    changed = true;
  }
  if (content.match(/JWT_SECRET=\s*$/m) || content.match(/JWT_SECRET=\s*\n/)) {
    content = content.replace(/JWT_SECRET=\s*/m, `JWT_SECRET=${jwtKey}`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(envPath, content);
    console.log('✅ 已写入 .env 文件（仅填充了空的密钥字段）');
  } else {
    console.log('ℹ️  .env 中已有密钥值，未覆盖。如需重新生成请手动替换。');
  }
} else {
  // Create .env from example
  if (fs.existsSync(examplePath)) {
    let content = fs.readFileSync(examplePath, 'utf-8');
    content = content.replace(/AKDN_ENCRYPTION_KEY=\s*/m, `AKDN_ENCRYPTION_KEY=${encKey}`);
    content = content.replace(/JWT_SECRET=\s*/m, `JWT_SECRET=${jwtKey}`);
    fs.writeFileSync(envPath, content);
    console.log('✅ 已从 .env.example 创建 .env 文件并写入密钥');
  } else {
    const content = `AKDN_ENCRYPTION_KEY=${encKey}\nJWT_SECRET=${jwtKey}\n`;
    fs.writeFileSync(envPath, content);
    console.log('✅ 已创建 .env 文件并写入密钥');
  }
}

console.log('');
console.log('⚠️  重要：密钥生成后请勿更改，否则已存储的 API Key 将无法解密！');
console.log('    建议备份 .env 文件到安全位置。');
console.log('');
