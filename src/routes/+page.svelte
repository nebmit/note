<script lang="ts">
    import { onMount } from "svelte";
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
        wrapDek,
    } from "$lib/crypto";
    import type { KeyringMetadata, NoteApiState } from "$lib/types";
    import Login from "./login.svelte";
    import Note from "./note.svelte";
    import Notice from "./notice.svelte";
    import { logStore } from "./store";
    import type { PageData } from "./$types";

    type LockedState = Exclude<NoteApiState, { state: "absent" }>;
    type Phase =
        | "preparing"
        | "locked"
        | "unlocking"
        | "ready"
        | "unsupported"
        | "error";

    interface Failure {
        kind: "session" | "credential" | "unsupported" | "generic" | "canceled";
        message: string;
    }

    interface UnlockedNote {
        dek: CryptoKey;
        metadata: KeyringMetadata;
        content: string;
        revision: number;
    }

    let { data }: { data: PageData } = $props();

    let phase = $state<Phase>("preparing");
    let failure = $state<Failure | null>(null);
    let prepared = $state<LockedState | null>(null);
    let unlocked = $state<UnlockedNote | null>(null);

    let ceremony: AbortController | null = null;

    const loginPhase = $derived(
        phase === "preparing" || phase === "unlocking" ? phase : "locked",
    );
    const storedRevision = $derived(
        prepared !== null && prepared.state === "ready"
            ? prepared.note.revision
            : null,
    );

    function elapsed(start: number): string {
        return `${Math.round(performance.now() - start).toLocaleString()} ms`;
    }

    async function readJson<T>(response: Response): Promise<T> {
        const body = await response.json().catch(() => null);
        if (!response.ok) {
            const code =
                typeof body?.error === "string"
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
        failure = null;
        unlocked = null;
        prepared = null;

        if (data.user === null) {
            phase = "locked";
            return;
        }
        if (data.user.passkey === null) {
            phase = "unsupported";
            failure = {
                kind: "unsupported",
                message: "This SSO account does not have exactly one passkey.",
            };
            return;
        }
        if (!webauthnSupported()) {
            phase = "unsupported";
            failure = {
                kind: "unsupported",
                message: "This browser does not support WebAuthn.",
            };
            return;
        }

        phase = "preparing";
        logStore.clear();
        logStore.add("fetching encrypted note metadata");
        try {
            const response = await fetch("/api/note", {
                headers: { accept: "application/json" },
            });
            let state = await readJson<NoteApiState>(response);
            if (state.state === "absent") {
                logStore.add("reserving random, public key-derivation inputs");
                const setup = createSetupInputs();
                state = await readJson<NoteApiState>(
                    await fetch("/api/note/reserve", {
                        method: "POST",
                        headers: {
                            accept: "application/json",
                            "content-type": "application/json",
                        },
                        body: JSON.stringify(setup),
                    }),
                );
            }
            if (state.state === "absent")
                throw new Error("keyring_reservation_failed");
            verifyCredential(state);
            prepared = state;
            phase = "locked";
            logStore.add(
                "encrypted note metadata ready; waiting for passkey verification",
            );
        } catch (error) {
            if (error instanceof CredentialMismatchError) {
                phase = "error";
                failure = { kind: "credential", message: error.message };
                logStore.add(
                    "ERROR: SSO credential does not match the encrypted keyring",
                );
                return;
            }
            console.error("note preparation failed", error);
            phase = "error";
            failure =
                error instanceof Error && error.message === "unauthorized"
                    ? { kind: "session", message: "Your SSO session expired." }
                    : {
                          kind: "generic",
                          message: "Could not prepare the encrypted note.",
                      };
        }
    }

    async function unlock(): Promise<void> {
        const user = data.user;
        const state = prepared;
        if (
            user?.passkey === null ||
            user === null ||
            state === null ||
            phase === "unlocking"
        ) {
            return;
        }

        phase = "unlocking";
        failure = null;
        logStore.add("requesting user-verified WebAuthn PRF output");

        try {
            const ceremonyStarted = performance.now();
            ceremony = new AbortController();
            // Keep this as the first awaited operation: browsers receive the
            // WebAuthn request directly from the button's user gesture.
            const prfOutput = await runPrfCeremony(
                user.passkey,
                state.keyring.prfInput,
                ceremony.signal,
            );
            logStore.add(
                `passkey verification completed in ${elapsed(ceremonyStarted)}`,
            );

            const derivationStarted = performance.now();
            let kek: CryptoKey;
            try {
                kek = await deriveKek(prfOutput, state.keyring, user.uuid);
            } finally {
                prfOutput.fill(0);
            }
            logStore.add(
                `derived non-extractable AES-256-GCM key-encryption key with HKDF-SHA256 in ${elapsed(derivationStarted)}`,
            );

            let authoritative: NoteApiState;
            if (state.state === "pending") {
                logStore.add(
                    "generating and wrapping a random AES-256-GCM note key",
                );
                const freshDek = await generateDek();
                const wrappedDek = await wrapDek(
                    freshDek,
                    kek,
                    state.keyring,
                    user.uuid,
                );
                // Immediately move normal use to a non-extractable handle.
                const workingDek = await unwrapDek(
                    wrappedDek,
                    kek,
                    state.keyring,
                    user.uuid,
                );
                const ciphertext = await encryptNote(
                    "",
                    workingDek,
                    state.keyring,
                    user.uuid,
                    1,
                );
                authoritative = await readJson<NoteApiState>(
                    await fetch("/api/note/initialize", {
                        method: "POST",
                        headers: {
                            accept: "application/json",
                            "content-type": "application/json",
                        },
                        body: JSON.stringify({ wrappedDek, ciphertext }),
                    }),
                );
            } else {
                authoritative = state;
            }

            if (authoritative.state !== "ready") {
                throw new Error("keyring_initialization_failed");
            }
            verifyCredential(authoritative);

            const decryptStarted = performance.now();
            const dek = await unwrapDek(
                authoritative.keyring.wrappedDek,
                kek,
                authoritative.keyring,
                user.uuid,
            );
            const content = await decryptNote(
                authoritative.note.ciphertext,
                dek,
                authoritative.keyring,
                user.uuid,
                authoritative.note.revision,
            );
            logStore.add(
                `authenticated and decrypted note locally in ${elapsed(decryptStarted)}`,
            );

            prepared = authoritative;
            unlocked = {
                dek,
                metadata: authoritative.keyring,
                content,
                revision: authoritative.note.revision,
            };
            phase = "ready";
        } catch (error) {
            if (
                error instanceof DOMException &&
                (error.name === "NotAllowedError" ||
                    error.name === "AbortError")
            ) {
                phase = "locked";
                failure = {
                    kind: "canceled",
                    message: "Passkey verification was canceled.",
                };
                logStore.add("passkey verification canceled");
                return;
            }
            if (
                error instanceof PrfUnavailableError ||
                error instanceof WebAuthnUnavailableError
            ) {
                phase = "unsupported";
                failure = {
                    kind: "unsupported",
                    message:
                        "This passkey and browser combination does not provide WebAuthn PRF.",
                };
                logStore.add(
                    "ERROR: WebAuthn PRF unavailable; no fallback is permitted",
                );
                return;
            }
            if (error instanceof CredentialMismatchError) {
                phase = "error";
                failure = { kind: "credential", message: error.message };
                logStore.add(
                    "ERROR: SSO credential does not match the encrypted keyring",
                );
                return;
            }
            if (error instanceof Error && error.message === "unauthorized") {
                phase = "error";
                failure = {
                    kind: "session",
                    message: "Your SSO session expired.",
                };
                logStore.add("ERROR: SSO session expired during unlock");
                return;
            }
            console.error("note unlock failed", error);
            phase = "error";
            failure = {
                kind: "generic",
                message:
                    error instanceof DOMException &&
                    error.name === "OperationError"
                        ? "The encrypted note or wrapped key failed authentication."
                        : "Could not unlock the encrypted note.",
            };
            logStore.add("ERROR: note unlock failed closed");
        } finally {
            ceremony = null;
        }
    }

    /** Dismisses the browser's passkey sheet; `unlock()` lands on AbortError. */
    function cancelUnlock(): void {
        ceremony?.abort();
    }

    function lock(): void {
        unlocked = null;
        phase = "locked";
        failure = null;
        logStore.add("discarded plaintext and in-memory key handles");
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

{#if phase === "ready" && unlocked !== null && data.user !== null}
    <Note
        uuid={data.user.uuid}
        signOutUrl={data.signOutUrl}
        initialContent={unlocked.content}
        initialRevision={unlocked.revision}
        metadata={unlocked.metadata}
        dek={unlocked.dek}
        onLock={lock}
    />
{:else if failure !== null && (failure.kind === "session" || failure.kind === "credential" || failure.kind === "unsupported")}
    <Notice
        kind={failure.kind}
        detail={failure.message}
        revision={storedRevision}
        signInUrl={data.signInUrl}
        signOutUrl={data.signOutUrl}
    />
{:else}
    <Login
        user={data.user}
        signInUrl={data.signInUrl}
        signOutUrl={data.signOutUrl}
        phase={loginPhase}
        error={failure?.message ?? ""}
        retry={failure?.kind === "generic"}
        action={prepared === null ? prepare : unlock}
        onCancel={cancelUnlock}
    />
{/if}
