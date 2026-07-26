import { resolveUser } from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    event.locals.user = null;

    const sessionId = event.cookies.get('session_id');
    if (sessionId) {
        event.locals.user = await resolveUser(sessionId);
    }

    return resolve(event);
};
