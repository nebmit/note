<script lang="ts">
    import { onMount } from "svelte";
    import { cubicIn, cubicOut } from "svelte/easing";
    import { draw, fade, fly } from "svelte/transition";

    import {
        KDF_ITERATIONS,
        deriveKeyBits,
        decrypt,
        encrypt,
        fromBase64,
        importKey,
        parseEnvelope,
        randomSalt,
        toHex,
    } from "$lib/crypto";
    import { wait, waitMin } from "../util";
    import { logStore, noteStore } from "./store";

    let {
        uuid,
        signOutUrl,
        logout,
    }: {
        uuid: string;
        signOutUrl: string | null;
        logout: () => void;
    } = $props();

    let visible = $state(false);
    let content = $state("");
    let disabled = $state(true);
    let redactSensitiveContent = $state(true);
    let savestate = $state("loading...");

    let encryptionKey: CryptoKey | null = null;
    let salt: Uint8Array | null = null;

    /** Single debounce timer for the component — not one per render. */
    let saveTimer: ReturnType<typeof setTimeout> | undefined;

    onMount(async () => {
        visible = true;

        const note = $noteStore;
        if (!note) {
            logout();
            return;
        }

        const envelope = parseEnvelope(note.stored);

        // No envelope means a note that has never been saved: any password is
        // accepted, and this first save mints the salt.
        salt = envelope ? fromBase64(envelope.salt) : randomSalt();
        const iterations = envelope?.iter ?? KDF_ITERATIONS;

        logStore.add(
            `deriving key from password '${redacted(note.password)}' using PBKDF2-SHA256, ${iterations.toLocaleString()} iterations`,
        );

        const bits = await waitMin(deriveKeyBits(note.password, salt, iterations), 500);
        logStore.add(`derived encryption key: ${redacted(toHex(new Uint8Array(bits)))}`);

        encryptionKey = await importKey(bits);
        logStore.add(`imported derived key as AES-GCM encryption key`);

        if (!envelope) {
            await wait(500);
            savestate = "saved";
            disabled = false;
            logStore.add(`no stored content, waiting for user input...`);
            return;
        }

        logStore.add(`read iv '${redacted(envelope.iv)}' from stored envelope`);
        await wait(500);

        try {
            content = await decrypt(envelope, encryptionKey);
            await wait(500);
            disabled = false;
            savestate = "saved";
            logStore.add(`successfully decrypted content locally`);
            document.getElementById("textarea")?.focus();
        } catch (e) {
            savestate = "error";
            content =
                "Failed to decrypt content. Are you sure you entered the correct password?";
            logStore.add(`ERROR: failed to decrypt content`);
            logStore.add(`Are you sure you entered the correct password?`);
            console.error(e);
        }
    });

    async function save() {
        if (encryptionKey === null || salt === null) {
            logStore.add(`ERROR: no encryption key available`);
            return;
        }

        savestate = "saving...";
        // A fresh IV is generated inside encrypt() on every call.
        const envelope = await encrypt(content, encryptionKey, salt);
        logStore.add(`successfully encrypted content locally with a fresh iv`);

        try {
            const res = await fetch("/api", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: envelope }),
            });

            if (res.ok) {
                savestate = "saved";
                logStore.add(`successfully saved encrypted content to server`);
            } else {
                savestate = "error";
                logStore.add(
                    res.status === 401
                        ? `ERROR: session expired, sign in again`
                        : `ERROR: failed to save content to server`,
                );
            }
        } catch {
            savestate = "error";
            logStore.add(`ERROR: could not reach the server`);
        }
    }

    /** Debounced save. Bound to `oninput`, which — unlike `keypress` — fires for
     *  Backspace, Delete, cut and paste. */
    function scheduleSave() {
        if (saveTimer) clearTimeout(saveTimer);
        savestate = "waiting...";
        saveTimer = setTimeout(save, 1000);
    }

    function redacted(message: string) {
        return redactSensitiveContent
            ? "***REDACTBEGIN" + message.split("").join("​") + "REDACTEND***"
            : message;
    }

    function scrollToNewMessages(node: HTMLDivElement, _args: string[]) {
        const scroll = () => node.scroll({ top: node.scrollHeight, behavior: "smooth" });
        scroll();
        return { update: scroll };
    }
