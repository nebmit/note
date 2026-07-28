import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toBase64url } from '$lib/crypto';
import type { NoteApiState, SsoUser } from '$lib/types';

const db = vi.hoisted(() => ({
    readNoteState: vi.fn(),
    reserveKeyring: vi.fn(),
    initializeNote: vi.fn(),
    saveNote: vi.fn()
}));

vi.mock('$lib/server/db', () => db);

import {
    GET as getNote,
    PUT as putNote
} from '../src/routes/api/note/+server';
import { POST as reserve } from '../src/routes/api/note/reserve/+server';
import { POST as initialize } from '../src/routes/api/note/initialize/+server';

const passkey = {
    credentialId: 'credential_1',
    rpId: 'timben.net',
    prfCapable: true
};
const user: SsoUser = {
    uuid: 'user-1',
    elevated: false,
    passkey
};
const keyring = {
    v: 1 as const,
    credentialId: passkey.credentialId,
    prfInput: toBase64url(new Uint8Array(32).fill(1)),
    hkdfSalt: toBase64url(new Uint8Array(32).fill(2))
};
const wrappedDek = {
    v: 1 as const,
    alg: 'A256GCM' as const,
    iv: toBase64url(new Uint8Array(12).fill(3)),
    ct: toBase64url(new Uint8Array(48).fill(4))
};
const ciphertext = {
    v: 1 as const,
    alg: 'A256GCM' as const,
    iv: toBase64url(new Uint8Array(12).fill(5)),
    ct: toBase64url(new Uint8Array(16).fill(6))
};
const pending: NoteApiState = { state: 'pending', keyring };
const ready: NoteApiState = {
    state: 'ready',
    keyring: { ...keyring, wrappedDek },
    note: { ciphertext, revision: 1 }
};

async function call(
    handler: (event: never) => Response | Promise<Response>,
    options: {
        locals?: { user: SsoUser | null };
        body?: unknown;
    } = {}
): Promise<Response> {
    const request = new Request('https://note.timben.net/api/note', {
        method: options.body === undefined ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    return handler({
        locals: options.locals ?? { user },
        request
    } as never);
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('note API authorization and state', () => {
    it('fails closed without a session or singular passkey', async () => {
        const response = await call(getNote, { locals: { user: null } });
        expect(response.status).toBe(401);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(db.readNoteState).not.toHaveBeenCalled();

        const noPasskey = await call(getNote, {
            locals: { user: { ...user, passkey: null } }
        });
        expect(noPasskey.status).toBe(409);
        await expect(noPasskey.json()).resolves.toEqual({
            error: 'passkey_unavailable'
        });
    });

    it('does not return a keyring belonging to a replaced SSO credential', async () => {
        db.readNoteState.mockReturnValue(ready);
        const response = await call(getNote, {
            locals: {
                user: {
                    ...user,
                    passkey: { ...passkey, credentialId: 'replacement' }
                }
            }
        });
        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            error: 'credential_mismatch'
        });
    });
});

describe('note API mutations', () => {
    it('reserves setup under the SSO credential and returns a raced initialization', async () => {
        db.reserveKeyring.mockReturnValue({ created: true, state: pending });
        const reserved = await call(reserve, {
            body: { prfInput: keyring.prfInput, hkdfSalt: keyring.hkdfSalt }
        });
        expect(reserved.status).toBe(201);
        expect(db.reserveKeyring).toHaveBeenCalledWith(
            user.uuid,
            passkey.credentialId,
            keyring.prfInput,
            keyring.hkdfSalt
        );

        db.initializeNote.mockReturnValue({ created: false, state: ready });
        const initialized = await call(initialize, {
            body: { wrappedDek, ciphertext }
        });
        expect(initialized.status).toBe(200);
        await expect(initialized.json()).resolves.toEqual(ready);
    });

    it('rejects malformed initialization before storage', async () => {
        const response = await call(initialize, {
            body: { wrappedDek: { bad: true }, ciphertext }
        });
        expect(response.status).toBe(400);
        expect(db.initializeNote).not.toHaveBeenCalled();
    });

    it('returns a stale-write conflict without overwriting', async () => {
        db.saveNote.mockReturnValue({
            ok: false,
            reason: 'conflict',
            current: { ciphertext, revision: 2 }
        });
        const response = await call(putNote, {
            body: { ciphertext, baseRevision: 1 }
        });
        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            error: 'conflict',
            current: { ciphertext, revision: 2 }
        });
    });

    it('rejects a base revision whose increment cannot be represented safely', async () => {
        const response = await call(putNote, {
            body: { ciphertext, baseRevision: Number.MAX_SAFE_INTEGER }
        });
        expect(response.status).toBe(400);
        expect(db.saveNote).not.toHaveBeenCalled();
    });
});
