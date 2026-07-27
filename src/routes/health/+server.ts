import { pingDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

const headers = {
    'cache-control': 'no-store',
    'content-type': 'text/plain; charset=utf-8'
};

/**
 * Container healthcheck. Deliberately does not touch the SSO host.
 */
export const GET: RequestHandler = () => {
    try {
        pingDb();
        return new Response('ok\n', { headers });
    } catch (err) {
        console.error('health check failed', err);
        return new Response('database unavailable\n', { status: 503, headers });
    }
};
