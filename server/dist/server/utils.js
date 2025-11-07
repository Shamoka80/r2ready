import { randomBytes } from 'crypto';
/**
 * Generate a unique ID using crypto.randomBytes
 */
export function generateId() {
    return randomBytes(16).toString('hex');
}
/**
 * Generate a timestamp-based ID with random suffix
 */
export function generateTimestampId() {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(4).toString('hex');
    return `${timestamp}_${random}`;
}
