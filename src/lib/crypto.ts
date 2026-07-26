/**
 * Client-side note encryption.
 *
 * The stored record is a self-describing JSON envelope: the KDF name and its
 * parameters travel *inside* it, so raising the iteration count or moving to a
 * different KDF later is a version bump the same reader still handles, rather
 * than another flag-day re-encryption.
 *
 * A fresh 12-byte IV is generated on every single save. AES-GCM nonce reuse
 * under a fixed key is a genuine break — never cache or reuse one.
 */

export const KDF = 'PBKDF2-SHA256';
export const KDF_ITERATIONS = 600_000;
export const ENVELOPE_VERSION = 1;

const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BITS = 256;

export interface Envelope {
    v: number;
    kdf: string;
    iter: number;
    salt: string;
    iv: string;
    ct: string;
}

export const toBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
};

export const fromBase64 = (value: string): Uint8Array => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
};

export const toHex = (bytes: Uint8Array): string =>
    Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

export function randomSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

/**
 * Parse a stored record. Returns null for an empty or unreadable record, which
 * the caller treats as "fresh note" — any password is then accepted and the
 * first save mints the salt.
 */
export function parseEnvelope(stored: string): Envelope | null {
    if (!stored) return null;
    try {
        const parsed = JSON.parse(stored);
        if (
            typeof parsed?.v !== 'number' ||
            typeof parsed.kdf !== 'string' ||
            typeof parsed.iter !== 'number' ||
            typeof parsed.salt !== 'string' ||
            typeof parsed.iv !== 'string' ||
            typeof parsed.ct !== 'string'
        ) {
            return null;
        }
        return parsed as Envelope;
    } catch {
        return null;
    }
}

/**
 * Stretch the password into raw key bits.
 *
 * Derived as bits rather than straight to a CryptoKey so the console pane can
 * narrate the result — the material is in page memory either way, and the
 * narration is the point of this app.
 *
 * The password is fed in directly: the previous SHA-256-then-PBKDF2 pre-hash
 * bought nothing and capped the effective input.
 */
export async function deriveKeyBits(
    password: string,
    salt: Uint8Array,
    iterations: number = KDF_ITERATIONS
): Promise<ArrayBuffer> {
    const material = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );

    return crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
        material,
        KEY_BITS
    );
}

export function importKey(bits: ArrayBuffer): Promise<CryptoKey> {
    return crypto.subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, [
        'encrypt',
        'decrypt'
    ]);
}

export async function decrypt(envelope: Envelope, key: CryptoKey): Promise<string> {
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromBase64(envelope.iv) as BufferSource },
        key,
        fromBase64(envelope.ct) as BufferSource
    );
    return new TextDecoder().decode(plaintext);
}

export async function encrypt(
    plaintext: string,
    key: CryptoKey,
    salt: Uint8Array
): Promise<string> {
    // Fresh nonce per save. This is the whole point of the format change.
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        new TextEncoder().encode(plaintext)
    );

    const envelope: Envelope = {
        v: ENVELOPE_VERSION,
        kdf: KDF,
        iter: KDF_ITERATIONS,
        salt: toBase64(salt),
        iv: toBase64(iv),
        ct: toBase64(new Uint8Array(ciphertext))
    };

    return JSON.stringify(envelope);
}
