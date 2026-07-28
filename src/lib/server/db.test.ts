import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { AesGcmEnvelope } from '$lib/types';
import {
    initializeNote,
    initializeSchema,
    readNoteState,
    reserveKeyring,
    saveNote
} from './db';

const UUID = 'user-1';
const CREDENTIAL = 'credential_1';
const SETUP_A = 'A'.repeat(43);
const SETUP_B = 'B'.repeat(43);

const wrap: AesGcmEnvelope = {
    v: 1,
    alg: 'A256GCM',
    iv: 'A'.repeat(16),
    ct: 'B'.repeat(64)
};
const ciphertext: AesGcmEnvelope = {
    v: 1,
    alg: 'A256GCM',
    iv: 'C'.repeat(16),
    ct: 'D'.repeat(22)
};

let handles: DatabaseSync[] = [];

function database(): DatabaseSync {
    const handle = new DatabaseSync(':memory:');
    handles.push(handle);
    initializeSchema(handle);
    return handle;
}

afterEach(() => {
    for (const handle of handles) handle.close();
    handles = [];
});

describe('note database', () => {
    it('destructively replaces the password schema and stamps v2', () => {
        const handle = new DatabaseSync(':memory:');
        handles.push(handle);
        handle.exec('CREATE TABLE notes (uuid TEXT PRIMARY KEY, content TEXT NOT NULL)');
        handle.exec('CREATE TABLE users_legacy (name TEXT)');
        initializeSchema(handle);

        const version = handle.prepare('PRAGMA user_version').get() as {
            user_version: number;
        };
        const legacy = handle
            .prepare(`SELECT name FROM sqlite_master WHERE name = 'users_legacy'`)
            .get();
        expect(version.user_version).toBe(2);
        expect(legacy).toBeUndefined();
    });

    it('keeps the first setup and initialization authoritative across races', () => {
        const handle = database();
        const first = reserveKeyring(UUID, CREDENTIAL, SETUP_A, SETUP_B, handle);
        const second = reserveKeyring(UUID, CREDENTIAL, SETUP_B, SETUP_A, handle);
        expect(first.created).toBe(true);
        expect(second.created).toBe(false);
        expect(second.state).toEqual(first.state);

        const initialized = initializeNote(UUID, CREDENTIAL, wrap, ciphertext, handle);
        const other = { ...ciphertext, ct: 'E'.repeat(22) };
        const raced = initializeNote(UUID, CREDENTIAL, wrap, other, handle);
        expect(initialized.created).toBe(true);
        expect(raced.created).toBe(false);
        expect(raced.state).toEqual(initialized.state);
        expect(readNoteState(UUID, handle).state).toBe('ready');
    });

    it('enforces credential identity and compare-and-swaps revisions', () => {
        const handle = database();
        reserveKeyring(UUID, CREDENTIAL, SETUP_A, SETUP_B, handle);
        expect(() =>
            initializeNote(UUID, 'different', wrap, ciphertext, handle)
        ).toThrow('credential_mismatch');

        initializeNote(UUID, CREDENTIAL, wrap, ciphertext, handle);
        const next = { ...ciphertext, ct: 'E'.repeat(22) };
        expect(saveNote(UUID, CREDENTIAL, next, 1, handle)).toEqual({
            ok: true,
            revision: 2
        });
        expect(saveNote(UUID, CREDENTIAL, next, 1, handle)).toEqual({
            ok: true,
            revision: 2
        });
        const stale = saveNote(UUID, CREDENTIAL, ciphertext, 1, handle);
        expect(stale).toEqual({
            ok: false,
            reason: 'conflict',
            current: { ciphertext: next, revision: 2 }
        });

        const afterDiscard = { ...ciphertext, ct: 'F'.repeat(22) };
        expect(saveNote(UUID, CREDENTIAL, afterDiscard, 2, handle)).toEqual({
            ok: true,
            revision: 3
        });
    });
});
