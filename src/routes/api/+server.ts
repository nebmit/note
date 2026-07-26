import { readNote, writeNote } from '$lib/server/db';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Refuse anything larger than this, so a note cannot fill the disk. */
const MAX_CONTENT_BYTES = 1_000_000;

export const GET: RequestHandler = ({ locals }) => {
    if (!locals.user) throw error(401, 'Not signed in');

    return json({ content: readNote(locals.user.uuid) });
};

export const POST: RequestHandler = async ({ locals, request }) => {
    if (!locals.user) throw error(401, 'Not signed in');

    const body = await request.json().catch(() => null);
    const content = body?.content;

    if (typeof content !== 'string') {
        throw error(400, 'content must be a string');
    }
    if (content.length > MAX_CONTENT_BYTES) {
        throw error(413, 'content too large');
    }

    writeNote(locals.user.uuid, content);

    return json({ success: true });
};
