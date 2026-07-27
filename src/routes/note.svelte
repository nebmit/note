<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { cubicIn, cubicOut } from 'svelte/easing';
    import { draw, fade, fly } from 'svelte/transition';
    import { encryptNote } from '$lib/crypto';
    import type { KeyringMetadata } from '$lib/types';
    import { logStore } from './store';

    let {
        uuid,
        signOutUrl,
        initialContent,
        initialRevision,
        metadata,
        dek,
        onLock
    }: {
        uuid: string;
        signOutUrl: string | null;
        initialContent: string;
        initialRevision: number;
        metadata: KeyringMetadata;
        dek: CryptoKey;
        onLock: () => void;
    } = $props();

    let visible = $state(false);
    // svelte-ignore state_referenced_locally
    let content = $state(initialContent);
    // svelte-ignore state_referenced_locally
    let revision = $state(initialRevision);
    let savestate = $state('saved');
    let dirty = $state(false);
    let conflict = $state(false);
    let fatalMessage = $state('');
    let pendingExit = $state<'lock' | 'signout' | null>(null);
    let exitFailed = $state(false);

    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let activeSave: Promise<boolean> | null = null;

    function elapsed(start: number): string {
        return `${Math.round(performance.now() - start).toLocaleString()} ms`;
    }

    onMount(() => {
        visible = true;
        document.getElementById('textarea')?.focus();
    });

    onDestroy(() => {
        if (saveTimer) clearTimeout(saveTimer);
    });

    async function saveSnapshot(): Promise<boolean> {
        const snapshot = content;
        const baseRevision = revision;
        const nextRevision = baseRevision + 1;
        savestate = 'encrypting…';
        const started = performance.now();

        let ciphertext;
        try {
            ciphertext = await encryptNote(
                snapshot,
                dek,
                metadata,
                uuid,
                nextRevision
            );
            logStore.add(
                `encrypted revision ${nextRevision.toLocaleString()} locally with a fresh AES-GCM iv in ${elapsed(started)}`
            );
        } catch (error) {
            console.error('note encryption failed', error);
            savestate = 'error';
            logStore.add('ERROR: local note encryption failed');
            return false;
        }

        savestate = 'saving…';
        try {
            const response = await fetch('/api/note', {
                method: 'PUT',
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({ ciphertext, baseRevision })
            });
            const body = await response.json().catch(() => null);

            if (response.status === 409 && body?.error === 'conflict') {
                conflict = true;
                savestate = 'conflict';
                logStore.add(
                    `ERROR: revision conflict; refusing to overwrite revision ${body.current?.revision ?? 'unknown'}`
                );
                return false;
            }
            if (response.status === 409 && body?.error === 'credential_mismatch') {
                fatalMessage = 'The SSO passkey no longer matches this encrypted note.';
                savestate = 'credential mismatch';
                logStore.add('ERROR: SSO credential no longer matches the keyring');
                return false;
            }
            if (!response.ok || typeof body?.revision !== 'number') {
                savestate = 'error';
                if (response.status === 401) {
                    fatalMessage = 'Your SSO session expired. Sign in again.';
                    logStore.add('ERROR: SSO session expired before save');
                } else {
                    logStore.add(`ERROR: encrypted save failed (${response.status})`);
                }
                return false;
            }

            revision = body.revision;
            dirty = content !== snapshot;
            savestate = dirty ? 'waiting…' : 'saved';
            logStore.add(`stored encrypted revision ${revision.toLocaleString()}`);
            return true;
        } catch (error) {
            console.error('note save failed', error);
            savestate = 'offline';
            logStore.add('ERROR: could not reach the server');
            return false;
        }
    }

    async function flush(): Promise<boolean> {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = undefined;
        }
        while (dirty && !conflict && fatalMessage === '') {
            const running = activeSave ?? saveSnapshot();
            activeSave = running;
            const ok = await running;
            if (activeSave === running) activeSave = null;
            if (!ok) return false;
        }
        return !dirty && !conflict && fatalMessage === '';
    }

    function scheduleSave(): void {
        if (pendingExit !== null || conflict || fatalMessage !== '') return;
        dirty = true;
        savestate = 'waiting…';
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveTimer = undefined;
            void flush();
        }, 700);
    }

    function completeExit(kind: 'lock' | 'signout'): void {
        content = '';
        dirty = false;
        if (kind === 'signout' && signOutUrl !== null) {
            onLock();
            window.location.assign(signOutUrl);
            return;
        }
        onLock();
    }

    async function requestExit(kind: 'lock' | 'signout'): Promise<void> {
        if (kind === 'signout' && signOutUrl === null) return;
        pendingExit = kind;
        exitFailed = false;
        savestate = dirty ? 'securing changes…' : 'locking…';
        if (await flush()) {
            completeExit(kind);
            return;
        }
        exitFailed = true;
        savestate = 'save failed';
    }

    function discardAndExit(): void {
        const kind = pendingExit;
        if (kind === null) return;
        completeExit(kind);
    }

    function scrollToNewMessages(node: HTMLDivElement, _args: string[]) {
        const scroll = () => node.scroll({ top: node.scrollHeight, behavior: 'smooth' });
        scroll();
        return { update: scroll };
    }
</script>

