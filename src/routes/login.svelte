<script lang="ts">
    import { getContext, onMount } from "svelte";
    import { quintInOut } from "svelte/easing";
    import { fade, fly } from "svelte/transition";

    import Logo from "./logo.svelte";
    import type { Writable } from "svelte/store";
    import type { User } from "../app";

    export let login: (password: string) => void;

    let loginVisible = false;

    let in_text_delay = 1000;
    let out_text_delay = 0;

    let password = "";

    const userStore = getContext<Writable<User>>("user");
    let user: User;
    userStore.subscribe((value: User) => {
        user = value;
    });

    let ssoURL = import.meta.env.VITE_SSO_URL;
    let loginURL = `${ssoURL}/login`;
    onMount(() => {
        loginURL = `${ssoURL}/login?redirect_uri=${window.location}`;
        loginVisible = true;
    });

    function attemptLogin(password: string): void {
        let abort = false;

        if (abort) return;
        login(password);
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
                <Logo width="30%" accentColor="#EB1C76" />
            </div>

            <div class="flex flex-col mt-20 justify-center items-center">
                {#if user.isAuthenticated}
                    <div
                        class="flex justify-center"
                        in:fade={{
                            delay: in_text_delay + 1000,
                        }}
                        out:fade={{
                            delay: out_text_delay,
                        }}
                    >
                        <span class="text-white">
                            Logged in as <span class="font-bold"
                                >{user.uuid}</span
                            >
                        </span>
                    </div>

                    <input
                        class="border-b border-b-gray-300 bg-slate-400/10 p-2 m-2 outline-none text-white w-80 mb-4"
                        type="password"
                        placeholder="Password"
                        bind:value={password}
                        on:keydown={(event) => {
                            if (event.key === "Enter") attemptLogin(password);
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
                    <button
                        class={`bg-slate-400/10 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded w-40`}
                        type="button"
                        on:click={() => {
                            attemptLogin(password);
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
                        Unlock Note
                    </button>
                {:else}
                    <div
                        class="flex justify-center"
                        in:fade={{
                            delay: in_text_delay + 1000,
                        }}
                        out:fade={{
                            delay: out_text_delay,
                        }}
                    >
                        <span class="text-white text-xl"
                            >Login via <a
                                href={loginURL}
                                class="text-white underline font-bold text-2xl"
                                >SSO</a
                            ></span
                        >
                    </div>
                {/if}
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
