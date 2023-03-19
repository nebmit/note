<script lang="ts">
    import Login from "./login.svelte";
    import Note from "./note.svelte";

    import { waitMin } from "../util";
    import { logStore, userStore } from "./store";

    let loading = false;
    let isLoggedIn = false;

    let error: { message: string } | null = null;
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
    <Login
        login={async (username, password) => {
            loading = true;
            logStore.clear();
            logStore.add(`fetching content and salt for user '${username}'`);
            const response = await waitMin(
                fetch("/api?user=" + username, {
                    method: "GET",
                }),
                2000
            );
            if (response.status !== 200) {
                error = { message: "User not found" };
                setTimeout(() => {
                    loading = false;
                }, 500);
                return;
            }
            const obj = await response.json();
            logStore.add(
                `completed fetching content and salt for user '${username}'`
            );
            userStore.set({
                name: username,
                password: password,
                salt: obj.salt,
                content: obj.content,
            });
            isLoggedIn = true;

            setTimeout(() => {
                loading = false;
            }, 500);
        }}
        {error}
    />
{/if}