</script>

{#if visible}
    <div class="h-full flex flex-col flex-auto">
        <nav
            class="lg:hidden flex flex-row justify-between items-center bg-slate-900 p-4"
            transition:fly={{ y: -10, duration: 500 }}
        >
            <div class="flex flex-row items-center">
                <img class="h-6 w-6 rounded-full" src="favicon.ico" alt="Logo" />
                <span class="text-slate-100 ml-4 uppercase logo-name unselectable">
                    Note
                </span>
            </div>
            <div class="flex flex-row gap-4">
                <button
                    class="text-sm bg-transparent text-slate-300 rounded hover:text-white"
                    onclick={logout}
                >
                    lock
                </button>
                {#if signOutUrl}
                    <a
                        class="text-sm bg-transparent text-red-600 rounded hover:text-red-800"
                        href={signOutUrl}
                        data-sveltekit-reload
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
                    in:draw={{ delay: 500, duration: 2000, easing: cubicOut }}
                    out:draw={{ delay: 500, duration: 1000, easing: cubicIn }}
                />
            </g>
        </svg>

        <div class="flex flex-row h-full">
            <div class="hidden lg:flex h-full text-white p-4">
                <ul class="flex flex-col gap-2">
                    <li>
                        <button
                            class="bg-transparent text-slate-300 rounded border border-slate-500 hover:text-slate-900 hover:bg-slate-300 p-1 px-2 w-full"
                            onclick={logout}
                        >
                            Lock
                        </button>
                    </li>
                    {#if signOutUrl}
                        <li>
                            <a
                                class="block text-center bg-transparent text-red-600 rounded border border-red-600 hover:text-slate-100 hover:bg-red-600 p-1 px-2"
                                href={signOutUrl}
                                data-sveltekit-reload
                            >
                                Sign out
                            </a>
                        </li>
                    {/if}
                </ul>
            </div>

            <div
                class="basis-full lg:basis-7/12 p-5 lg:p-10 h-full"
                transition:fly={{ x: -50, delay: 500, duration: 2000 }}
            >
                <div class="flex flex-col bg-transparent text-white rounded-lg h-full p-3">
                    <div class="flex flex-row mb-2 p-2">
                        <h1 class="flex text-left flex-1 lowercase">
                            Note - {uuid}
                        </h1>
                        <h2 class="text-right">{savestate}</h2>
                    </div>
                    <hr class="hidden lg:inline mb-2" />
                    <textarea
                        id="textarea"
                        class="bg-transparent h-full w-full p-4 rounded-b-lg outline-none {disabled
                            ? 'text-gray-500'
                            : 'text-white'}"
                        placeholder="Type something..."
                        {disabled}
                        bind:value={content}
                        oninput={scheduleSave}
                    ></textarea>
                </div>
            </div>
            <div
                class="hidden lg:flex flex-auto h-full basis-5/12 p-10"
                transition:fade={{ delay: 1000, duration: 500 }}
            >
                <div class="flex flex-col flex-1 h-full bg-neutral-900 rounded-lg p-4">
                    <div class="flex flex-row justify-end items-center">
                        <span class="grow text-2xl text-white p-4"> console </span>
                        <span class="text-white p-4"> redact sensitive content </span>
                        <input type="checkbox" bind:checked={redactSensitiveContent} />
                    </div>
                    <hr class="mb-2" />
                    <div
                        class="flex flex-col min-h-0 h-full flex-auto overflow-y-auto"
                        use:scrollToNewMessages={$logStore}
                    >
                        {#each $logStore as message, i (i)}
                            <p class="text-lg console-message">
                                {redactSensitiveContent
                                    ? message.replaceAll(
                                          /\*\*\*REDACTBEGIN.*?REDACTEND\*\*\*/gm,
                                          "[REDACTED]",
                                      )
                                    : message
                                          .replaceAll(/\*\*\*REDACTBEGIN/gm, "")
                                          .replaceAll(/REDACTEND\*\*\*/gm, "")}
                            </p>
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
        color: var(--color-slate-100);
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
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
    }
</style>
