import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    CredentialMismatchError,
    PrfUnavailableError,
    runPrfCeremony,
    toBase64url
} from './crypto';
import type { SsoPasskey } from './types';

const credentialBytes = new Uint8Array([1, 2, 3, 4]);
const passkey: SsoPasskey = {
    credentialId: toBase64url(credentialBytes),
    rpId: 'timben.net',
    prfCapable: true
};
const prfInput = toBase64url(new Uint8Array(32).fill(9));

function installCredential(
    options: { id?: string; output?: Uint8Array; result?: PublicKeyCredential | null } = {}
) {
    const get = vi.fn(async (_request: CredentialRequestOptions) => {
        if ('result' in options) return options.result;
        return {
            id: options.id ?? passkey.credentialId,
            getClientExtensionResults: () => ({
                prf: {
                    results: {
                        first: (options.output ?? new Uint8Array(32).fill(4)).buffer
                    }
                }
            })
        };
    });
    vi.stubGlobal('window', { PublicKeyCredential: class {} });
    vi.stubGlobal('PublicKeyCredential', class {});
    vi.stubGlobal('navigator', { credentials: { get } });
    return get;
}

function asBytes(source: BufferSource): Uint8Array {
    if (source instanceof ArrayBuffer) return new Uint8Array(source);
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('runPrfCeremony', () => {
    it('requests the exact credential, RP, UV and PRF input', async () => {
        const get = installCredential();
        await expect(runPrfCeremony(passkey, prfInput)).resolves.toEqual(
            new Uint8Array(32).fill(4)
        );

        const request = get.mock.calls[0][0];
        if (request.publicKey === undefined) throw new Error('missing publicKey options');
        expect(request.publicKey.rpId).toBe('timben.net');
        expect(request.publicKey.userVerification).toBe('required');
        expect(asBytes(request.publicKey.allowCredentials?.[0].id as BufferSource)).toEqual(
            credentialBytes
        );
        expect(
            new Uint8Array(
                (
                    request.publicKey.extensions as {
                        prf: { eval: { first: Uint8Array } };
                    }
                ).prf.eval.first
            )
        ).toEqual(new Uint8Array(32).fill(9));
        expect(asBytes(request.publicKey.challenge)).toHaveLength(32);
    });

    it('rejects mismatched credentials and unusable PRF results', async () => {
        installCredential({ id: 'different' });
        await expect(runPrfCeremony(passkey, prfInput)).rejects.toBeInstanceOf(
            CredentialMismatchError
        );

        vi.unstubAllGlobals();
        installCredential({ result: null });
        await expect(runPrfCeremony(passkey, prfInput)).rejects.toBeInstanceOf(
            PrfUnavailableError
        );

        vi.unstubAllGlobals();
        installCredential({ output: new Uint8Array(16) });
        await expect(runPrfCeremony(passkey, prfInput)).rejects.toBeInstanceOf(
            PrfUnavailableError
        );
    });
});
