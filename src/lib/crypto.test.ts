import { describe, expect, it } from 'vitest';
import {
    decryptNote,
    deriveKek,
    deriveKekFingerprint,
    encryptNote,
    envelopeFingerprint,
    fromBase64url,
    generateDek,
    kekInfoText,
    noteAadText,
    toBase64url,
    unwrapDek,
    wrapAadText,
    wrapDek
} from './crypto';
import type { AesGcmEnvelope, KeyringMetadata } from './types';

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const CREDENTIAL_ID = toBase64url(new Uint8Array([1, 2, 3, 4]));

function bytes(fill: number): string {
    return toBase64url(new Uint8Array(32).fill(fill));
}

function metadata(overrides: Partial<KeyringMetadata> = {}): KeyringMetadata {
    return {
        v: 1,
        credentialId: CREDENTIAL_ID,
        prfInput: bytes(7),
        hkdfSalt: bytes(8),
        ...overrides
    };
}

function tamper(envelope: AesGcmEnvelope): AesGcmEnvelope {
    const ciphertext = fromBase64url(envelope.ct);
    ciphertext[0] ^= 1;
    return { ...envelope, ct: toBase64url(ciphertext) };
}

describe('passkey-derived envelope encryption', () => {
    it('derives deterministically and separates salt and context', async () => {
        const prf = new Uint8Array(32).fill(3);
        const first = await deriveKek(prf, metadata(), UUID);
        const same = await deriveKek(prf, metadata(), UUID);
        const differentSalt = await deriveKek(
            prf,
            metadata({ hkdfSalt: bytes(9) }),
            UUID
        );
        const differentContext = await deriveKek(prf, metadata(), `${UUID}-other`);
        const dek = await generateDek();
        const wrapped = await wrapDek(dek, first, metadata(), UUID);

        await expect(unwrapDek(wrapped, same, metadata(), UUID)).resolves.toBeDefined();
        await expect(
            unwrapDek(wrapped, differentSalt, metadata(), UUID)
        ).rejects.toThrow();
        await expect(
            unwrapDek(wrapped, differentContext, metadata(), UUID)
        ).rejects.toThrow();
    });

    it('wraps a non-extractable DEK and encrypts with fresh IVs', async () => {
        const kek = await deriveKek(new Uint8Array(32).fill(4), metadata(), UUID);
        const wrapped = await wrapDek(await generateDek(), kek, metadata(), UUID);
        const dek = await unwrapDek(wrapped, kek, metadata(), UUID);
        expect(dek.extractable).toBe(false);

        const first = await encryptNote('ümlaut ✓', dek, metadata(), UUID, 1);
        const second = await encryptNote('ümlaut ✓', dek, metadata(), UUID, 1);
        expect(first.iv).not.toBe(second.iv);
        expect(first.ct).not.toBe(second.ct);
        await expect(decryptNote(first, dek, metadata(), UUID, 1)).resolves.toBe(
            'ümlaut ✓'
        );
    });

    it('rejects tampering, wrong context, and malformed envelopes', async () => {
        const kek = await deriveKek(new Uint8Array(32).fill(6), metadata(), UUID);
        const wrapped = await wrapDek(await generateDek(), kek, metadata(), UUID);
        const dek = await unwrapDek(wrapped, kek, metadata(), UUID);
        const encrypted = await encryptNote('secret', dek, metadata(), UUID, 4);

        await expect(
            decryptNote(tamper(encrypted), dek, metadata(), UUID, 4)
        ).rejects.toThrow();
        await expect(
            decryptNote(encrypted, dek, metadata(), UUID, 5)
        ).rejects.toThrow();
        await expect(
            decryptNote(encrypted, dek, metadata(), `${UUID}-other`, 4)
        ).rejects.toThrow();
        await expect(
            unwrapDek(tamper(wrapped), kek, metadata(), UUID)
        ).rejects.toThrow();

        const malformed = {
            v: 1,
            alg: 'A256GCM',
            iv: toBase64url(new Uint8Array(4)),
            ct: bytes(1)
        } as AesGcmEnvelope;
        await expect(unwrapDek(malformed, kek, metadata(), UUID)).rejects.toThrow(
            /Expected 12 bytes/
        );
    });

    it('binds the documented context strings, unchanged', () => {
        // These strings are the AAD. Editing one silently orphans every stored
        // note, so they are pinned here rather than left to a refactor.
        expect(kekInfoText(UUID, metadata())).toBe(
            `["note.timben.net","key-encryption-key",1,"${UUID}","${CREDENTIAL_ID}"]`
        );
        expect(wrapAadText(UUID, metadata())).toBe(
            `["note.timben.net","dek-wrap",1,"${UUID}","${CREDENTIAL_ID}","${bytes(7)}"]`
        );
        expect(noteAadText(UUID, metadata(), 4)).toBe(
            `["note.timben.net","note",1,"${UUID}","${CREDENTIAL_ID}","${bytes(7)}",4]`
        );
    });
});

describe('display-only fingerprints', () => {
    it('is stable for one account and separates salt, credential and uuid', async () => {
        const prf = new Uint8Array(32).fill(3);
        const base = await deriveKekFingerprint(prf, metadata(), UUID);

        expect(base).toMatch(/^[0-9a-f]{8}$/);
        expect(await deriveKekFingerprint(prf, metadata(), UUID)).toBe(base);
        expect(
            await deriveKekFingerprint(prf, metadata({ hkdfSalt: bytes(9) }), UUID)
        ).not.toBe(base);
        expect(
            await deriveKekFingerprint(
                prf,
                metadata({ credentialId: toBase64url(new Uint8Array([9, 9])) }),
                UUID
            )
        ).not.toBe(base);
        expect(await deriveKekFingerprint(prf, metadata(), `${UUID}-other`)).not.toBe(base);
        expect(
            await deriveKekFingerprint(new Uint8Array(32).fill(4), metadata(), UUID)
        ).not.toBe(base);
    });

    it('rejects PRF output of the wrong length', async () => {
        await expect(
            deriveKekFingerprint(new Uint8Array(16), metadata(), UUID)
        ).rejects.toThrow(/Invalid PRF output length/);
    });

    it('does not disturb the key it labels', async () => {
        const prf = new Uint8Array(32).fill(5);
        const kek = await deriveKek(prf, metadata(), UUID);
        const wrapped = await wrapDek(await generateDek(), kek, metadata(), UUID);
        await deriveKekFingerprint(prf, metadata(), UUID);

        const later = await deriveKek(prf, metadata(), UUID);
        await expect(unwrapDek(wrapped, later, metadata(), UUID)).resolves.toBeDefined();
    });

    it('identifies an envelope without touching a key', async () => {
        const kek = await deriveKek(new Uint8Array(32).fill(6), metadata(), UUID);
        const wrapped = await wrapDek(await generateDek(), kek, metadata(), UUID);
        const other = await wrapDek(await generateDek(), kek, metadata(), UUID);

        const print = await envelopeFingerprint(wrapped);
        expect(print).toMatch(/^[0-9a-f]{8}$/);
        expect(await envelopeFingerprint(wrapped)).toBe(print);
        expect(await envelopeFingerprint(other)).not.toBe(print);
        expect(await envelopeFingerprint(tamper(wrapped))).not.toBe(print);
    });
});
