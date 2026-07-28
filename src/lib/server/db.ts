import { env } from '$env/dynamic/private';
import type {
    AesGcmEnvelope,
    KeyringMetadata,
    NoteApiState
} from '$lib/types';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA_VERSION = 2;

let db: DatabaseSync | undefined;

interface NoteRow {
    uuid: string;
    credential_id: string;
    prf_input: string;
    hkdf_salt: string;
    wrapped_dek: string | null;
    content: string | null;
    revision: number;
    created_at: number;
    updated_at: number;
}

function createSchema(handle: DatabaseSync): void {
    handle.exec(`
        CREATE TABLE notes (
            uuid          TEXT PRIMARY KEY,
            credential_id TEXT NOT NULL,
            prf_input     TEXT NOT NULL,
            hkdf_salt     TEXT NOT NULL,
            wrapped_dek   TEXT,
            content       TEXT,
            revision      INTEGER NOT NULL DEFAULT 0,
            created_at    INTEGER NOT NULL,
            updated_at    INTEGER NOT NULL,
            CHECK (
                (wrapped_dek IS NULL AND content IS NULL AND revision = 0)
                OR
                (wrapped_dek IS NOT NULL AND content IS NOT NULL AND revision >= 1)
            )
        );
    `);
}

/** Destructive v1 → v2 migration: password-encrypted rows are not retained. */
export function initializeSchema(handle: DatabaseSync): void {
    const row = handle.prepare('PRAGMA user_version').get() as {
        user_version: number;
    };
    if (row.user_version > SCHEMA_VERSION) {
        throw new Error(`Database schema ${row.user_version} is newer than this application`);
    }

    if (row.user_version === SCHEMA_VERSION) return;

    handle.exec('BEGIN IMMEDIATE');
    try {
        handle.exec(`
            DROP TABLE IF EXISTS notes;
            DROP TABLE IF EXISTS users;
            DROP TABLE IF EXISTS users_legacy;
        `);
        createSchema(handle);
        handle.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
        handle.exec('COMMIT');
    } catch (error) {
        handle.exec('ROLLBACK');
        throw error;
    }
}

export function openDatabase(path: string): DatabaseSync {
    const handle = new DatabaseSync(path);
    handle.exec('PRAGMA busy_timeout = 5000');
    initializeSchema(handle);
    return handle;
}

function database(): DatabaseSync {
    db ??= openDatabase(env.DATABASE_PATH || './database_sqlite3.db');
    return db;
}

function transaction<T>(handle: DatabaseSync, run: () => T): T {
    handle.exec('BEGIN IMMEDIATE');
    try {
        const result = run();
        handle.exec('COMMIT');
        return result;
    } catch (error) {
        handle.exec('ROLLBACK');
        throw error;
    }
}

function metadata(row: NoteRow): KeyringMetadata {
    return {
        v: 1,
        credentialId: row.credential_id,
        prfInput: row.prf_input,
        hkdfSalt: row.hkdf_salt
    };
}

function parseEnvelope(value: string): AesGcmEnvelope {
    return JSON.parse(value) as AesGcmEnvelope;
}

function envelopesEqual(
    left: AesGcmEnvelope,
    right: AesGcmEnvelope
): boolean {
    return (
        left.v === right.v &&
        left.alg === right.alg &&
        left.iv === right.iv &&
        left.ct === right.ct
    );
}

function toApiState(row: NoteRow | undefined): NoteApiState {
    if (row === undefined) return { state: 'absent' };
    const keyring = metadata(row);
    if (row.wrapped_dek === null || row.content === null) {
        return { state: 'pending', keyring };
    }
    return {
        state: 'ready',
        keyring: {
            ...keyring,
            wrappedDek: parseEnvelope(row.wrapped_dek)
        },
        note: {
            ciphertext: parseEnvelope(row.content),
            revision: row.revision
        }
    };
}

function selectRow(uuid: string, handle: DatabaseSync): NoteRow | undefined {
    return handle
        .prepare('SELECT * FROM notes WHERE uuid = ?')
        .get(uuid) as NoteRow | undefined;
}

