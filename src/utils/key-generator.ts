import crypto from 'crypto';

export function generateKey0(): string {
  return `akdn-${crypto.randomBytes(16).toString('hex')}`;
}
