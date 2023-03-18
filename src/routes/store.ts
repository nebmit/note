import { writable } from 'svelte/store';

const logsMessagesStore = writable(new Array<string>());

export const logStore = {
    subscribe: logsMessagesStore.subscribe,
    add: (message: string) => {
        logsMessagesStore.update((messages) => {
            messages.push(message);
            return messages;
        });
    }
}