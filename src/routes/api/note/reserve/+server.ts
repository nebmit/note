import { reserveKeyring } from '$lib/server/db';
import { isSetupValue } from '$lib/server/noteValidation';
import { readJsonBody } from '$lib/server/request';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const NO_STORE = { 'cache-control': 'no-store' };
const MAX_REQUEST_BYTES = 2_048;

export const POST: RequestHandler = async ({ locals, request }) => {
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
    if (!isSetupValue(body?.prfInput) || !isSetupValue(body?.hkdfSalt)) {
        return json({ error: 'invalid_request' }, { status: 400, headers: NO_STORE });
    }

    const result = reserveKeyring(
        locals.user.uuid,
        locals.user.passkey.credentialId,
        body.prfInput,
        body.hkdfSalt
    );
    const stateCredential =
        result.state.state === 'absent'
            ? null
            : result.state.keyring.credentialId;
    if (stateCredential !== locals.user.passkey.credentialId) {
        return json({ error: 'credential_mismatch' }, { status: 409, headers: NO_STORE });
    }
    return json(result.state, {
        status: result.created ? 201 : 200,
        headers: NO_STORE
    });
};