export function pingDb(): void {
    database().prepare('SELECT 1').get();
}

export function readNoteState(
    uuid: string,
    handle: DatabaseSync = database()
): NoteApiState {
    return toApiState(selectRow(uuid, handle));
}

export function reserveKeyring(
    uuid: string,
    credentialId: string,
    prfInput: string,
    hkdfSalt: string,
    handle: DatabaseSync = database()
): { created: boolean; state: NoteApiState } {
    return transaction(handle, () => {
        const now = Date.now();
        const result = handle
            .prepare(
                `INSERT INTO notes (
                    uuid, credential_id, prf_input, hkdf_salt,
                    wrapped_dek, content, revision, created_at, updated_at
                ) VALUES (?, ?, ?, ?, NULL, NULL, 0, ?, ?)
                ON CONFLICT(uuid) DO NOTHING`
            )
            .run(uuid, credentialId, prfInput, hkdfSalt, now, now);
        return {
            created: result.changes === 1,
            state: toApiState(selectRow(uuid, handle))
        };
    });
}

export function initializeNote(
    uuid: string,
    credentialId: string,
    wrappedDek: AesGcmEnvelope,
    ciphertext: AesGcmEnvelope,
    handle: DatabaseSync = database()
): { created: boolean; state: NoteApiState } {
    return transaction(handle, () => {
        const current = selectRow(uuid, handle);
        if (current === undefined) throw new Error('keyring_not_reserved');
        if (current.credential_id !== credentialId) throw new Error('credential_mismatch');
        if (current.wrapped_dek !== null) {
            return { created: false, state: toApiState(current) };
        }
        const result = handle
            .prepare(
                `UPDATE notes
                 SET wrapped_dek = ?, content = ?, revision = 1, updated_at = ?
                 WHERE uuid = ? AND credential_id = ? AND wrapped_dek IS NULL`
            )
            .run(
                JSON.stringify(wrappedDek),
                JSON.stringify(ciphertext),
                Date.now(),
                uuid,
                credentialId
            );
        return {
            created: result.changes === 1,
            state: toApiState(selectRow(uuid, handle))
        };
    });
}

export type SaveResult =
    | { ok: true; revision: number }
    | { ok: false; reason: 'not_found' }
    | { ok: false; reason: 'credential_mismatch' }
    | {
        ok: false;
        reason: 'conflict';
        current: { ciphertext: AesGcmEnvelope; revision: number };
    };

export function saveNote(
    uuid: string,
    credentialId: string,
    ciphertext: AesGcmEnvelope,
    baseRevision: number,
    handle: DatabaseSync = database()
): SaveResult {
    return transaction(handle, () => {
        const current = selectRow(uuid, handle);
        if (current === undefined || current.wrapped_dek === null || current.content === null) {
            return { ok: false, reason: 'not_found' };
        }
        if (current.credential_id !== credentialId) {
            return { ok: false, reason: 'credential_mismatch' };
        }
        if (
            current.revision === baseRevision + 1 &&
            envelopesEqual(parseEnvelope(current.content), ciphertext)
        ) {
            return { ok: true, revision: current.revision };
        }
        if (current.revision !== baseRevision) {
            return {
                ok: false,
                reason: 'conflict',
                current: {
                    ciphertext: parseEnvelope(current.content),
                    revision: current.revision
                }
            };
        }

        const revision = baseRevision + 1;
        const result = handle
            .prepare(
                `UPDATE notes
                 SET content = ?, revision = ?, updated_at = ?
                 WHERE uuid = ? AND credential_id = ? AND revision = ?`
            )
            .run(
                JSON.stringify(ciphertext),
                revision,
                Date.now(),
                uuid,
                credentialId,
                baseRevision
            );
        if (result.changes !== 1) {
            const winner = selectRow(uuid, handle);
            if (winner?.content === null || winner === undefined) {
                return { ok: false, reason: 'not_found' };
            }
            return {
                ok: false,
                reason: 'conflict',
                current: {
                    ciphertext: parseEnvelope(winner.content),
                    revision: winner.revision
                }
            };
        }
        return { ok: true, revision };
    });
}
