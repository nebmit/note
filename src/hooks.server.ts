import { resolveUser } from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    event.locals.user = null;

    const sessionId = event.cookies.get('session_id');
    if (sessionId) {
        event.locals.user = await resolveUser(sessionId);
    }

    const response = await resolve(event);
    response.headers.set('referrer-policy', 'no-referrer');
    response.headers.set('x-content-type-options', 'nosniff');
    response.headers.set('x-frame-options', 'DENY');
    response.headers.set('cross-origin-opener-policy', 'same-origin');
    response.headers.set('cross-origin-resource-policy', 'same-origin');
    response.headers.set('permissions-policy', 'publickey-credentials-get=(self)');
    return response;
};
