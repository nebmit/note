import { writable } from 'svelte/store';

export interface LogEntry {
    /** Wall-clock capture time, rendered as the log's HH:MM:SS gutter. */
    at: number;
    text: string;
}

const messages = writable<LogEntry[]>([]);

export const logStore = {
    subscribe: messages.subscribe,
    add(message: string) {
        messages.update((current) => [...current, { at: Date.now(), text: message }]);
    },
    clear() {
        messages.set([]);
    }
};
