<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { encryptNote, noteAadText } from '$lib/crypto';
    import type { AesGcmEnvelope, KeyringMetadata } from '$lib/types';
    import { abbreviate, ago, base64urlBytes, byteCount, shortUuid } from './format';
    import Logo from './logo.svelte';
    import { createNowTicker } from './now.svelte';
    import { isExpectedSaveRevision } from './noteState';
    import SecurityLog from './securitylog.svelte';
    import { fact, logStore, masked } from './store';

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

    type SaveState =
        | 'editing'
        | 'saving'
        | 'saved'
        | 'exiting'
        | 'conflict'
        | 'offline'
        | 'credential-mismatch'
        | 'session-expired'
        | 'error';

    /** Blocks editing and cannot be resolved from this tab. */
    interface Fatal {
        title: string;
        body: string;
    }

    interface PendingSaveAttempt {
        snapshot: string;
        baseRevision: number;
        ciphertext: AesGcmEnvelope;
    }

    // svelte-ignore state_referenced_locally
    let content = $state(initialContent);
    // svelte-ignore state_referenced_locally
    let revision = $state(initialRevision);
    let savestate = $state<SaveState>('saved');
    let dirty = $state(false);
    let conflict = $state(false);
    let fatal = $state<Fatal | null>(null);
    let pendingExit = $state<'lock' | 'signout' | null>(null);
    let exitFailed = $state(false);
    let logOpen = $state(false);
    let lastSavedAt = $state<number | null>(null);
    let savedTicks = $state(0);
    let copied = $state<'ok' | 'failed' | null>(null);
    const now = createNowTicker();

    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let slowSaveTimer: ReturnType<typeof setTimeout> | undefined;
    let activeSave: Promise<boolean> | null = null;
    let pendingSaveAttempt: PendingSaveAttempt | null = null;

    // svelte-ignore state_referenced_locally
    const startedEmpty = initialRevision <= 1 && initialContent === '';
    const isNewNote = $derived(startedEmpty && lastSavedAt === null && content === '');
    const blocked = $derived(conflict || fatal !== null);

    const status = $derived.by((): { label: string; dot: string; pulse: boolean } => {
        if (isNewNote && savestate === 'saved') {
            return { label: 'New note', dot: 'bg-ghost', pulse: false };
        }
        switch (savestate) {
            case 'editing':
                return { label: 'Editing', dot: 'bg-ghost', pulse: false };
            case 'saving':
                return { label: 'Saving…', dot: 'bg-muted', pulse: true };
            case 'saved':
                return { label: 'Saved', dot: 'bg-ok', pulse: false };
            case 'exiting':
                return {
                    label: dirty ? 'Securing changes…' : 'Locking…',
                    dot: 'bg-muted',
                    pulse: true
                };
            case 'conflict':
                return { label: 'Newer version elsewhere', dot: 'bg-muted', pulse: false };
            case 'offline':
                return { label: "Can't reach the server", dot: 'bg-muted', pulse: false };
            case 'credential-mismatch':
                return { label: "This passkey doesn't fit", dot: 'bg-muted', pulse: false };
            case 'session-expired':
                return { label: 'Signed out elsewhere', dot: 'bg-muted', pulse: false };
            case 'error':
                return { label: "Couldn't save", dot: 'bg-muted', pulse: false };
        }
    });

    /** The states that earn a chip instead of a bare dot and label. */
    const attention = $derived(
        savestate === 'conflict' ||
            savestate === 'offline' ||
            savestate === 'credential-mismatch' ||
            savestate === 'session-expired' ||
            savestate === 'error'
    );

    const exitReason = $derived.by(() => {
        switch (savestate) {
            case 'offline':
                return "The server couldn't be reached.";
            case 'conflict':
                return "Another tab saved a newer version, so this one wasn't stored.";
            case 'session-expired':
                return 'Your sign-in lapsed before the save went through.';
            case 'credential-mismatch':
                return 'This passkey no longer matches the stored note.';
            default:
                return "The last save didn't go through.";
        }
    });

    onMount(() => {
        document.getElementById('textarea')?.focus();
    });

    onDestroy(() => {
        if (saveTimer) clearTimeout(saveTimer);
        if (slowSaveTimer) clearTimeout(slowSaveTimer);
    });

    /** "Saving…" only earns the screen once a save is visibly slow. */
    function markSlowSave(): void {
        if (slowSaveTimer) clearTimeout(slowSaveTimer);
        slowSaveTimer = setTimeout(() => {
            slowSaveTimer = undefined;
            if (savestate === 'editing') savestate = 'saving';
        }, 400);
    }

    function clearSlowSave(): void {
        if (slowSaveTimer) clearTimeout(slowSaveTimer);
        slowSaveTimer = undefined;
    }

    async function saveSnapshot(): Promise<boolean> {
        if (
            pendingSaveAttempt !== null &&
            pendingSaveAttempt.baseRevision !== revision
        ) {
            pendingSaveAttempt = null;
        }
        const retry = pendingSaveAttempt;
        const snapshot = retry?.snapshot ?? content;
        const baseRevision = retry?.baseRevision ?? revision;
        const nextRevision = baseRevision + 1;
        markSlowSave();

        let ciphertext: AesGcmEnvelope;
        if (retry !== null) {
            ciphertext = retry.ciphertext;
            logStore.add(`retrying encrypted revision ${nextRevision.toLocaleString()}`, {
                details: [
                    fact('plaintext', `${snapshot.length.toLocaleString()} chars`),
                    masked('iv', ciphertext.iv),
                    masked('ct', abbreviate(ciphertext.ct))
                ]
            });
        } else {
            const started = performance.now();
            try {
                // The revision is inside the note AAD, so this must be encrypted
                // with the revision it will be stored under, not the one it was read at.
                ciphertext = await encryptNote(
                    snapshot,
                    dek,
                    metadata,
                    uuid,
                    nextRevision
                );
                logStore.add(
                    `encrypted revision ${nextRevision.toLocaleString()} locally`,
                    {
                        durationMs: performance.now() - started,
                        details: [
                            fact('plaintext', `${snapshot.length.toLocaleString()} chars`),
                            fact('ciphertext', byteCount(base64urlBytes(ciphertext.ct))),
                            masked('iv', ciphertext.iv),
                            masked('ct', abbreviate(ciphertext.ct)),
                            masked('aad', noteAadText(uuid, metadata, nextRevision))
                        ]
                    }
                );
            } catch (error) {
                console.error('note encryption failed', error);
                clearSlowSave();
                savestate = 'error';
                logStore.add('local note encryption failed', {
                    level: 'error',
                    details: [
                        fact('cause', error instanceof Error ? error.message : 'unknown')
                    ]
                });
                return false;
            }
            pendingSaveAttempt = { snapshot, baseRevision, ciphertext };
        }

        const sentAt = performance.now();
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
            clearSlowSave();

            if (response.status === 409 && body?.error === 'conflict') {
                pendingSaveAttempt = null;
                conflict = true;
                savestate = 'conflict';
                // Server-supplied and unvalidated: keep it out of the message.
                const winning = Number(body.current?.revision);
                logStore.add('revision conflict; refusing to overwrite', {
                    level: 'error',
                    durationMs: performance.now() - sentAt,
                    details: [
                        fact('sent', nextRevision.toLocaleString()),
                        fact(
                            'stored',
                            Number.isSafeInteger(winning)
                                ? winning.toLocaleString()
                                : 'unknown'
                        )
                    ]
                });
                return false;
            }
            if (response.status === 409 && body?.error === 'credential_mismatch') {
                pendingSaveAttempt = null;
                savestate = 'credential-mismatch';
                fatal = {
                    title: "This passkey no longer opens this note",
                    body: 'The SSO passkey stopped matching the encrypted keyring, so editing is disabled to prevent an unsafe overwrite. Copy anything you need before signing out.'
                };
                logStore.add('SSO credential no longer matches the keyring', {
                    level: 'error',
                    details: [masked('credential id', metadata.credentialId)]
                });
                return false;
            }
            const storedRevision = body?.revision;
            if (!response.ok || !isExpectedSaveRevision(storedRevision, nextRevision)) {
                if (!response.ok && response.status < 500) {
                    pendingSaveAttempt = null;
                }
                if (response.status === 401) {
                    savestate = 'session-expired';
                    fatal = {
                        title: 'Your sign-in lapsed',
                        body: 'The note could not be saved because the SSO session expired. Your text is still here — copy anything you want to keep, then sign in again.'
                    };
                    logStore.add('SSO session expired before save', { level: 'error' });
                } else {
                    savestate = 'error';
                    logStore.add('encrypted save failed', {
                        level: 'error',
                        durationMs: performance.now() - sentAt,
                        details: [
                            fact('status', String(response.status)),
                            fact(
                                'code',
                                typeof body?.error === 'string'
                                    ? abbreviate(body.error)
                                    : 'none'
                            )
                        ]
                    });
                }
                return false;
            }

            pendingSaveAttempt = null;
            revision = storedRevision;
            lastSavedAt = Date.now();
            savedTicks += 1;
            dirty = content !== snapshot;
            savestate = dirty ? 'editing' : 'saved';
            logStore.add('stored the envelope', {
                durationMs: performance.now() - sentAt,
                details: [
                    fact(
                        'revision',
                        `${baseRevision.toLocaleString()} → ${revision.toLocaleString()}`
                    )
                ]
            });
            return true;
        } catch (error) {
            console.error('note save failed', error);
            clearSlowSave();
            savestate = 'offline';
            logStore.add('could not reach the server', {
                level: 'error',
                durationMs: performance.now() - sentAt,
                details: [fact('cause', error instanceof Error ? error.message : 'unknown')]
            });
            return false;
        }
    }

    async function flush(): Promise<boolean> {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = undefined;
        }
        while (dirty && !blocked) {
            const running = activeSave ?? saveSnapshot();
            activeSave = running;
            const ok = await running;
            if (activeSave === running) activeSave = null;
            if (!ok) return false;
        }
        return !dirty && !blocked;
    }

    function scheduleSave(): void {
        if (pendingExit !== null || blocked) return;
        dirty = true;
        savestate = 'editing';
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
        const previous = savestate;
        pendingExit = kind;
        exitFailed = false;
        savestate = 'exiting';
        if (await flush()) {
            completeExit(kind);
            return;
        }
        // flush() can refuse without attempting a save when the note is already
        // blocked; restore the reason so the sheet explains the real one.
        if (savestate === 'exiting') savestate = previous;
        exitFailed = true;
    }

    function discardAndExit(): void {
        const kind = pendingExit;
        if (kind === null) return;
        completeExit(kind);
    }

    /** The escape hatch: stay in the note instead of choosing between exits. */
    function keepWriting(): void {
        pendingExit = null;
        exitFailed = false;
        if (dirty && !blocked) scheduleSave();
    }

    async function copyMyVersion(): Promise<void> {
        try {
            await navigator.clipboard.writeText(content);
            copied = 'ok';
        } catch {
            // Non-secure context or a denied permission; the text below is
            // selectable, so say so rather than failing silently.
            copied = 'failed';
        }
    }

    /** Drops the plaintext and key handles; the next unlock loads the winner. */
    function reopenWithNewer(): void {
        content = '';
        onLock();
    }
