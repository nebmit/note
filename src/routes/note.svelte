<script lang="ts">
    import { onMount } from "svelte";
    import { cubicIn, cubicOut } from "svelte/easing";
    import { draw, fade, fly } from "svelte/transition";

    import { logStore } from "./store";

    export let logout: () => void;

    let visible = false;

    onMount(() => {
        visible = true;
        return () => {
            visible = false;
        };
    });

    function attemptLogout() {
        logout();
    }
</script>

{#if visible}
    <div class="h-screen flex flex-col">
        <nav
            class="flex flex-row justify-between items-center bg-slate-900 p-4"
            transition:fly={{
                y: -20,
                duration: 500,
            }}
        >
            <div class="flex flex-row items-center">
                <img
                    class="h-10 w-10 rounded-full"
                    src="favicon.png"
                    alt="Logo"
                />
                <span
                    class="text-2xl text-slate-100 ml-4 uppercase logo-name unselectable"
                >
                    Note
                </span>
            </div>
            <button
                class="bg-transparent text-red-600 rounded border border-red-600 hover:text-slate-100 hover:bg-red-600 p-1 px-2"
                on:click={attemptLogout}
            >
                logout
            </button>
        </nav>
        <svg width="100%" height="2">
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
                        duration: 2000,
                        easing: cubicIn,
                    }}
                />
            </g>
        </svg>

        <div class="flex flex-row flex-1">
            <div
                class="hidden lg:inline basis-5/12 p-10 h-full"
                transition:fly={{
                    x: -100,
                    delay: 500,
                    duration: 2000,
                }}
            >
                <div class="flex flex-col bg-neutral-900 rounded-lg h-full p-4">
                    <span class="text-2xl text-white mb-2 p-2"> console </span>
                    <hr class="mb-2" />
                    {#each $logStore as message}
                        <span class="text-lg console-message lowercase">
                            {message}
                        </span>
                    {/each}
                </div>
            </div>
            <div
                class="basis-full lg:basis-7/12 p-5 lg:p-10 h-full"
                transition:fade={{
                    delay: 1000,
                    duration: 500,
                }}
            >
                <div
                    class="flex flex-col bg-transparent text-white rounded-lg h-full p-3"
                >
                    <div class="flex flex-row mb-2 p-2">
                        <h1 class="flex text-left flex-1 lowercase">
                            Note - [username]
                        </h1>
                        <h2 class="text-right">saved</h2>
                    </div>
                    <hr class="hidden lg:inline mb-2" />
                    <textarea
                        class="bg-transparent h-full w-full p-4 rounded-b-lg outline-none"
                        placeholder="Type something..."
                    />
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
        font-size: 1.5rem;
        font-family: "Josefin Sans";
        letter-spacing: 0.2em;
        font-weight: 200;
        color: theme(colors.slate.100);
    }
    .console-message {
        color: theme(colors.slate.100);
        font: 1rem "Fira Code", monospace;
        padding: 0.5rem 0 0 0;
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
