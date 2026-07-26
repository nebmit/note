import { signInUrl, signOutUrl } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
    return {
        user: locals.user,
        // Built server-side from the configured ORIGIN. These must never be
        // assembled in a component — that is what baked the auth host into the
        // client bundle previously.
        signInUrl: signInUrl(),
        signOutUrl: signOutUrl()
    };
};
