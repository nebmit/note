import { writable } from 'svelte/store';

const messages = writable<string[]>([]);

export const logStore = {
    subscribe: messages.subscribe,
    add(message: string) {
        messages.update((current) => [...current, message]);
    },
    clear() {
        messages.set([]);
    }
};
