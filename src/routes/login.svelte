<script lang="ts">
    import { onMount } from "svelte";
    import { quintInOut } from "svelte/easing";
    import { fade, fly } from "svelte/transition";

    import Logo from "./logo.svelte";
    import type { SsoUser } from "$lib/server/auth";

    let {
        login,
        user,
        signInUrl,
        error = "",
    }: {
        login: (password: string) => void;
        user: SsoUser | null;
        signInUrl: string | null;
        error?: string;
    } = $props();

    let loginVisible = $state(false);
    let password = $state("");

    const in_text_delay = 1000;
    const out_text_delay = 0;

    onMount(() => {
        loginVisible = true;
    });
</script>

<div class="container mx-auto">
    <div class="flex flex-col h-[calc(100dvh)] justify-center">
        {#if loginVisible}
            <div class="flex justify-center heading unselectable">
                {#each "NOTE" as char, i (i)}
                    <span
                        in:fly={{
                            y: 20,
                            delay: in_text_delay + i * 150,
                            duration: 2000,
                            easing: quintInOut,
                        }}
                        out:fly={{
                            y: -20,
                            delay: out_text_delay + i * 150,
                            duration: 2000,
                            easing: quintInOut,
                        }}
                        style="display: inline-block;">{char}</span
                    >
                {/each}
            </div>

            <div class="flex justify-center">
                <Logo width="30%" accentColor="#EB1C76" />
            </div>

            <div class="flex flex-col mt-20 justify-center items-center">
                {#if user}
                    <div
                        class="flex justify-center"
                        in:fade={{ delay: in_text_delay + 1000 }}
                        out:fade={{ delay: out_text_delay }}
                    >
                        <span class="text-white">
                            Logged in as <span class="font-bold">{user.uuid}</span>
                        </span>
                    </div>

                    <input
                        class="border-b border-b-gray-300 bg-slate-400/10 p-2 m-2 outline-none text-white w-80 mb-4"
                        type="password"
                        placeholder="Password"
                        bind:value={password}
                        onkeydown={(event) => {
                            if (event.key === "Enter") login(password);
                        }}
                        in:fly={{
                            x: -20,
                            delay: in_text_delay + 150,
                            duration: 2000,
                            easing: quintInOut,
                        }}
                        out:fly={{
                            x: 20,
                            delay: out_text_delay + 150,
                            duration: 2000,
                            easing: quintInOut,
                        }}
                    />
                    <button
                        class="bg-slate-400/10 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded w-40"
                        type="button"
                        onclick={() => login(password)}
                        in:fly={{
                            x: -20,
                            delay: in_text_delay + 300,
                            duration: 2000,
                            easing: quintInOut,
                        }}
                        out:fly={{
                            x: 20,
                            delay: out_text_delay + 300,
                            duration: 2000,
                            easing: quintInOut,
                        }}
                    >
                        Unlock Note
                    </button>
                    {#if error}
                        <p class="text-red-500 mt-2" transition:fade>{error}</p>
                    {/if}
                {:else}
                    <div
                        class="flex justify-center"
                        in:fade={{ delay: in_text_delay + 1000 }}
                        out:fade={{ delay: out_text_delay }}
                    >
                        {#if signInUrl}
                            <span class="text-white text-xl"
                                >Login via <a
                                    href={signInUrl}
                                    class="text-white underline font-bold text-2xl">SSO</a
                                ></span
                            >
                        {:else}
                            <span class="text-white text-xl">
                                Sign-in is unavailable — AUTH_ORIGIN is not configured.
                            </span>
                        {/if}
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>

<style lang="postcss">
    @reference "tailwindcss";

    .heading {
        font-size: 54px;
        font-family: "Josefin Sans";
        color: var(--color-gray-100);
        letter-spacing: 0.2em;
        font-weight: 200;
    }

    .unselectable {
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
    }
</style>
