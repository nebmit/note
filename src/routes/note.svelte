<script lang="ts">
    import { onMount } from "svelte";
    import { cubicIn, cubicOut } from "svelte/easing";
    import { draw, fade, fly } from "svelte/transition";
    import {
        arrayBufferToBase64,
        arrayBufferToString,
        stringToArrayBuffer,
        wait,
        waitMin,
    } from "../util";

    import { logStore, userStore } from "./store";

    export let logout: () => void;

    let visible = false;
    let content = "";

    let username = "";
    let disabled = true;
    let redactSensitiveContent = true;
    let savestate = "loading...";

    let encryptionKey: CryptoKey | null = null;
    let iv: string | null = null;

    onMount(async () => {
        visible = true;
        const userObj: {
            name: string;
            password: string;
            salt: string;
            content: string;
        } | null = $userStore;

        if (!userObj) {
            logout();
            return;
        }

        username = userObj.name;
        content = userObj.content;

        const encryptedContentWithIv = userObj.content;
        const password = userObj.password;
        const saltString = userObj.salt;

        logStore.add(
            `attempting to derive key from password '${redacted(password)}'`,
        );

        const encoder = new TextEncoder();
        const salt = encoder.encode(saltString);

        const passwordHash = await waitMin(
            crypto.subtle.digest("SHA-256", encoder.encode(password)),
            500,
        );
        logStore.add(
            `hashed password: ${redacted(arrayBufferToString(passwordHash))}`,
        );

        const key: CryptoKey = await waitMin(
            crypto.subtle.importKey(
                "raw",
                passwordHash,
                { name: "PBKDF2" },
                false,
                ["deriveBits"],
            ),
            500,
        );
        logStore.add(`imported hashed password as key`);

        const derivedKey: ArrayBuffer = await waitMin(
            crypto.subtle.deriveBits(
                {
                    name: "PBKDF2",
                    salt,
                    iterations: 10000,
                    hash: { name: "SHA-256" },
                },
                key,
                32 * 8,
            ),
            500,
        );
        logStore.add(
            `derived encryption key using PBKDF2: ${redacted(
                arrayBufferToString(derivedKey),
            )}`,
        );

        encryptionKey = await crypto.subtle.importKey(
            "raw",
            derivedKey,
            { name: "AES-GCM" },
            false,
            ["encrypt", "decrypt"],
        );
        logStore.add(`imported derived key as encryption key`);

        iv = encryptedContentWithIv.slice(0, 16);
        const b64CipherText = encryptedContentWithIv.slice(16);
        await wait(500);
        content = b64CipherText;
        logStore.add(
            `extracted iv '${redacted(
                iv,
            )}' and ciphertext from encrypted content`,
        );

        const ciphertext = atob(b64CipherText);
        await wait(500);
        content = ciphertext;
        logStore.add(`decoded encrypted content from base64`);

        const ivUint8Array = new TextEncoder().encode(iv);
        const ciphertextUint8Array = stringToArrayBuffer(ciphertext);

        if (ciphertextUint8Array.byteLength === 0) {
            savestate = "saved";
            disabled = false;
            logStore.add(`no content to decrypt, waiting for user input...`);
            return;
        }

        try {
            const decryptedContent = await crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: ivUint8Array,
                },
                encryptionKey,
                ciphertextUint8Array,
            );

            const decryptedString = new TextDecoder().decode(decryptedContent);
            await wait(500);
            disabled = false;
            savestate = "saved";
            content = decryptedString;

            logStore.add(`sucessfully decrypted content locally`);
            document.getElementById("textarea")?.focus();
        } catch (e) {
            savestate = "error";
            content =
                "Failed to decrypt content. Are you sure you entered the correct password?";
            logStore.add(`ERROR: failed to decrypt content`);
            logStore.add(`Are you sure you entered the correct password?`);
            return;
        }

        return () => {
            visible = false;
        };
    });

    async function save() {
        savestate = "saving...";
        console.log("saving...");
        if (encryptionKey === null || iv === null) {
            logStore.add(`ERROR: no encryption key available`);
            return;
        }
        const ivUint8Array = new TextEncoder().encode(iv);
        const encrypted = await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: ivUint8Array,
            },
            encryptionKey,
            new TextEncoder().encode(content),
        );
        logStore.add(`sucessfully encrypted content locally`);
        const encryptedString = arrayBufferToBase64(encrypted);
        const encryptedStringWithIV = iv + encryptedString;
        const res = await fetch("/api", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                user: username,
                content: encryptedStringWithIV,
            }),
        });
        if (res.status === 200) {
            savestate = "saved";
            logStore.add(`sucessfully saved encrypted content to server`);
        } else {
            savestate = "error";
            logStore.add(`ERROR: failed to save content to server`);
        }
    }

    function attemptSave() {
        let timer: number | undefined;
        return () => {
            if (timer) clearTimeout(timer);
            savestate = "waiting...";
            timer = setTimeout(save, 1000);
        };
    }

    function attemptLogout() {
        logout();
    }

    function redacted(message: string) {
        return redactSensitiveContent
            ? "***REDACTBEGIN" +
                  message.split("").join("\u200B") +
                  "REDACTEND***"
            : message;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function scrollToNewMessages(node: HTMLDivElement, args: string[]) {
        const scroll = () =>
            node.scroll({
                top: node.scrollHeight,
                behavior: "smooth",
            });
        scroll();

        return { update: scroll };
    }
</script>

{#if visible}
    <div class="h-full flex flex-col flex-auto">
        <nav
            class="lg:hidden flex flex-row justify-between items-center bg-slate-900 p-4"
            transition:fly={{
                y: -10,
                duration: 500,
            }}
        >
            <div class="flex flex-row items-center">
                <img
                    class="h-6 w-6 rounded-full"
                    src="favicon.ico"
                    alt="Logo"
                />
                <span
                    class="text-slate-100 ml-4 uppercase logo-name unselectable"
                >
                    Note
                </span>
            </div>
            <button
                class="text-sm bg-transparent text-red-600 rounded hover:text-red-800"
                on:click={attemptLogout}
            >
                logout
            </button>
        </nav>

        <svg class="lg:hidden" width="100%" height="2">
            <g>
                <line
                    x1="0"
                    y1="0"
                    x2={window.screen.availWidth}
                    y2="0"
                    stroke-width="2"
                    stroke="white"
                    in:draw={{
                        delay: 500,
                        duration: 2000,
                        easing: cubicOut,
                    }}
                    out:draw={{
                        delay: 500,
                        duration: 1000,
                        easing: cubicIn,
                    }}
                />
            </g>
        </svg>

        <div class="flex flex-row h-full">
            <div class="hidden lg:flex h-full text-white p-4">
                <ul>
                    <li class="align-bottom">
                        <button
                            class="bg-transparent text-red-600 rounded border border-red-600 hover:text-slate-100 hover:bg-red-600 p-1 px-2"
                            on:click={attemptLogout}
                        >
                            Logout
                        </button>
                    </li>
                </ul>
            </div>

            <div
                class="basis-full lg:basis-7/12 p-5 lg:p-10 h-full"
                transition:fly={{
                    x: -50,
                    delay: 500,
                    duration: 2000,
                }}
            >
                <div
                    class="flex flex-col bg-transparent text-white rounded-lg h-full p-3"
                >
                    <div class="flex flex-row mb-2 p-2">
                        <h1 class="flex text-left flex-1 lowercase">
                            Note - {username}
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
                        on:keypress={attemptSave()}
                    />
                </div>
            </div>
            <div
                class="hidden lg:flex flex-auto h-full basis-5/12 p-10"
                transition:fade={{
                    delay: 1000,
                    duration: 500,
                }}
            >
                <div
                    class="flex flex-col flex-1 h-full bg-neutral-900 rounded-lg p-4"
                >
                    <div class="flex flex-row justify-end items-center">
                        <span class="grow text-2xl text-white p-4">
                            console
                        </span>
                        <span class="text-white p-4">
                            redact sensitive content
                        </span>
                        <input
                            type="checkbox"
                            bind:checked={redactSensitiveContent}
                        />
                    </div>
                    <hr class="mb-2" />
                    <div
                        class="flex flex-col min-h-0 h-full flex-auto overflow-y-auto"
                        use:scrollToNewMessages={$logStore}
                    >
                        {#each $logStore as message}
                            <p class="text-lg console-message">
                                {redactSensitiveContent
                                    ? message.replaceAll(
                                        /\*\*\*REDACTBEGIN.*REDACTEND\*\*\*/gm,
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
        color: theme(colors.slate.100);
    }
    .console-message {
        color: theme(colors.slate.100);
        font:
            1rem "Fira Code",
            monospace;
        padding: 0.5rem 0 0 0;
        word-wrap: break-all;
        overflow-wrap: break-all;
    }
    .unselectable {
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        -khtml-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
    }
</style>
