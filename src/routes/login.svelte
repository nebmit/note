<script lang="ts">
    import { onMount } from 'svelte';
    import { quintInOut } from 'svelte/easing';
    import { fade, fly } from 'svelte/transition';
    import type { SsoUser } from '$lib/types';
    import Logo from './logo.svelte';

    let {
        action,
        user,
        signInUrl,
        phase,
        error = ''
    }: {
        action: () => void | Promise<void>;
        user: SsoUser | null;
        signInUrl: string | null;
        phase: 'preparing' | 'locked' | 'unlocking' | 'ready' | 'unsupported' | 'error';
        error?: string;
    } = $props();

    let visible = $state(false);

    const textDelay = 250;

    const actionLabel = $derived(
        phase === 'preparing'
            ? 'Preparing secure storage…'
            : phase === 'unlocking'
              ? 'Waiting for passkey…'
              : phase === 'error'
                ? 'Try again'
                : 'Unlock with passkey'
    );

    onMount(() => {
        visible = true;
    });
</script>

<div class="container mx-auto">
    <div class="flex min-h-[100dvh] flex-col justify-center">
        {#if visible}
            <div class="heading unselectable flex justify-center">
                {#each 'NOTE' as char, i (i)}
                    <span
                        class="inline-block"
                        in:fly={{
                            y: 20,
                            delay: textDelay + i * 100,
                            duration: 900,
                            easing: quintInOut
                        }}>{char}</span
                    >
                {/each}
            </div>

            <div class="flex justify-center">
                <Logo width="30%" accentColor="#EB1C76" />
            </div>

            <div class="mt-12 flex flex-col items-center justify-center gap-4">
                {#if user}
                    <div class="flex justify-center" in:fade={{ delay: textDelay }}>
                        <span class="text-white">
                            Signed in as <span class="font-bold">{user.uuid}</span>
                        </span>
                    </div>

                    {#if phase !== 'unsupported'}
                        <button
                            class="w-56 rounded bg-slate-400/10 px-4 py-2 font-bold text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60"
                            type="button"
                            disabled={phase === 'preparing' || phase === 'unlocking'}
                            onclick={() => void action()}
                        >
                            {actionLabel}
                        </button>
                    {/if}

                    <p class="max-w-md text-center text-sm text-slate-400">
                        A fresh passkey verification is required after every reload and lock.
                        There is no password or recovery fallback.
                    </p>

                    {#if error}
                        <p class="max-w-md text-center text-red-400" role="alert" transition:fade>
                            {error}
                        </p>
                    {/if}
                {:else}
                    <div class="flex justify-center" in:fade={{ delay: textDelay }}>
                        {#if signInUrl}
                            <span class="text-xl text-white"
                                >Sign in via
                                <a
                                    href={signInUrl}
                                    class="text-2xl font-bold text-white underline"
                                    data-sveltekit-reload>SSO passkey</a
                                ></span
                            >
                        {:else}
                            <span class="text-xl text-white">
                                Sign-in is currently unavailable.
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
        user-select: none;
    }
</style>
