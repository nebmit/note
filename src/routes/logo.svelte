<script lang="ts">
    import { cubicOut, cubicIn } from "svelte/easing";
    import { draw, fade } from "svelte/transition";

    export let width = "400";
    export let stroke = "#ffffff";
    export let accentColor = "#EB1C76";

    let points_stage_0 = { delay: 100, duration: 1400 };
    let reverse_points_stage_2 = { delay: 2000 };

    let points_stage_1 = { delay: 1600 };
    let reverse_points_stage_1 = { delay: 1000 };

    let lines_stage_1 = { delay: 1500, easing: cubicOut };
    let reverse_lines_stage_1 = { delay: 1000, easing: cubicIn };

    let lines_stage_2 = { delay: 2000, duration: 2000, easing: cubicOut };
    let reverse_lines_stage_0 = { delay: 100, duration: 1000, easing: cubicIn };
</script>

<svg {stroke} {width} viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
    <g>
        <!-- Left Top -->
        <line
            in:draw={lines_stage_2}
            out:draw={reverse_lines_stage_0}
            stroke={accentColor}
            stroke-linecap="round"
            stroke-width="26"
            y1="112.5"
            x1="292.5"
            y2="200"
            x2="100"
            fill="none"
        />
        <!-- Left Bottom -->
        <line
            in:draw={lines_stage_1}
            out:draw={reverse_lines_stage_1}
            stroke-linecap="round"
            stroke-width="26"
            y1="400"
            x1="360"
            y2="245"
            x2="100"
            fill="none"
        />
        <!-- Middle -->
        <line
            in:draw={lines_stage_1}
            out:draw={reverse_lines_stage_1}
            stroke-linecap="round"
            stroke-width="26"
            y1="380"
            x1="395"
            y2="135"
            x2="340"
            fill="none"
        />
        <!-- Right Top -->
        <line
            in:draw={lines_stage_1}
            out:draw={reverse_lines_stage_1}
            stroke-linecap="round"
            stroke-width="26"
            y1="405"
            x1="440"
            y2="340"
            x2="625"
            fill="none"
        />
        <!-- Right Middle -->
        <line
            in:draw={lines_stage_2}
            out:draw={reverse_lines_stage_0}
            stroke={accentColor}
            stroke-linecap="round"
            stroke-width="26"
            y1="485"
            x1="605"
            y2="370"
            x2="655"
            fill="none"
        />
        <!-- Right Bottom -->
        <line
            in:draw={lines_stage_1}
            out:draw={reverse_lines_stage_1}
            stroke-linecap="round"
            stroke-width="26"
            y1="440"
            x1="440"
            y2="505"
            x2="555"
            fill="none"
        />

        <!-- Left Top Mirror -->
        <line
            in:draw={lines_stage_2}
            out:draw={reverse_lines_stage_0}
            stroke={accentColor}
            stroke-linecap="round"
            stroke-width="26"
            y2="112.5"
            x2="292.5"
            y1="200"
            x1="100"
            fill="none"
        />
        <!-- Right Middle Mirror -->
        <line
            in:draw={lines_stage_2}
            out:draw={reverse_lines_stage_0}
            stroke={accentColor}
            stroke-linecap="round"
            stroke-width="26"
            y2="485"
            x2="605"
            y1="370"
            x1="655"
            fill="none"
        />

        <!-- Left Top -->
        <ellipse
            in:fade={points_stage_1}
            out:fade={reverse_points_stage_1}
            ry="7"
            rx="7"
            cy="100"
            cx="330"
            stroke-width="14"
            fill="none"
        />
        <!-- Left Bottom -->
        <ellipse
            in:fade={points_stage_1}
            out:fade={reverse_points_stage_1}
            stroke={accentColor}
            ry="7"
            rx="7"
            cy="220"
            cx="65"
            stroke-width="14"
            fill="none"
        />
        <!-- Middle -->
        <ellipse
            in:fade={points_stage_0}
            out:fade={reverse_points_stage_2}
            stroke={accentColor}
            ry="7"
            rx="7"
            cy="420"
            cx="400"
            stroke-width="14"
            fill="none"
        />
        <!-- Right Top -->
        <ellipse
            in:fade={points_stage_1}
            out:fade={reverse_points_stage_1}
            ry="7"
            rx="7"
            cy="330"
            cx="670"
            stroke-width="14"
            fill="none"
        />
        <!-- Right Bottom -->
        <ellipse
            in:fade={points_stage_1}
            out:fade={reverse_points_stage_1}
            ry="7"
            rx="7"
            cy="520"
            cx="590"
            stroke-width="14"
            fill="none"
        />
    </g>
</svg>