</script>

<div class="flex h-full min-h-dvh flex-auto flex-col bg-canvas">
    <header
        class="flex h-14 flex-none items-center justify-between px-[18px] lg:h-[66px] lg:border-b lg:border-hairline lg:px-[26px]"
    >
        <div class="flex items-center gap-[11px] lg:gap-3.5">
            <div class="w-[22px] lg:w-[26px]">
                <Logo width="100%" variant="mark" strokeWidth={44} />
            </div>
            <span
                class="indent-[.24em] text-[14px] leading-none font-light tracking-[.24em] text-ink select-none lg:text-[15px]"
            >
                note
            </span>
            <span class="hidden h-[18px] w-px bg-line lg:block"></span>
            <span class="hidden font-mono text-[12px] leading-none text-dim lg:inline">
                {shortUuid(uuid)}
            </span>
        </div>

        <div class="flex items-center gap-3.5 lg:gap-3">
            {#if attention}
                <div
                    class="flex items-center gap-2 rounded-full border border-line-strong bg-raised py-[7px] pr-3.5 pl-3"
                >
                    <span class="size-1.5 flex-none rounded-full bg-muted"></span>
                    <span class="text-[13px] leading-none text-ink">{status.label}</span>
                </div>
            {:else}
                <div class="flex items-center gap-2">
                    {#key savedTicks}
                        <span class="relative flex size-1.5 items-center justify-center">
                            {#if savestate === 'saved' && !isNewNote}
                                <!-- One ring per stored revision. It never loops. -->
                                <span
                                    class="absolute size-1.5 animate-ring rounded-full border border-ok"
                                ></span>
                            {/if}
                            <span
                                class="size-1.5 rounded-full {status.dot}"
                                class:animate-blink-fast={status.pulse}
                            ></span>
                        </span>
                    {/key}
                    <span class="text-[13px] leading-none font-light text-muted lg:text-[14px]">
                        {status.label}
                    </span>
                </div>
            {/if}

            <span class="h-[15px] w-px bg-line lg:h-4"></span>

            <button
                class="-my-[15px] flex min-h-11 items-center px-1.5 text-[13px] leading-none font-normal text-ink transition-colors hover:text-accent-link lg:my-0 lg:min-h-0 lg:px-0 lg:text-[14px]"
                type="button"
                onclick={() => void requestExit('lock')}
            >
                Lock
            </button>
            {#if signOutUrl}
                <a
                    class="-my-[15px] -mr-1.5 flex min-h-11 items-center px-1.5 text-[13px] leading-none font-normal text-dim transition-colors hover:text-ink lg:mr-0 lg:my-0 lg:min-h-0 lg:px-0 lg:text-[14px]"
                    href={signOutUrl}
                    onclick={(event) => {
                        event.preventDefault();
                        void requestExit('signout');
                    }}
                >
                    Sign out
                </a>
            {/if}
        </div>
    </header>

    <div class="flex min-h-0 flex-1 justify-center overflow-hidden">
        <div
            class="flex w-full max-w-[780px] flex-col px-5 pt-2 lg:px-10 {blocked
                ? 'lg:pt-10 lg:pb-6'
                : 'lg:pt-16 lg:pb-10'}"
        >
            {#if conflict}
                <!-- 6f — another tab won the revision race. -->
                <div
                    class="mb-[26px] flex items-start gap-4 rounded-[18px] border border-line-strong bg-panel px-[22px] py-5"
                >
                    <span class="mt-[9px] size-[7px] flex-none rounded-full bg-muted"></span>
                    <div class="flex flex-1 flex-col gap-2.5">
                        <span class="text-[17px] leading-[1.4] text-ink">
                            Another tab saved a newer version of this note
                        </span>
                        <span class="text-[15px] leading-[1.6] font-light text-pretty text-muted">
                            Your edits here are held in this tab and haven't been stored. Reopening
                            loads the newer version — copy anything you want to keep first.
                        </span>
                        <div class="mt-1.5 flex flex-wrap gap-3">
                            <button
                                class="h-11 rounded-full bg-accent px-[22px] text-[15px] leading-none font-medium text-white transition-colors hover:bg-accent-hover"
                                type="button"
                                onclick={() => void copyMyVersion()}
                            >
                                {copied === 'ok' ? 'Copied' : 'Copy my version'}
                            </button>
                            <button
                                class="h-11 rounded-full border border-line-strong px-[22px] text-[15px] leading-none font-normal text-muted transition-colors hover:border-ghost hover:text-ink"
                                type="button"
                                onclick={reopenWithNewer}
                            >
                                Discard mine and open newer
                            </button>
                        </div>
                        {#if copied === 'failed'}
                            <span class="text-[13px] leading-[1.5] font-light text-notice">
                                Couldn't reach the clipboard — select the text below and copy it
                                by hand.
                            </span>
                        {/if}
                    </div>
                </div>
            {:else if fatal !== null}
                <div
                    class="mb-[26px] flex items-start gap-4 rounded-[18px] border border-line-strong bg-panel px-[22px] py-5"
                    role="alert"
                >
                    <span class="mt-[9px] size-[7px] flex-none rounded-full bg-muted"></span>
                    <div class="flex flex-1 flex-col gap-2.5">
                        <span class="text-[17px] leading-[1.4] text-ink">{fatal.title}</span>
                        <span class="text-[15px] leading-[1.6] font-light text-pretty text-muted">
                            {fatal.body}
                        </span>
                    </div>
                </div>
            {/if}

            <textarea
                id="textarea"
                class="min-h-0 w-full flex-1 resize-none bg-transparent text-[17px] leading-[1.8] font-light outline-none placeholder:text-faint lg:text-[18px] lg:leading-[1.85] {blocked
                    ? 'text-faint'
                    : 'text-ink'}"
                placeholder="Start typing. It encrypts as you go."
                readonly={blocked || pendingExit !== null}
                bind:value={content}
                oninput={scheduleSave}
            ></textarea>

            {#if isNewNote && !blocked}
                <!-- 6k — the one thing worth saying before the first save. -->
                <div
                    class="mt-auto mb-3.5 flex flex-col gap-1.5 rounded-[18px] border border-line bg-panel px-[18px] py-4 lg:mb-0"
                >
                    <span
                        class="font-mono text-[11px] leading-none tracking-[.14em] text-mark uppercase"
                    >
                        how it opens
                    </span>
                    <span class="text-[14px] leading-[1.6] font-light text-pretty text-muted">
                        This note is tied to the passkey you just used. Keep that passkey and you
                        keep the note.
                    </span>
                </div>
            {/if}
        </div>
    </div>

    <SecurityLog
        bind:open={logOpen}
        dot={status.dot}
        pulse={status.pulse}
        placeholder={isNewNote ? 'waiting for your first save' : null}
    />
</div>

{#if exitFailed}
    <!-- 6l — the exit is blocked; nothing here is destructive by default. -->
    <div class="fixed inset-0 z-30 flex flex-col justify-end lg:items-center lg:justify-center">
        <div class="absolute inset-0 bg-[rgba(12,10,9,.72)]"></div>
        <div
            class="relative flex w-full flex-col gap-[18px] rounded-t-3xl border-t border-line bg-panel px-[22px] py-[26px] pb-[max(26px,env(safe-area-inset-bottom))] lg:max-w-[460px] lg:rounded-3xl lg:border lg:pb-[26px]"
            role="alertdialog"
            aria-modal="true"
            aria-label="Your last changes didn't save"
        >
            <div class="h-1 w-9 self-center rounded-full bg-line-strong lg:hidden"></div>

            <div class="flex flex-col gap-2">
                <span class="text-[19px] leading-[1.35] text-ink">
                    Your last changes didn't save
                </span>
                <span class="text-[15px] leading-[1.6] font-light text-pretty text-muted">
                    {exitReason}
                    {pendingExit === 'signout' ? 'Signing out' : 'Locking'} now would drop
                    everything typed since the last save.
                </span>
            </div>

            <div
                class="flex items-center gap-2.5 rounded-[14px] border border-line-strong bg-raised px-3.5 py-3"
            >
                <span class="size-1.5 flex-none rounded-full bg-muted"></span>
                <span class="font-mono text-[12px] leading-[1.5] text-muted">
                    {#if lastSavedAt === null}
                        nothing stored from this session yet
                    {:else}
                        last stored revision {revision.toLocaleString()} · {ago(lastSavedAt, now.value)}
                    {/if}
                </span>
            </div>

            <div class="flex flex-col gap-2.5">
                <button
                    class="h-[50px] rounded-2xl bg-accent text-[16px] leading-none font-medium text-white transition-colors hover:bg-accent-hover"
                    type="button"
                    onclick={() => {
                        if (pendingExit !== null) void requestExit(pendingExit);
                    }}
                >
                    Try saving again
                </button>
                <button
                    class="h-[50px] rounded-2xl border border-line-strong text-[16px] leading-none font-normal text-muted transition-colors hover:border-ghost hover:text-ink"
                    type="button"
                    onclick={keepWriting}
                >
                    Keep writing
                </button>
                <button
                    class="h-[50px] text-[15px] leading-none font-normal text-dim transition-colors hover:text-ink"
                    type="button"
                    onclick={discardAndExit}
                >
                    {pendingExit === 'signout'
                        ? 'Discard them and sign out'
                        : 'Discard them and lock'}
                </button>
            </div>
        </div>
    </div>
{/if}
