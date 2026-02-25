/**
 * Fernet encryption — cross-compatible with Python's cryptography.fernet.
 *
 * Uses the shared FERNET_KEY environment variable.
 * Encrypt in Node.js → decrypt in Python (and vice versa).
 */
import { Secret, Token } from "fernet";

function getSecret(): Secret {
  const key = process.env.FERNET_KEY;
  if (!key) {
    throw new Error("FERNET_KEY environment variable is required");
  }
  return new Secret(key);
}

/**
 * Encrypt a plaintext string with Fernet.
 * Returns a URL-safe base64 token string.
 */
export function encrypt(plaintext: string): string {
  const secret = getSecret();
  const token = new Token({ secret });
  return token.encode(plaintext);
}

/**
 * Decrypt a Fernet token back to plaintext.
 */
export function decrypt(tokenString: string): string {
  const secret = getSecret();
  const token = new Token({
    secret,
    token: tokenString,
    ttl: 0, // No TTL — keys don't expire
  });
  return token.decode();
}
