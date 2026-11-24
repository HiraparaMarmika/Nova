import { randomBytes, scrypt as callbackScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(callbackScrypt);
const KEY_BYTES = 64;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) throw new Error("Demo password must be at least 12 characters");
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_BYTES) as Buffer;
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [algorithm, saltHex, hashHex] = stored.split(":");
  if (algorithm !== "scrypt" || !/^[a-f0-9]{32}$/.test(saltHex ?? "") || !/^[a-f0-9]{128}$/.test(hashHex ?? "")) return false;
  const expected = Buffer.from(hashHex, "hex");
  const derived = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length) as Buffer;
  return timingSafeEqual(expected, derived);
}
