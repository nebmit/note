import { writable, type Writable } from 'svelte/store';

const logsMessagesStore = writable(new Array<string>());

export const logStore = {
    subscribe: logsMessagesStore.subscribe,
    add: (message: string) => {
        logsMessagesStore.update((messages) => {
            messages.push(message);
            return messages;
        });
    },
    clear: () => {
        logsMessagesStore.set([]);
    }
};

export const userStore: Writable<{
    name: string;
    password: string;
    salt: string;
    content: string;
} | null> = writable(null);
