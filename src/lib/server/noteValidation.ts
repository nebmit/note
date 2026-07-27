import {
    CRYPTO_ALGORITHM,
    CRYPTO_VERSION,
    IV_BYTES,
    MAX_PLAINTEXT_BYTES,
    SETUP_BYTES
} from '$lib/crypto';
import type { AesGcmEnvelope } from '$lib/types';

const BASE64URL = /^[A-Za-z0-9_-]+$/;
const WRAPPED_DEK_BYTES = 32 + 16;
const NOTE_CIPHERTEXT_MAX_BYTES = MAX_PLAINTEXT_BYTES + 16;

function decodedLength(value: string): number | null {
    if (!BASE64URL.test(value) || value.length % 4 === 1) return null;
    try {
        const decoded = Buffer.from(value, 'base64url');
        return decoded.toString('base64url') === value ? decoded.length : null;
    } catch {
        return null;
    }
}

function hasExactKeys(value: Record<string, unknown>): boolean {
    const keys = Object.keys(value).sort();
    return (
        keys.length === 4 &&
        keys[0] === 'alg' &&
        keys[1] === 'ct' &&
        keys[2] === 'iv' &&
        keys[3] === 'v'
    );
}

function isEnvelope(value: unknown): value is AesGcmEnvelope {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    return (
        hasExactKeys(record) &&
        record.v === CRYPTO_VERSION &&
        record.alg === CRYPTO_ALGORITHM &&
        typeof record.iv === 'string' &&
        decodedLength(record.iv) === IV_BYTES &&
        typeof record.ct === 'string'
    );
}

export function isSetupValue(value: unknown): value is string {
    return typeof value === 'string' && decodedLength(value) === SETUP_BYTES;
}

export function isWrappedDek(value: unknown): value is AesGcmEnvelope {
    return isEnvelope(value) && decodedLength(value.ct) === WRAPPED_DEK_BYTES;
}

export function isNoteCiphertext(value: unknown): value is AesGcmEnvelope {
    if (!isEnvelope(value)) return false;
    const length = decodedLength(value.ct);
    return (
        length !== null &&
        length >= 16 &&
        length <= NOTE_CIPHERTEXT_MAX_BYTES
    );
}

export function isBaseRevision(value: unknown): value is number {
    return Number.isSafeInteger(value) && Number(value) >= 1;
}
