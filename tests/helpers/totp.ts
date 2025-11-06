import crypto from 'crypto';

/**
 * Base32 decoding for TOTP verification
 * Converts a base32-encoded string to a Buffer
 */
function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  encoded = encoded.toUpperCase().replace(/=+$/, '');
  
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = new Uint8Array(Math.ceil(encoded.length * 5 / 8));

  for (let i = 0; i < encoded.length; i++) {
    const charIndex = alphabet.indexOf(encoded[i]);
    if (charIndex === -1) {
      throw new Error('Invalid base32 character');
    }

    value = (value << 5) | charIndex;
    bits += 5;

    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }

  return Buffer.from(output.subarray(0, index));
}

/**
 * Generate TOTP code for a given secret and time window
 * This implementation matches the server's TOTP generation logic exactly
 * 
 * @param secret - Base32-encoded TOTP secret
 * @param timeWindow - Optional timestamp in milliseconds (defaults to current time)
 * @returns 6-digit TOTP code as string
 */
export function generateTOTP(secret: string, timeWindow?: number): string {
  const time = Math.floor((timeWindow || Date.now()) / 1000 / 30); // 30-second window
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeUInt32BE(Math.floor(time / 0x100000000), 0);
  timeBuffer.writeUInt32BE(time & 0xffffffff, 4);

  // Decode base32 secret
  const secretBuffer = base32Decode(secret);
  
  // Generate HMAC-SHA1 hash
  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(timeBuffer);
  const hash = hmac.digest();

  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0x0f;
  const code = ((hash[offset] & 0x7f) << 24) |
               ((hash[offset + 1] & 0xff) << 16) |
               ((hash[offset + 2] & 0xff) << 8) |
               (hash[offset + 3] & 0xff);

  // Return 6-digit code
  return (code % 1000000).toString().padStart(6, '0');
}

/**
 * Verify if a TOTP code is valid for a given secret
 * Checks current time window and adjacent windows (±30 seconds)
 * 
 * @param secret - Base32-encoded TOTP secret
 * @param token - 6-digit TOTP code to verify
 * @returns true if the code is valid, false otherwise
 */
export function verifyTOTP(secret: string, token: string): boolean {
  const currentTime = Date.now();
  
  // Check current window and adjacent windows (±30 seconds)
  for (let i = -1; i <= 1; i++) {
    const timeWindow = currentTime + (i * 30 * 1000);
    const expectedToken = generateTOTP(secret, timeWindow);
    
    if (token === expectedToken) {
      return true;
    }
  }
  
  return false;
}