{#if visible}
    <div class="flex h-full flex-auto flex-col">
        <nav
            class="flex flex-row items-center justify-between bg-slate-900 p-4 lg:hidden"
            transition:fly={{ y: -10, duration: 500 }}
        >
            <div class="flex flex-row items-center">
                <img class="h-6 w-6 rounded-full" src="favicon.ico" alt="Logo" />
                <span class="logo-name unselectable ml-4 uppercase text-slate-100">
                    Note
                </span>
            </div>
            <div class="flex flex-row gap-4">
                <button
                    class="rounded bg-transparent text-sm text-slate-300 hover:text-white"
                    onclick={() => void requestExit('lock')}
                >
                    lock
                </button>
                {#if signOutUrl}
                    <a
                        class="rounded bg-transparent text-sm text-red-600 hover:text-red-800"
                        href={signOutUrl}
                        onclick={(event) => {
                            event.preventDefault();
                            void requestExit('signout');
                        }}
                    >
                        sign out
                    </a>
                {/if}
            </div>
        </nav>

        <svg class="lg:hidden" width="100%" height="2">
            <g>
                <line
                    x1="0"
                    y1="0"
                    x2="100%"
                    y2="0"
                    stroke-width="2"
                    stroke="white"
                    in:draw={{ delay: 200, duration: 800, easing: cubicOut }}
                    out:draw={{ duration: 400, easing: cubicIn }}
                />
            </g>
        </svg>

        <div class="flex h-full flex-row">
            <div class="hidden h-full p-4 text-white lg:flex">
                <ul class="flex flex-col gap-2">
                    <li>
                        <button
                            class="w-full rounded border border-slate-500 bg-transparent p-1 px-2 text-slate-300 hover:bg-slate-300 hover:text-slate-900"
                            onclick={() => void requestExit('lock')}
                        >
                            Lock
                        </button>
                    </li>
                    {#if signOutUrl}
                        <li>
                            <a
                                class="block rounded border border-red-600 p-1 px-2 text-center text-red-600 hover:bg-red-600 hover:text-slate-100"
                                href={signOutUrl}
                                onclick={(event) => {
                                    event.preventDefault();
                                    void requestExit('signout');
                                }}
                            >
                                Sign out
                            </a>
                        </li>
                    {/if}
                </ul>
            </div>

            <div
                class="h-full basis-full p-5 lg:basis-7/12 lg:p-10"
                transition:fly={{ x: -50, delay: 200, duration: 800 }}
            >
                <div class="flex h-full flex-col rounded-lg bg-transparent p-3 text-white">
                    <div class="mb-2 flex flex-row p-2">
                        <h1 class="flex flex-1 text-left lowercase">Note - {uuid}</h1>
                        <h2 class="text-right">{savestate}</h2>
                    </div>
                    <hr class="mb-2 hidden lg:inline" />

                    {#if conflict}
                        <p class="m-4 rounded border border-amber-500 p-3 text-amber-300" role="alert">
                            Another tab saved a newer revision. Lock and unlock again to load it;
                            this tab will not overwrite it.
                        </p>
                    {/if}

                    {#if fatalMessage}
                        <p class="m-4 rounded border border-red-500 p-3 text-red-300" role="alert">
                            {fatalMessage} Editing is disabled to prevent an unsafe overwrite.
                        </p>
                    {/if}

                    {#if exitFailed}
                        <div class="m-4 rounded border border-red-500 p-3 text-red-300" role="alert">
                            <p>Unsaved changes could not be stored.</p>
                            <div class="mt-3 flex gap-3">
                                <button
                                    class="rounded border border-slate-400 px-3 py-1"
                                    onclick={() => {
                                        if (pendingExit !== null) void requestExit(pendingExit);
                                    }}>Retry</button
                                >
                                <button
                                    class="rounded border border-red-500 px-3 py-1"
                                    onclick={discardAndExit}>Discard changes and continue</button
                                >
                            </div>
                        </div>
                    {/if}

                    <textarea
                        id="textarea"
                        class="h-full w-full rounded-b-lg bg-transparent p-4 outline-none disabled:text-gray-500"
                        placeholder="Type something…"
                        disabled={conflict || fatalMessage !== '' || pendingExit !== null}
                        bind:value={content}
                        oninput={scheduleSave}
                    ></textarea>
                </div>
            </div>

            <div
                class="hidden h-full basis-5/12 flex-auto p-10 lg:flex"
                transition:fade={{ delay: 300, duration: 400 }}
            >
                <div class="flex h-full flex-1 flex-col rounded-lg bg-neutral-900 p-4">
                    <span class="p-4 text-2xl text-white">console</span>
                    <hr class="mb-2" />
                    <div
                        class="flex h-full min-h-0 flex-auto flex-col overflow-y-auto"
                        use:scrollToNewMessages={$logStore}
                    >
                        {#each $logStore as message, i (i)}
                            <p class="console-message text-lg">{message}</p>
                        {/each}
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}

<style lang="postcss">
    @reference "tailwindcss";

    h1 {
        font-size: 1.5rem;
        font-family: "Josefin Sans";
        word-spacing: 0.1em;
        font-weight: 400;
    }
    h2 {
        font-size: 1rem;
        font-family: "Josefin Sans";
        word-spacing: 0.1em;
        font-weight: 400;
    }
    textarea {
        resize: none;
    }
    .logo-name {
        font-size: 1rem;
        font-family: "Josefin Sans";
        letter-spacing: 0.1em;
        font-weight: 300;
    }
    .console-message {
        color: var(--color-slate-100);
        font:
            1rem "Fira Code",
            monospace;
        padding: 0.5rem 0 0 0;
        overflow-wrap: anywhere;
    }
    .unselectable {
        user-select: none;
    }
</style>
