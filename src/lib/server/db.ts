import { env } from '$env/dynamic/private';
import { DatabaseSync } from 'node:sqlite';

let db: DatabaseSync | undefined;

function connect(): DatabaseSync {
    const handle = new DatabaseSync(env.DATABASE_PATH || './database_sqlite3.db');

    handle.exec(`
        CREATE TABLE IF NOT EXISTS notes (
            uuid       TEXT PRIMARY KEY,
            content    TEXT NOT NULL DEFAULT '',
            updated_at INTEGER NOT NULL
        );
    `);

    // The pre-wake-up schema. Its rows are encrypted under the old fixed-IV
    // format and cannot be read by the current crypto, but renaming rather than
    // dropping means nothing is destroyed.
    const legacy = handle
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'`)
        .get();
    if (legacy) {
        handle.exec('ALTER TABLE users RENAME TO users_legacy');
    }

    return handle;
}

function database(): DatabaseSync {
    if (!db) db = connect();
    return db;
}

/** The stored envelope for a user, or '' when they have no note yet. */
export function readNote(uuid: string): string {
    const row = database()
        .prepare('SELECT content FROM notes WHERE uuid = ?')
        .get(uuid) as { content: string } | undefined;
    return row?.content ?? '';
}

export function writeNote(uuid: string, content: string): void {
    database()
        .prepare(
            `INSERT INTO notes (uuid, content, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(uuid) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`
        )
        .run(uuid, content, Date.now());
}
