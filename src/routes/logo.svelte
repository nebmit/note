<script lang="ts">
    let {
        width = "400",
        stroke = "#F6F2EF",
        accentColor = "#EB1C76",
        variant = "full",
        strokeWidth,
        animate = false,
    }: {
        width?: string;
        /** Ink for the four plain strokes and the three plain nodes. */
        stroke?: string;
        accentColor?: string;
        /** `mark` drops the five nodes so the constellation survives at 22–26px. */
        variant?: "full" | "mark";
        strokeWidth?: number;
        animate?: boolean;
    } = $props();

    const lineWidth = $derived(strokeWidth ?? (variant === "mark" ? 40 : 26));
    const drawn = $derived(animate && variant === "full");
    // Only meaningful while drawing: each magenta stroke is rendered twice with
    // its endpoints swapped so the pair draws in from both ends at once.
    const dash = $derived(drawn ? 620 : undefined);
</script>

<svg
    {stroke}
    {width}
    viewBox="0 0 800 600"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
>
    <g fill="none" stroke-width={lineWidth} stroke-linecap="round" class:anim={drawn}>
        {#if variant === "full"}
            <!-- Middle — the centre node lands alone, ahead of everything else. -->
            <ellipse
                class="node-centre"
                stroke={accentColor}
                ry="7"
                rx="7"
                cy="420"
                cx="400"
                stroke-width="14"
            />
        {/if}

        <!-- Left Bottom -->
        <line
            class="line-plain"
            y1="400"
            x1="360"
            y2="245"
            x2="100"
            pathLength={dash}
            stroke-dasharray={dash}
        />
        <!-- Middle -->
        <line
            class="line-plain"
            y1="380"
            x1="395"
            y2="135"
            x2="340"
            pathLength={dash}
            stroke-dasharray={dash}
        />
        <!-- Right Top -->
        <line
            class="line-plain"
            y1="405"
            x1="440"
            y2="340"
            x2="625"
            pathLength={dash}
            stroke-dasharray={dash}
        />
        <!-- Right Bottom -->
        <line
            class="line-plain"
            y1="440"
            x1="440"
            y2="505"
            x2="555"
            pathLength={dash}
            stroke-dasharray={dash}
        />

        {#if variant === "full"}
            <!-- Left Top -->
            <ellipse
                class="node-outer"
                ry="7"
                rx="7"
                cy="100"
                cx="330"
                stroke-width="14"
            />
            <!-- Left Bottom -->
            <ellipse
                class="node-outer"
                stroke={accentColor}
                ry="7"
                rx="7"
                cy="220"
                cx="65"
                stroke-width="14"
            />
            <!-- Right Top -->
            <ellipse
                class="node-outer"
                ry="7"
                rx="7"
                cy="330"
                cx="670"
                stroke-width="14"
            />
            <!-- Right Bottom -->
            <ellipse
                class="node-outer"
                ry="7"
                rx="7"
                cy="520"
                cx="590"
                stroke-width="14"
            />
        {/if}

        <!-- Left Top -->
        <line
            class="line-accent"
            stroke={accentColor}
            y1="112.5"
            x1="292.5"
            y2="200"
            x2="100"
            pathLength={dash}
            stroke-dasharray={dash}
        />
        <!-- Right Middle -->
        <line
            class="line-accent"
            stroke={accentColor}
            y1="485"
            x1="605"
            y2="370"
            x2="655"
            pathLength={dash}
            stroke-dasharray={dash}
        />

        {#if drawn}
            <!-- Left Top, mirrored -->
            <line
                class="line-accent"
                stroke={accentColor}
                y2="112.5"
                x2="292.5"
                y1="200"
                x1="100"
                pathLength={dash}
                stroke-dasharray={dash}
            />
            <!-- Right Middle, mirrored -->
            <line
                class="line-accent"
                stroke={accentColor}
                y2="485"
                x2="605"
                y1="370"
                x1="655"
                pathLength={dash}
                stroke-dasharray={dash}
            />
        {/if}
    </g>
</svg>

<style>
    /* Entry sequence, 1040ms end to end, in the original staging order:
       centre node, plain lines, remaining nodes, magenta pair. Keyframes are
       global (app.css); prefers-reduced-motion collapses all of it there. */
    .anim .node-centre {
        animation: noteFade 420ms 0ms ease-out both;
    }

    .anim .line-plain {
        animation: noteDraw 400ms 360ms cubic-bezier(0.33, 1, 0.68, 1) both;
    }

    .anim .node-outer {
        animation: noteFade 260ms 520ms ease-out both;
    }

    .anim .line-accent {
        animation: noteDraw 440ms 600ms cubic-bezier(0.33, 1, 0.68, 1) both;
    }
</style>
