import { writable } from 'svelte/store';

export type LogLevel = 'info' | 'error';

export interface LogDetail {
    label: string;
    value: string;
    /** Masked behind the log's reveal toggle. Public data, not a secret. */
    sensitive?: boolean;
}

export interface LogEntry {
    /** Unique for the page's lifetime, including across clears. */
    id: number;
    at: number;
    text: string;
    level: LogLevel;
    durationMs?: number;
    details: LogDetail[];
}

export interface LogOptions {
    level?: LogLevel;
    durationMs?: number;
    details?: LogDetail[];
}

/** Every autosave appends two entries, so this cannot grow unbounded. */
const MAX_ENTRIES = 500;

let nextId = 1;
const messages = writable<LogEntry[]>([]);

export const logStore = {
    subscribe: messages.subscribe,
    add(message: string, options: LogOptions = {}) {
        const entry: LogEntry = {
            id: nextId++,
            at: Date.now(),
            text: message,
            level: options.level ?? 'info',
            durationMs: options.durationMs,
            details: options.details ?? []
        };
        messages.update((current) => [...current, entry].slice(-MAX_ENTRIES));
    },
    clear() {
        messages.set([]);
    }
};

export function fact(label: string, value: string): LogDetail {
    return { label, value };
}

export function masked(label: string, value: string): LogDetail {
    return { label, value, sensitive: true };
}
