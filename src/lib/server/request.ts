export type JsonBodyResult =
    | { ok: true; value: unknown }
    | { ok: false; reason: 'invalid' | 'too_large' };

/**
 * Read JSON with an actual streaming cap. Checking Content-Length alone is
 * insufficient because a chunked request can omit or lie about it.
 */
export async function readJsonBody(
    request: Request,
    maxBytes: number
): Promise<JsonBodyResult> {
    const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim();
    if (contentType !== 'application/json') {
        return { ok: false, reason: 'invalid' };
    }

    const declared = request.headers.get('content-length');
    if (declared !== null) {
        const length = Number(declared);
        if (!Number.isSafeInteger(length) || length < 0) {
            return { ok: false, reason: 'invalid' };
        }
        if (length > maxBytes) return { ok: false, reason: 'too_large' };
    }

    if (request.body === null) return { ok: false, reason: 'invalid' };
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > maxBytes) {
                await reader.cancel();
                return { ok: false, reason: 'too_large' };
            }
            chunks.push(value);
        }
    } catch {
        return { ok: false, reason: 'invalid' };
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }

    try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        return { ok: true, value: JSON.parse(text) };
    } catch {
        return { ok: false, reason: 'invalid' };
    }
}
