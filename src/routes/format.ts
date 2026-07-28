/**
 * Presentation helpers shared by the screens. Nothing here touches key material
 * or plaintext — the uuid is already known to the SSO host, the base64url values
 * it abbreviates are the same ones the server stores, and the timestamps are
 * local wall-clock values.
 */

/** `6f1c2e84…e7b912` — the identity chip in the header and the unlock screen. */
export function shortUuid(uuid: string): string {
    return uuid.length <= 15 ? uuid : `${uuid.slice(0, 8)}…${uuid.slice(-6)}`;
}

/** `09:14:01` — the security log's timestamp gutter. */
export function clockTime(at: number): string {
    return new Date(at).toLocaleTimeString('en-GB', { hour12: false });
}

/** `2s ago` · `6 min ago` · `3 h ago`, for the status ticker and exit sheet. */
export function ago(at: number, now: number): string {
    // Floor, not round: a line written 400 ms ago reads `0s ago`, not `1s ago`.
    const seconds = Math.max(0, Math.floor((now - at) / 1_000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.round(minutes / 60)} h ago`;
}

/**
 * `0.41 ms` · `12.4 ms` · `312 ms` · `1.24 s` — a `performance.now()` delta.
 *
 * Keep the sub-millisecond digits: a derive plus one AES-GCM pass lands well
 * under 1 ms, and rounding rendered every step of the log as `0 ms`.
 */
export function duration(ms: number): string {
    const value = Math.max(0, ms);
    if (value < 1) return `${value.toFixed(2)} ms`;
    if (value < 100) return `${value.toFixed(1)} ms`;
    if (value < 1000) return `${Math.round(value).toLocaleString()} ms`;
    return `${(value / 1000).toFixed(2)} s`;
}

/** `AbC123dEf456…9xYz12` — long base64url values in a fixed-width gutter. */
export function abbreviate(value: string, head = 12, tail = 6): string {
    return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** `1,398 bytes` */
export function byteCount(bytes: number): string {
    return `${bytes.toLocaleString()} ${bytes === 1 ? 'byte' : 'bytes'}`;
}

/** Decoded length of a base64url value, without allocating the bytes. */
export function base64urlBytes(value: string): number {
    return Math.floor((value.length * 3) / 4);
}
