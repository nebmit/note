<script lang="ts">
    import type { SsoUser } from '$lib/types';
    import { shortUuid } from './format';
    import Logo from './logo.svelte';

    let {
        action,
        onCancel,
        user,
        signInUrl,
        signOutUrl,
        phase,
        error = '',
        retry = false
    }: {
        action: () => void | Promise<void>;
        onCancel: () => void;
        user: SsoUser | null;
        signInUrl: string | null;
        signOutUrl: string | null;
        phase: 'preparing' | 'locked' | 'unlocking';
        error?: string;
        /** The previous attempt failed recoverably; the button offers another go. */
        retry?: boolean;
    } = $props();

    const pending = $derived(phase === 'preparing' || phase === 'unlocking');
    const pendingLabel = $derived(
        phase === 'preparing' ? 'Preparing your keyring' : 'Waiting for your passkey'
    );
</script>

<div class="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6">
    {#if user === null}
        <!-- 6a — no session. -->
        <div class="flex w-full max-w-[520px] flex-col items-center gap-[34px]">
            <div class="w-[220px] lg:w-[280px]">
                <Logo width="100%" animate />
            </div>

            <div class="flex flex-col items-center gap-3">
                <div
                    class="indent-[.34em] font-extralight text-[34px] leading-none tracking-[.34em] text-ink select-none lg:text-[40px]"
                >
                    note
                </div>
                <p
                    class="m-0 max-w-[400px] text-center text-[17px] leading-[1.6] font-light text-pretty text-muted"
                >
                    One private note, encrypted on your device.
                </p>
            </div>

            <div class="flex w-full flex-col items-center gap-4">
                {#if signInUrl}
                    <a
                        class="flex h-[52px] w-[280px] max-w-full items-center justify-center rounded-full bg-accent text-[16px] leading-none font-medium text-white transition-colors hover:bg-accent-hover"
                        href={signInUrl}
                        data-sveltekit-reload
                    >
                        Sign in
                    </a>
                    <span class="text-[13px] leading-[1.6] font-light text-dim">
                        Your passkey opens it. No password to set.
                    </span>
                {:else}
                    <span class="text-[17px] leading-[1.6] font-light text-muted">
                        Sign-in is currently unavailable.
                    </span>
                {/if}
            </div>
        </div>
    {:else}
        <!-- 6b / 6c desktop, 6i phone. -->
        <div class="flex w-full max-w-[440px] flex-col items-center gap-7 lg:gap-[30px]">
            <div class="w-[130px] lg:w-[150px]">
                <Logo width="100%" animate />
            </div>

            <div class="flex flex-col items-center gap-2.5">
                <div class="text-[24px] leading-[1.3] font-light text-ink lg:text-[26px]">
                    Welcome back
                </div>
                <div
                    class="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5"
                >
                    <span class="size-1.5 rounded-full bg-ok"></span>
                    <span class="font-mono text-[12px] leading-none text-muted">
                        {shortUuid(user.uuid)}
                    </span>
                </div>
            </div>

            <div class="flex w-full flex-col items-center gap-3.5">
                {#if pending}
                    <!-- Not dimmed: the browser's own sheet owns the user's
                         attention, but this page must not look dead either. -->
                    <div
                        class="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl border border-[rgba(206,22,104,.55)] text-[16px] leading-none font-normal text-accent-dim lg:h-[54px] lg:rounded-full"
                    >
                        <span class="size-1.5 animate-blink rounded-full bg-accent-dim"></span>
                        {pendingLabel}
                    </div>
                {:else}
                    <button
                        class="h-[52px] w-full rounded-2xl bg-accent text-[17px] leading-none font-medium text-white transition-colors hover:bg-accent-hover lg:h-[54px] lg:rounded-full"
                        type="button"
                        onclick={() => void action()}
                    >
                        {retry ? 'Try again' : 'Unlock note'}
                    </button>
                {/if}

                <p
                    class="m-0 max-w-[380px] text-center text-[14px] leading-[1.6] font-light text-dim"
                >
                    {#if phase === 'unlocking'}
                        Finish in the prompt your browser opened.
                    {:else}
                        <span class="lg:hidden">Your phone asks every time you open the note.</span>
                        <span class="hidden lg:inline">
                            Your device asks every time you open the note.
                        </span>
                    {/if}
                </p>

                {#if error}
                    <p
                        class="m-0 max-w-[380px] text-center text-[14px] leading-[1.55] font-light text-pretty text-notice"
                        role="alert"
                    >
                        {error}
                    </p>
                {/if}

                {#if phase === 'unlocking'}
                    <button
                        class="flex min-h-[44px] items-center px-4 text-[14px] leading-none font-normal text-muted transition-colors hover:text-ink"
                        type="button"
                        onclick={onCancel}
                    >
                        Cancel
                    </button>
                {:else if signOutUrl}
                    <a
                        class="flex min-h-[44px] items-center px-4 text-[14px] leading-none font-light text-muted transition-colors hover:text-ink"
                        href={signOutUrl}
                        data-sveltekit-reload
                    >
                        Sign out instead
                    </a>
                {/if}
            </div>
        </div>
    {/if}
</div>
