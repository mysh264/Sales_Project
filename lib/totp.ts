import { createHmac, randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer) {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    output += alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return output;
}

function base32Decode(value: string) {
  const bits = value
    .replace(/=+$/g, "")
    .toUpperCase()
    .split("")
    .map((character) => alphabet.indexOf(character).toString(2).padStart(5, "0"))
    .join("");
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

export function createTotpSecret() {
  return base32Encode(randomBytes(20));
}

function codeAt(secret: string, counter: number) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return value.toString().padStart(6, "0");
}

export function verifyTotp(secret: string, code: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(now / 30_000);
  return [-1, 0, 1].some((window) => codeAt(secret, counter + window) === code);
}

const RECOVERY_CODE_COUNT = 8;

function generateRecoveryCode() {
  // Format: 4 groups of 4 chars from a readable alphabet, e.g. ABCD-2345-WXYZ-67AB.
  const groups = [];
  for (let group = 0; group < 4; group += 1) {
    let groupValue = "";
    for (let index = 0; index < 4; index += 1) {
      groupValue += alphabet[randomInt(0, alphabet.length)];
    }
    groups.push(groupValue);
  }
  return groups.join("-");
}

// Generate a fresh set of recovery codes. Returns the plaintext codes (to be shown to the
// user exactly once) and the bcrypt-hashed JSON string to persist.
export async function generateRecoveryCodes() {
  const codes: string[] = [];
  const hashes: string[] = [];
  for (let index = 0; index < RECOVERY_CODE_COUNT; index += 1) {
    const code = generateRecoveryCode();
    codes.push(code);
    hashes.push(await bcrypt.hash(code, 10));
  }
  return { codes, stored: JSON.stringify(hashes) };
}

// Verify a submitted recovery code against the stored (hashed) set. On success returns the
// remaining hashes (the matched code is removed) so the caller can persist the reduced set.
export async function consumeRecoveryCode(stored: string | null | undefined, code: string) {
  if (!stored) return { ok: false, remaining: null };
  let hashes: string[] = [];
  try {
    hashes = JSON.parse(stored) as string[];
  } catch {
    return { ok: false, remaining: null };
  }
  const normalized = code.trim().toUpperCase();
  for (let index = 0; index < hashes.length; index += 1) {
    if (await bcrypt.compare(normalized, hashes[index])) {
      const remaining = [...hashes.slice(0, index), ...hashes.slice(index + 1)];
      return { ok: true, remaining: JSON.stringify(remaining) };
    }
  }
  return { ok: false, remaining: null };
}

