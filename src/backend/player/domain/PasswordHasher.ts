import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const ENCODING = 'hex' as const;

export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(SALT_LENGTH).toString(ENCODING);
    scrypt(password, salt, KEY_LENGTH, (err, derived) => {
      if (err) return reject(err);
      resolve(`${salt}:${derived.toString(ENCODING)}`);
    });
  });
}

export function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return resolve(false);

    scrypt(password, salt, KEY_LENGTH, (err, derived) => {
      if (err) return reject(err);
      const hashBuffer = Buffer.from(hash, ENCODING);
      resolve(timingSafeEqual(hashBuffer, derived));
    });
  });
}
