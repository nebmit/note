<script lang="ts">
    import Login from "./login.svelte";
    import Note from "./note.svelte";

    import { logStore } from "./store";

    let loading = false;
    let isLoggedIn = false;

    let error: { message: string } | null = null;
</script>

{#if isLoggedIn && !loading}
    <Note
        logout={() => {
            loading = true;
            setTimeout(() => {
                isLoggedIn = false;
                setTimeout(() => {
                    loading = false;
                }, 500);
            }, 2000);
        }}
    />
{:else if !isLoggedIn && !loading}
    <Login
        login={(username, password) => {
            loading = true;
            setTimeout(() => {
                if (username === "admin" && password === "admin") {
                    isLoggedIn = true;
                    error = null;
                    logStore.add("established connection for user 'admin'");
                    setTimeout(() => {
                        loading = false;
                    }, 500);
                } else {
                    error = { message: "Invalid username or password" };
                    setTimeout(() => {
                        loading = false;
                    }, 500);
                }
            }, 2000);
        }}
        {error}
    />
{/if}
