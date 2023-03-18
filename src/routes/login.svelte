<script lang="ts">
    import { onMount } from "svelte";
    import { fly, fade } from "svelte/transition";
    import { quintInOut } from "svelte/easing";

    import Logo from "./logo.svelte";

    export let login: (username: string, password: string) => void;
    export let error: { message: string } | null;

    let loginVisible = false;

    let in_text_delay = 1000;
    let out_text_delay = 0;

    let username = "";
    let password = "";

    let accentColor = error ? "#DC2626" : "#EB1C76";

    onMount(() => {
        loginVisible = true;
        return () => {
            loginVisible = false;
        };
    });

    function attemptLogin(username: string, password: string): void {
        login(username, password);
    }
</script>

<div class="container mx-auto">
    <div class="flex flex-col h-screen justify-center">
        {#if loginVisible}
            <div class="flex justify-center heading unselectable">
                {#each "NOTE" as char, i}
                    <span
                        in:fly={{
                            y: 20,
                            delay: in_text_delay + i * 150,
                            duration: 2000,
                            easing: quintInOut,
                        }}
                        out:fly={{
                            y: -20,
                            delay: out_text_delay + i * 150,
                            duration: 2000,
                            easing: quintInOut,
                        }}
                        style="display: inline-block;">{char}</span
                    >
                {/each}
            </div>

            <div class="flex justify-center">
                <Logo width="30%" {accentColor} />
            </div>

            <div class="flex flex-col mt-20 justify-center items-center">
                <div class="flex flex-col mb-4 justify-center items-center">
                    {#if error}
                        <div
                            class="flex justify-center"
                            in:fade={{
                                delay: in_text_delay + 1000,
                            }}
                            out:fade={{
                                delay: out_text_delay,
                            }}
                        >
                            <span class="text-red-500">{error?.message}</span>
                        </div>
                    {/if}
                    <input
                        class="border-b border-b-gray-300 bg-slate-400/10 p-2 m-2 outline-none text-white w-80"
                        type="text"
                        placeholder="Username"
                        bind:value={username}
                        on:keydown={(event) => {
                            if (event.key === "Enter")
                                attemptLogin(username, password);
                        }}
                        in:fly={{
                            x: -20,
                            delay: in_text_delay,
                            duration: 2000,
                            easing: quintInOut,
                        }}
                        out:fly={{
                            x: 20,
                            delay: out_text_delay,
                            duration: 2000,
                            easing: quintInOut,
                        }}
                    />
                    <input
                        class="border-b border-b-gray-300 bg-slate-400/10 p-2 m-2 outline-none text-white w-80"
                        type="password"
                        placeholder="Password"
                        bind:value={password}
                        on:keydown={(event) => {
                            if (event.key === "Enter")
                                attemptLogin(username, password);
                        }}
                        in:fly={{
                            x: -20,
                            delay: in_text_delay + 150,
                            duration: 2000,
                            easing: quintInOut,
                        }}
                        out:fly={{
                            x: 20,
                            delay: out_text_delay + 150,
                            duration: 2000,
                            easing: quintInOut,
                        }}
                    />
                </div>
                <button
                    class="bg-slate-400/10 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded w-40"
                    type="button"
                    on:click={() => {
                        attemptLogin(username, password);
                    }}
                    in:fly={{
                        x: -20,
                        delay: in_text_delay + 300,
                        duration: 2000,
                        easing: quintInOut,
                    }}
                    out:fly={{
                        x: 20,
                        delay: out_text_delay + 300,
                        duration: 2000,
                        easing: quintInOut,
                    }}
                >
                    Sign In
                </button>
            </div>
        {/if}
    </div>
</div>

<style lang="postcss">
    .heading {
        font-size: 54px;
        font-family: "Josefin Sans";
        color: theme(colors.gray.100);
        letter-spacing: 0.2em;
        font-weight: 200;
    }

    .unselectable {
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        -khtml-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
    }
</style>
