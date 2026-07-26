import { env } from '$env/dynamic/private';
import type { SsoUser } from '$lib/types';
import { createHash } from 'node:crypto';

const SSO_TIMEOUT_MS = 3_000;
const CACHE_TTL_MS = 60_000;

/**
 * Resolved sessions, keyed on sha256(session id) — never on the raw id, which
 * *is* the session. `null` is cached too, so a signed-out visitor does not hit
 * the SSO host on every request either.
 */
const cache = new Map<string, { user: SsoUser | null; expires: number }>();

let warnedMissingOrigin = false;

function authOrigin(): string | undefined {
    const origin = env.AUTH_ORIGIN?.replace(/\/+$/, '') || undefined;
    if (!origin && !warnedMissingOrigin) {
        warnedMissingOrigin = true;
        console.warn('AUTH_ORIGIN is not set — every request will resolve as signed out.');
    }
    return origin;
}

/** Absolute URL back into this app, built from the configured origin rather
 *  than the request Host so it stays correct behind a proxy. */
function returnTo(path = '/'): string {
    const origin = env.ORIGIN?.replace(/\/+$/, '') ?? 'http://localhost:5173';
    return `${origin}${path}`;
}

export function signInUrl(path = '/'): string | null {
    const origin = authOrigin();
    if (!origin) return null;
    return `${origin}/auth?redirect_uri=${encodeURIComponent(returnTo(path))}`;
}

export function signOutUrl(path = '/'): string | null {
    const origin = authOrigin();
    if (!origin) return null;
    return `${origin}/auth/logout?redirect_uri=${encodeURIComponent(returnTo(path))}`;
}

function prune(now: number) {
    for (const [key, entry] of cache) {
        if (entry.expires <= now) cache.delete(key);
    }
}

/**
 * Exchange a session id for a user via the SSO host. Any failure — bad status,
 * malformed body, timeout, host unreachable — resolves to `null`, i.e. signed
 * out. The SSO host being down must never produce a broken page.
 */
export async function resolveUser(sessionId: string): Promise<SsoUser | null> {
    const origin = authOrigin();
    if (!origin) return null;

    const key = createHash('sha256').update(sessionId).digest('hex');
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expires > now) return cached.user;

    let user: SsoUser | null = null;
    try {
        const res = await fetch(`${origin}/auth/sso`, {
            headers: { authorization: `Bearer ${sessionId}` },
            signal: AbortSignal.timeout(SSO_TIMEOUT_MS)
        });
        if (res.ok) {
            const data = await res.json();
            if (data?.success === true && typeof data.user?.uuid === 'string') {
                user = { uuid: data.user.uuid, elevated: data.user.elevated === true };
            }
        }
    } catch {
        // Unreachable or timed out. Treat as signed out; never log the session id.
        return null;
    }

    prune(now);
    cache.set(key, { user, expires: now + CACHE_TTL_MS });
    return user;
}
