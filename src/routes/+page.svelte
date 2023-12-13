<script lang="ts">
    import Login from "./login.svelte";
    import Note from "./note.svelte";

    import { waitMin } from "../util";
    import { logStore, userStore } from "./store";

    let loading = false;
    let isLoggedIn = false;

    async function login(password: string) {
        loading = true;
        logStore.clear();
        logStore.add(`fetching content and salt`);
        const response = await waitMin(
            fetch("/api", {
                method: "GET",
            }),
            2000,
        );
        if (response.status !== 200) {
            setTimeout(() => {
                loading = false;
            }, 500);
            return;
        }
        const obj = await response.json();
        logStore.add(`completed fetching content and salt`);
        userStore.set({
            password: password,
            salt: obj.salt,
            content: obj.content,
        });
        isLoggedIn = true;

        setTimeout(() => {
            loading = false;
        }, 500);
    }
</script>

<title>Note | TBW</title>

{#if isLoggedIn && !loading}
    <Note
        logout={() => {
            loading = true;
            setTimeout(() => {
                userStore.set(null);
                isLoggedIn = false;
                setTimeout(() => {
                    loading = false;
                }, 500);
            }, 2000);
        }}
    />
{:else if !isLoggedIn && !loading}
    <Login {login} />
{/if}
