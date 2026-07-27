import { readNoteState, saveNote } from '$lib/server/db';
import {
    isBaseRevision,
    isNoteCiphertext
} from '$lib/server/noteValidation';
import { readJsonBody } from '$lib/server/request';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const NO_STORE = { 'cache-control': 'no-store' };
const MAX_REQUEST_BYTES = 1_400_000;

export const GET: RequestHandler = ({ locals }) => {
    if (locals.user === null) {
        return json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
    }
    if (locals.user.passkey === null) {
        return json({ error: 'passkey_unavailable' }, { status: 409, headers: NO_STORE });
    }
    return json(readNoteState(locals.user.uuid), { headers: NO_STORE });
};

export const PUT: RequestHandler = async ({ locals, request }) => {
    if (locals.user === null) {
        return json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
    }
    if (locals.user.passkey === null) {
        return json({ error: 'passkey_unavailable' }, { status: 409, headers: NO_STORE });
    }

    const parsed = await readJsonBody(request, MAX_REQUEST_BYTES);
    if (!parsed.ok) {
        return json(
            { error: parsed.reason === 'too_large' ? 'request_too_large' : 'invalid_request' },
            { status: parsed.reason === 'too_large' ? 413 : 400, headers: NO_STORE }
        );
    }
    const body = parsed.value as Record<string, unknown> | null;
    const ciphertext = body?.ciphertext;
    const baseRevision = body?.baseRevision;
    if (!isNoteCiphertext(ciphertext) || !isBaseRevision(baseRevision)) {
        return json({ error: 'invalid_request' }, { status: 400, headers: NO_STORE });
    }

    const result = saveNote(
        locals.user.uuid,
        locals.user.passkey.credentialId,
        ciphertext,
        baseRevision
    );
    if (result.ok) return json({ revision: result.revision }, { headers: NO_STORE });
    if (result.reason === 'not_found') {
        return json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
    }
    if (result.reason === 'credential_mismatch') {
        return json({ error: 'credential_mismatch' }, { status: 409, headers: NO_STORE });
    }
    return json(
        { error: 'conflict', current: result.current },
        { status: 409, headers: NO_STORE }
    );
};
