/**
 * Shared wall-clock tick for the `Ns ago` suffixes. One second is the smallest
 * unit `ago` renders, so that is the cadence; it pauses while the tab is hidden.
 */
import { onDestroy } from 'svelte';

export function createNowTicker(intervalMs = 1_000): { readonly value: number } {
    let now = $state(Date.now());
    let timer: ReturnType<typeof setInterval> | undefined;

    function stop(): void {
        if (timer !== undefined) clearInterval(timer);
        timer = undefined;
    }

    function start(): void {
        if (timer !== undefined) return;
        timer = setInterval(() => (now = Date.now()), intervalMs);
    }

    function sync(): void {
        // Resync before resuming: the age is arbitrarily stale after a pause.
        now = Date.now();
        if (document.hidden) stop();
        else start();
    }

    if (typeof document !== 'undefined') {
        sync();
        document.addEventListener('visibilitychange', sync);
        onDestroy(() => {
            stop();
            document.removeEventListener('visibilitychange', sync);
        });
    }

    return {
        get value() {
            return now;
        }
    };
}
