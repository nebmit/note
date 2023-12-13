<script lang="ts">
    import { writable } from "svelte/store";
    import "../app.css";
    import { setContext } from "svelte";
    import type { LayoutData } from "./$types";

    export let data: LayoutData;

    const user = writable({});
    $: user.set(data.user || { isAuthenticated: false });

    setContext("user", user);
</script>

<slot />

<style lang="postcss">
    :global(html) {
        background-color: theme(colors.gray.900);
    }
</style>
