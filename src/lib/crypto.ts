/**
 * Passkey-derived envelope encryption for the note.
 *
 * The WebAuthn PRF output is used only as HKDF input for a key-encryption key
 * (KEK). A random data-encryption key (DEK) encrypts the note and is stored
 * wrapped by that KEK. Raw PRF output and unwrapped keys never leave the tab.
 */

import type {
    AesGcmEnvelope,
    KeyringMetadata,
    SsoPasskey
} from '$lib/types';

export const CRYPTO_VERSION = 1;
export const CRYPTO_ALGORITHM = 'A256GCM';
export const SETUP_BYTES = 32;
export const IV_BYTES = 12;
export const PRF_OUTPUT_BYTES = 32;
export const MAX_PLAINTEXT_BYTES = 1_000_000;

const KEY_BITS = 256;
const GCM_TAG_BITS = 128;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export class WebAuthnUnavailableError extends Error {
    constructor() {
        super('This browser does not support WebAuthn.');
        this.name = 'WebAuthnUnavailableError';
    }
}

export class PrfUnavailableError extends Error {
    constructor() {
        super('This passkey did not return a WebAuthn PRF result.');
        this.name = 'PrfUnavailableError';
    }
}

export class CredentialMismatchError extends Error {
    constructor() {
        super('The selected passkey does not belong to this account.');
        this.name = 'CredentialMismatchError';
    }
}

export function toBase64url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64url(value: string, expectedLength?: number): Uint8Array {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
        throw new Error('Invalid base64url value');
    }
    const padded = value
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    if (toBase64url(bytes) !== value) {
        throw new Error('Non-canonical base64url value');
    }
    if (expectedLength !== undefined && bytes.length !== expectedLength) {
        throw new Error(`Expected ${expectedLength} bytes`);
    }
    return bytes;
}

export function createSetupInputs(): { prfInput: string; hkdfSalt: string } {
    return {
        prfInput: toBase64url(crypto.getRandomValues(new Uint8Array(SETUP_BYTES))),
        hkdfSalt: toBase64url(crypto.getRandomValues(new Uint8Array(SETUP_BYTES)))
    };
}

function context(parts: Array<string | number>): Uint8Array {
    return encoder.encode(JSON.stringify(parts));
}

function kekInfo(uuid: string, metadata: KeyringMetadata): Uint8Array {
    return context([
        'note.timben.net',
        'key-encryption-key',
        CRYPTO_VERSION,
        uuid,
        metadata.credentialId
    ]);
}

function wrapAad(uuid: string, metadata: KeyringMetadata): Uint8Array {
    return context([
        'note.timben.net',
        'dek-wrap',
        CRYPTO_VERSION,
        uuid,
        metadata.credentialId,
        metadata.prfInput
    ]);
}

function noteAad(uuid: string, metadata: KeyringMetadata, revision: number): Uint8Array {
    return context([
        'note.timben.net',
        'note',
        CRYPTO_VERSION,
        uuid,
        metadata.credentialId,
        metadata.prfInput,
        revision
    ]);
}

function gcmParams(iv: Uint8Array, additionalData: Uint8Array): AesGcmParams {
    return {
        name: 'AES-GCM',
        iv: iv as Uint8Array<ArrayBuffer>,
        additionalData: additionalData as Uint8Array<ArrayBuffer>,
        tagLength: GCM_TAG_BITS
    };
}

function parseEnvelope(envelope: AesGcmEnvelope): { iv: Uint8Array; ciphertext: Uint8Array } {
    if (
        envelope.v !== CRYPTO_VERSION ||
        envelope.alg !== CRYPTO_ALGORITHM
    ) {
        throw new Error('Unsupported encryption envelope');
    }
    const iv = fromBase64url(envelope.iv, IV_BYTES);
    const ciphertext = fromBase64url(envelope.ct);
    if (ciphertext.length < GCM_TAG_BITS / 8) {
        throw new Error('Invalid encryption envelope');
    }
    return { iv, ciphertext };
}

function encodedCredentialId(credentialId: string): Uint8Array {
    return fromBase64url(credentialId);
}

export function webauthnSupported(): boolean {
    return (
        typeof window !== 'undefined' &&
        'PublicKeyCredential' in window &&
        typeof navigator.credentials?.get === 'function'
    );
}

/**
 * Evaluate the PRF for the one credential attached to the authenticated SSO
 * account. The assertion is not used for authentication here; the SSO session
 * already did that. Its only local product is the authenticator-held PRF.
 */
