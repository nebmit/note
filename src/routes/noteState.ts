import type { KeyringMetadata, NoteApiState } from '$lib/types';

export type LockedNoteState = Exclude<NoteApiState, { state: 'absent' }>;
export type PendingNoteState = Extract<NoteApiState, { state: 'pending' }>;
export type ReadyNoteState = Extract<NoteApiState, { state: 'ready' }>;

interface AuthoritativeNoteSources {
    /** Re-reads a note which was already initialized when the ceremony began. */
    load: () => Promise<NoteApiState>;
    /** Initializes a pending note, or returns the winner of an initialization race. */
    initialize: (pending: PendingNoteState) => Promise<NoteApiState>;
}

export function sameKeyringContext(
    left: KeyringMetadata,
    right: KeyringMetadata
): boolean {
    return (
        left.v === right.v &&
        left.credentialId === right.credentialId &&
        left.prfInput === right.prfInput &&
        left.hkdfSalt === right.hkdfSalt
    );
}

export function isExpectedSaveRevision(
    value: unknown,
    expected: number
): value is number {
    return (
        Number.isSafeInteger(value) &&
        Number.isSafeInteger(expected) &&
        value === expected
    );
}

/**
 * Returns the server-authoritative note only after the passkey ceremony.
 *
 * A ready snapshot can become stale while the note is locked, so it is always
 * re-read. A pending snapshot goes through the idempotent initialization API,
 * which returns the winning state if another tab initialized it first.
 */
export async function resolveAuthoritativeNote(
    prepared: LockedNoteState,
    sources: AuthoritativeNoteSources
): Promise<ReadyNoteState> {
    const authoritative =
        prepared.state === 'pending'
            ? await sources.initialize(prepared)
            : await sources.load();

    if (authoritative.state !== 'ready') {
        throw new Error('note_not_ready_after_unlock');
    }
    if (!sameKeyringContext(prepared.keyring, authoritative.keyring)) {
        throw new Error('keyring_changed_during_unlock');
    }
    return authoritative;
}
