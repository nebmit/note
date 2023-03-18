<script>
    import { onMount } from "svelte";
    import { fly } from "svelte/transition";
    import { cubicOut, quintInOut } from "svelte/easing";

    import Logo from "./logo.svelte";

    let visible = false;

    let text_delay = 1000;

    let points_stage_0 = { delay: 100, duration: 1400 };
    let points_stage_1 = { delay: 1600 };

    let lines_stage_1 = { delay: 1500, easing: cubicOut };
    let lines_stage_2 = { delay: 2000, duration: 2000, easing: cubicOut };

    onMount(() => {
        visible = true;
        return () => {
            visible = false;
        };
    });
</script>

{#if visible}
    <div class="centered">
        <Logo
            {points_stage_0}
            {points_stage_1}
            {lines_stage_1}
            {lines_stage_2}
            width="400"
        />
    </div>

    <div class="heading">
        {#each "NOTE" as char, i}
            <span
                in:fly={{
                    y: 20,
                    delay: text_delay + i * 150,
                    duration: 2000,
                    easing: quintInOut,
                }}
                style="display: inline-block;">{char}</span
            >
        {/each}
    </div>
{/if}

<link href="/fonts/josefin-sans.css" rel="stylesheet" />

<style>
    .centered {
        position: absolute;
        left: 50%;
        top: 20%;
        transform: translate(-50%, -20%);
    }

    .heading {
        font-size: 54px;
        position: absolute;
        left: 50%;
        top: 10%;
        transform: translate(-50%, 0%);
        font-family: "Josefin Sans";
        color: #ffffff;
        letter-spacing: 0.2em;
        font-weight: 400;
    }

    :global(body) {
        background-color: #111827;
    }
</style>