export async function runPrfCeremony(
    passkey: SsoPasskey,
    prfInput: string
): Promise<Uint8Array> {
    if (!webauthnSupported()) throw new WebAuthnUnavailableError();

    const input = fromBase64url(prfInput, SETUP_BYTES);
    const credential = (await navigator.credentials.get({
        publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            rpId: passkey.rpId,
            allowCredentials: [
                {
                    type: 'public-key',
                    id: encodedCredentialId(passkey.credentialId) as Uint8Array<ArrayBuffer>
                }
            ],
            userVerification: 'required',
            extensions: {
                prf: { eval: { first: input } }
            } as AuthenticationExtensionsClientInputs
        }
    })) as PublicKeyCredential | null;

    if (credential === null) throw new PrfUnavailableError();
    if (credential.id !== passkey.credentialId) throw new CredentialMismatchError();

    const extensionResults = credential.getClientExtensionResults() as {
        prf?: { results?: { first?: ArrayBuffer } };
    };
    const first = extensionResults.prf?.results?.first;
    if (first === undefined) throw new PrfUnavailableError();

    const output = new Uint8Array(first);
    if (output.length !== PRF_OUTPUT_BYTES) {
        output.fill(0);
        throw new PrfUnavailableError();
    }
    const result = new Uint8Array(output);
    output.fill(0);
    return result;
}

export async function deriveKek(
    prfOutput: Uint8Array,
    metadata: KeyringMetadata,
    uuid: string
): Promise<CryptoKey> {
    if (prfOutput.length !== PRF_OUTPUT_BYTES) {
        throw new Error('Invalid PRF output length');
    }
    const material = await crypto.subtle.importKey(
        'raw',
        prfOutput as Uint8Array<ArrayBuffer>,
        'HKDF',
        false,
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: fromBase64url(metadata.hkdfSalt, SETUP_BYTES) as Uint8Array<ArrayBuffer>,
            info: kekInfo(uuid, metadata) as Uint8Array<ArrayBuffer>
        },
        material,
        { name: 'AES-GCM', length: KEY_BITS },
        false,
        ['wrapKey', 'unwrapKey']
    );
}

/** The temporary extractable DEK exists only long enough to wrap it. */
export function generateDek(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
        { name: 'AES-GCM', length: KEY_BITS },
        true,
        ['encrypt', 'decrypt']
    );
}

export async function wrapDek(
    dek: CryptoKey,
    kek: CryptoKey,
    metadata: KeyringMetadata,
    uuid: string
): Promise<AesGcmEnvelope> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const wrapped = await crypto.subtle.wrapKey(
        'raw',
        dek,
        kek,
        gcmParams(iv, wrapAad(uuid, metadata))
    );
    return {
        v: CRYPTO_VERSION,
        alg: CRYPTO_ALGORITHM,
        iv: toBase64url(iv),
        ct: toBase64url(new Uint8Array(wrapped))
    };
}

/** Everyday DEKs are deliberately non-extractable. */
export async function unwrapDek(
    envelope: AesGcmEnvelope,
    kek: CryptoKey,
    metadata: KeyringMetadata,
    uuid: string
): Promise<CryptoKey> {
    const { iv, ciphertext } = parseEnvelope(envelope);
    return crypto.subtle.unwrapKey(
        'raw',
        ciphertext as Uint8Array<ArrayBuffer>,
        kek,
        gcmParams(iv, wrapAad(uuid, metadata)),
        { name: 'AES-GCM', length: KEY_BITS },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptNote(
    plaintext: string,
    dek: CryptoKey,
    metadata: KeyringMetadata,
    uuid: string,
    revision: number
): Promise<AesGcmEnvelope> {
    if (!Number.isSafeInteger(revision) || revision < 1) {
        throw new Error('Invalid note revision');
    }
    const encoded = encoder.encode(plaintext);
    if (encoded.length > MAX_PLAINTEXT_BYTES) {
        throw new Error('Note is too large');
    }
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ciphertext = await crypto.subtle.encrypt(
        gcmParams(iv, noteAad(uuid, metadata, revision)),
        dek,
        encoded
    );
    return {
        v: CRYPTO_VERSION,
        alg: CRYPTO_ALGORITHM,
        iv: toBase64url(iv),
        ct: toBase64url(new Uint8Array(ciphertext))
    };
}

export async function decryptNote(
    envelope: AesGcmEnvelope,
    dek: CryptoKey,
    metadata: KeyringMetadata,
    uuid: string,
    revision: number
): Promise<string> {
    if (!Number.isSafeInteger(revision) || revision < 1) {
        throw new Error('Invalid note revision');
    }
    const { iv, ciphertext } = parseEnvelope(envelope);
    const plaintext = await crypto.subtle.decrypt(
        gcmParams(iv, noteAad(uuid, metadata, revision)),
        dek,
        ciphertext as Uint8Array<ArrayBuffer>
    );
    return decoder.decode(plaintext);
}
