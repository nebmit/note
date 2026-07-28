<script lang="ts">
    import Logo from './logo.svelte';

    let {
        kind,
        detail = '',
        revision = null,
        signInUrl,
        signOutUrl
    }: {
        kind: 'session' | 'credential' | 'unsupported';
        /** The underlying reason, shown verbatim for `unsupported`. */
        detail?: string;
        /** Last revision known to be stored, when the failure happened late enough to know it. */
        revision?: number | null;
        signInUrl: string | null;
        signOutUrl: string | null;
    } = $props();
</script>

<div class="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6">
    <div
        class="flex w-full flex-col items-center gap-6 rounded-3xl border border-line bg-panel p-8 text-center sm:p-10 {kind ===
        'session'
            ? 'max-w-[460px]'
            : 'max-w-[520px]'}"
    >
        {#if kind === 'session'}
            <div class="w-[110px]">
                <!-- Greyed ink, magenta accents retained: dropped, not broken. -->
                <Logo width="100%" stroke="#6F6763" />
            </div>
        {:else}
            <!-- Deliberately not an alarm colour. -->
            <div
                class="flex size-14 items-center justify-center rounded-[18px] border border-line-strong bg-raised text-[24px] leading-none font-light text-notice"
            >
                !
            </div>
        {/if}

        <div class="flex flex-col gap-2.5">
            {#if kind === 'session'}
                <div class="text-[24px] leading-[1.3] font-light text-ink">
                    Locked while you were away
                </div>
                <p class="m-0 text-[15px] leading-[1.65] font-light text-pretty text-muted">
                    Your sign-in lapsed, so the key was dropped.{revision === null
                        ? ''
                        : ` Revision ${revision.toLocaleString()} is still stored.`}
                </p>
            {:else if kind === 'credential'}
                <div class="text-[24px] leading-[1.3] font-light text-ink lg:text-[26px]">
                    This passkey doesn't open this note
                </div>
                <p class="m-0 text-[15px] leading-[1.65] font-light text-pretty text-muted">
                    The note was encrypted for a different passkey on this account. Nothing
                    was changed, and nothing can be read without the original one.
                </p>
            {:else}
                <div class="text-[24px] leading-[1.3] font-light text-ink lg:text-[26px]">
                    This device can't open the note
                </div>
                <p class="m-0 text-[15px] leading-[1.65] font-light text-pretty text-muted">
                    {detail} The note only opens with a WebAuthn passkey that provides PRF —
                    there is deliberately no password fallback.
                </p>
            {/if}
        </div>

        <div class="flex w-full flex-col gap-2.5">
            {#if kind !== 'unsupported' && signInUrl}
                <a
                    class="flex h-12 w-full items-center justify-center rounded-full bg-accent text-[15px] leading-none font-medium text-white transition-colors hover:bg-accent-hover"
                    href={signInUrl}
                    data-sveltekit-reload
                >
                    {kind === 'session' ? 'Sign in again' : 'Sign in with the original passkey'}
                </a>
            {/if}
            {#if kind === 'unsupported' && signOutUrl}
                <a
                    class="flex h-12 w-full items-center justify-center rounded-full border border-line-strong text-[15px] leading-none font-normal text-muted transition-colors hover:border-ghost hover:text-ink"
                    href={signOutUrl}
                    data-sveltekit-reload
                >
                    Sign out
                </a>
            {/if}
        </div>

        <span class="font-mono text-[11px] leading-[1.5] text-faint">
            {#if kind === 'session'}
                key discarded · 0 plaintext in storage
            {:else if kind === 'credential'}
                keyring credential id ≠ session passkey · editing disabled
            {:else}
                webauthn prf unavailable · no fallback permitted
            {/if}
        </span>
    </div>
</div>
