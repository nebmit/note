/**
 * Presentation helpers shared by the screens. Nothing here touches key material
 * or plaintext — the uuid is already known to the SSO host, and the timestamps
 * are local wall-clock values.
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
    const seconds = Math.max(0, Math.round((now - at) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.round(minutes / 60)} h ago`;
}
