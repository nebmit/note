<script lang="ts">
    import { onMount } from 'svelte';
    import {
        CredentialMismatchError,
        PrfUnavailableError,
        WebAuthnUnavailableError,
        createSetupInputs,
        decryptNote,
        deriveKek,
        encryptNote,
        generateDek,
        runPrfCeremony,
        unwrapDek,
        webauthnSupported,
        wrapDek
    } from '$lib/crypto';
    import type {
        KeyringMetadata,
        NoteApiState
    } from '$lib/types';
    import Login from './login.svelte';
    import Note from './note.svelte';
    import { logStore } from './store';
    import type { PageData } from './$types';

    type LockedState = Exclude<NoteApiState, { state: 'absent' }>;
    type Phase = 'preparing' | 'locked' | 'unlocking' | 'ready' | 'unsupported' | 'error';

    interface UnlockedNote {
        dek: CryptoKey;
        metadata: KeyringMetadata;
        content: string;
        revision: number;
    }

    let { data }: { data: PageData } = $props();

    let phase = $state<Phase>('preparing');
    let errorMessage = $state('');
    let prepared = $state<LockedState | null>(null);
    let unlocked = $state<UnlockedNote | null>(null);

    function elapsed(start: number): string {
        return `${Math.round(performance.now() - start).toLocaleString()} ms`;
    }

    async function readJson<T>(response: Response): Promise<T> {
        const body = await response.json().catch(() => null);
        if (!response.ok) {
            const code =
                typeof body?.error === 'string'
                    ? body.error
                    : `request_failed_${response.status}`;
            throw new Error(code);
        }
        return body as T;
    }

    function verifyCredential(state: LockedState): void {
        if (
            data.user?.passkey === null ||
            data.user === null ||
            state.keyring.credentialId !== data.user.passkey.credentialId
        ) {
            throw new CredentialMismatchError();
        }
    }

    async function prepare(): Promise<void> {
        errorMessage = '';
        unlocked = null;
        prepared = null;

        if (data.user === null) {
            phase = 'locked';
            return;
        }
        if (data.user.passkey === null) {
            phase = 'unsupported';
            errorMessage = 'This SSO account does not have exactly one passkey.';
            return;
        }
        if (!webauthnSupported()) {
            phase = 'unsupported';
            errorMessage = 'This browser does not support WebAuthn.';
            return;
        }

        phase = 'preparing';
        logStore.clear();
        logStore.add('fetching encrypted note metadata');
        try {
            const response = await fetch('/api/note', {
                headers: { accept: 'application/json' }
            });
            let state = await readJson<NoteApiState>(response);
            if (state.state === 'absent') {
                logStore.add('reserving random, public key-derivation inputs');
                const setup = createSetupInputs();
                state = await readJson<NoteApiState>(
                    await fetch('/api/note/reserve', {
                        method: 'POST',
                        headers: {
                            accept: 'application/json',
                            'content-type': 'application/json'
                        },
                        body: JSON.stringify(setup)
                    })
                );
            }
            if (state.state === 'absent') throw new Error('keyring_reservation_failed');
            verifyCredential(state);
            prepared = state;
            phase = 'locked';
            logStore.add('encrypted note metadata ready; waiting for passkey verification');
        } catch (error) {
            console.error('note preparation failed', error);
            phase = 'error';
            errorMessage =
                error instanceof Error && error.message === 'unauthorized'
                    ? 'Your SSO session expired. Sign in again.'
                    : 'Could not prepare the encrypted note.';
        }
    }

    async function unlock(): Promise<void> {
        const user = data.user;
        const state = prepared;
        if (user?.passkey === null || user === null || state === null || phase === 'unlocking') {
            return;
        }

        phase = 'unlocking';
        errorMessage = '';
        logStore.add('requesting user-verified WebAuthn PRF output');

        try {
            const ceremonyStarted = performance.now();
            // Keep this as the first awaited operation: browsers receive the
            // WebAuthn request directly from the button's user gesture.
            const prfOutput = await runPrfCeremony(user.passkey, state.keyring.prfInput);
            logStore.add(`passkey verification completed in ${elapsed(ceremonyStarted)}`);

            const derivationStarted = performance.now();
            let kek: CryptoKey;
            try {
                kek = await deriveKek(prfOutput, state.keyring, user.uuid);
            } finally {
                prfOutput.fill(0);
            }
            logStore.add(
                `derived non-extractable AES-256-GCM key-encryption key with HKDF-SHA256 in ${elapsed(derivationStarted)}`
            );

            let authoritative: NoteApiState;
            if (state.state === 'pending') {
                logStore.add('generating and wrapping a random AES-256-GCM note key');
                const freshDek = await generateDek();
                const wrappedDek = await wrapDek(freshDek, kek, state.keyring, user.uuid);
                // Immediately move normal use to a non-extractable handle.
                const workingDek = await unwrapDek(wrappedDek, kek, state.keyring, user.uuid);
                const ciphertext = await encryptNote('', workingDek, state.keyring, user.uuid, 1);
                authoritative = await readJson<NoteApiState>(
                    await fetch('/api/note/initialize', {
                        method: 'POST',
                        headers: {
                            accept: 'application/json',
                            'content-type': 'application/json'
                        },
                        body: JSON.stringify({ wrappedDek, ciphertext })
                    })
                );
            } else {
                authoritative = state;
            }

            if (authoritative.state !== 'ready') {
                throw new Error('keyring_initialization_failed');
            }
            verifyCredential(authoritative);

            const decryptStarted = performance.now();
            const dek = await unwrapDek(
                authoritative.keyring.wrappedDek,
                kek,
                authoritative.keyring,
                user.uuid
            );
            const content = await decryptNote(
                authoritative.note.ciphertext,
                dek,
                authoritative.keyring,
                user.uuid,
                authoritative.note.revision
            );
            logStore.add(
                `authenticated and decrypted note locally in ${elapsed(decryptStarted)}`
            );

            prepared = authoritative;
            unlocked = {
                dek,
                metadata: authoritative.keyring,
                content,
                revision: authoritative.note.revision
            };
            phase = 'ready';
        } catch (error) {
            if (error instanceof DOMException && error.name === 'NotAllowedError') {
                phase = 'locked';
                errorMessage = 'Passkey verification was canceled.';
                logStore.add('passkey verification canceled');
                return;
            }
            if (
                error instanceof PrfUnavailableError ||
                error instanceof WebAuthnUnavailableError
            ) {
                phase = 'unsupported';
                errorMessage =
                    'This passkey/browser combination does not provide WebAuthn PRF.';
                logStore.add('ERROR: WebAuthn PRF unavailable; no fallback is permitted');
                return;
            }
            if (error instanceof CredentialMismatchError) {
                phase = 'error';
                errorMessage = error.message;
                logStore.add('ERROR: SSO credential does not match the encrypted keyring');
                return;
            }
            console.error('note unlock failed', error);
            phase = 'error';
            errorMessage =
                error instanceof DOMException && error.name === 'OperationError'
                    ? 'The encrypted note or wrapped key failed authentication.'
                    : 'Could not unlock the encrypted note.';
            logStore.add('ERROR: note unlock failed closed');
        }
    }

    function lock(): void {
        unlocked = null;
        phase = 'locked';
        errorMessage = '';
        logStore.add('discarded plaintext and in-memory key handles');
    }

    onMount(() => {
        void prepare();
        return () => {
            unlocked = null;
        };
    });
</script>

<svelte:head>
    <title>Note | TBW</title>
</svelte:head>

{#if phase === 'ready' && unlocked !== null && data.user !== null}
    <Note
        uuid={data.user.uuid}
        signOutUrl={data.signOutUrl}
        initialContent={unlocked.content}
        initialRevision={unlocked.revision}
        metadata={unlocked.metadata}
        dek={unlocked.dek}
        onLock={lock}
    />
{:else}
    <Login
        user={data.user}
        signInUrl={data.signInUrl}
        {phase}
        error={errorMessage}
        action={prepared === null ? prepare : unlock}
    />
{/if}
