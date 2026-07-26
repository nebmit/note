import { writable, type Writable } from 'svelte/store';

const logsMessagesStore = writable(new Array<string>());

export const logStore = {
    subscribe: logsMessagesStore.subscribe,
    add: (message: string) => {
        logsMessagesStore.update((messages) => [...messages, message]);
    },
    clear: () => {
        logsMessagesStore.set([]);
    }
};

export const noteStore: Writable<{
    password: string;
    /** The stored envelope, or '' for a note that has never been saved. */
    stored: string;
} | null> = writable(null);
