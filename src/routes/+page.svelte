<script lang="ts">
    import Login from "./login.svelte";
    import Note from "./note.svelte";

    import { waitMin } from "../util";
    import { logStore, noteStore } from "./store";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    let loading = $state(false);
    let isLoggedIn = $state(false);
    let loginError = $state("");

    async function login(password: string) {
        loading = true;
        loginError = "";
        logStore.clear();
        logStore.add(`fetching stored note`);

        let response: Response;
        try {
            response = await waitMin(fetch("/api", { method: "GET" }), 2000);
        } catch {
            loginError = "Could not reach the server.";
            loading = false;
            return;
        }

        if (!response.ok) {
            // 401 means the SSO session lapsed while the page was open.
            loginError =
                response.status === 401
                    ? "Your session expired. Sign in again."
                    : "Could not load your note.";
            loading = false;
            return;
        }

        const { content } = await response.json();
        logStore.add(`fetched stored note`);
        noteStore.set({ password, stored: content ?? "" });
        isLoggedIn = true;

        setTimeout(() => {
            loading = false;
        }, 500);
    }

    function logout() {
        loading = true;
        setTimeout(() => {
            noteStore.set(null);
            isLoggedIn = false;
            setTimeout(() => {
                loading = false;
            }, 500);
        }, 2000);
    }
</script>

<svelte:head>
    <title>Note | TBW</title>
</svelte:head>

{#if isLoggedIn && !loading}
    <Note uuid={data.user?.uuid ?? ""} signOutUrl={data.signOutUrl} {logout} />
{:else if !isLoggedIn && !loading}
    <Login {login} user={data.user} signInUrl={data.signInUrl} error={loginError} />
{/if}
