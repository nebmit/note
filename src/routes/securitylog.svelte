<script lang="ts">
    import { get } from 'svelte/store';
    import { ago, clockTime, duration } from './format';
    import { createNowTicker } from './now.svelte';
    import { logStore, type LogDetail, type LogEntry } from './store';

    let {
        open = $bindable(false),
        dot = 'bg-muted',
        pulse = false,
        placeholder = null
    }: {
        open?: boolean;
        /** Tailwind background class for the status dot, mirroring the save state. */
        dot?: string;
        pulse?: boolean;
        /** Replaces the latest-line ticker, e.g. before the first save. */
        placeholder?: string | null;
    } = $props();

    const DWELL_MS = 900;
    /** Shortened once a burst queues up, so the ticker never lags far behind. */
    const BURST_DWELL_MS = 350;
    const BURST_BACKLOG = 2;
    const MASK = '••••••••••••';

    const now = createNowTicker();
    const entries = $derived($logStore);

    let revealed = $state(false);
    /**
     * Which line the collapsed ticker is showing. Steps finish in fractions of a
     * millisecond, so without pacing the ticker only ever shows the last line of
     * a burst. Display only — no crypto path awaits it.
     *
     * Seeded at the end: this component mounts once the note opens, long after
     * prepare() and unlock() logged, and that backlog is stale history.
     */
    let cursor = $state(get(logStore).length - 1);

    $effect(() => {
        const last = entries.length - 1;
        // clear() shrank the log out from under us.
        if (cursor > last) {
            cursor = last;
            return;
        }
        if (cursor === last) return;
        // Expanded, every line is already on screen; pacing would only lag it.
        if (open) {
            cursor = last;
            return;
        }
        // A failure never waits behind the queue.
        if (entries[cursor + 1].level === 'error') {
            cursor += 1;
            return;
        }
        const timer = setTimeout(
            () => (cursor += 1),
            last - cursor > BURST_BACKLOG ? BURST_DWELL_MS : DWELL_MS
        );
        return () => clearTimeout(timer);
    });

    const shown = $derived(entries[cursor] ?? null);
    const ticker = $derived.by(() => {
        if (placeholder !== null) return placeholder;
        if (shown === null) return 'no events yet';
        const timing = shown.durationMs === undefined ? '' : ` · ${duration(shown.durationMs)}`;
        return `${shown.text}${timing} · ${ago(shown.at, now.value)}`;
    });
    const alarmed = $derived(placeholder === null && shown !== null && shown.level === 'error');

    function display(detail: LogDetail): string {
        return detail.sensitive === true && !revealed ? MASK : detail.value;
    }

    function line(entry: LogEntry): string {
        return entry.durationMs === undefined
            ? entry.text
            : `${entry.text} · ${duration(entry.durationMs)}`;
    }

    function scrollToNewMessages(node: HTMLDivElement, _entries: unknown[]) {
        const scroll = () => node.scroll({ top: node.scrollHeight, behavior: 'smooth' });
        scroll();
        return { update: scroll };
    }
</script>

{#snippet details(entry: LogEntry)}
    {#if entry.details.length > 0}
        <div class="font-mono text-[11px] leading-[1.5] wrap-anywhere text-ghost">
            {#each entry.details as detail, i (i)}
                {#if i > 0}<span class="px-1.5">·</span>{/if}{detail.label}
                <span class={detail.sensitive === true && !revealed ? '' : 'text-faint'}>
                    {display(detail)}
                </span>
            {/each}
        </div>
    {/if}
{/snippet}

{#if !open}
    <button
        class="flex h-11 w-full flex-none items-center gap-3 border-t border-hairline bg-sunken px-[18px] pb-[env(safe-area-inset-bottom)] text-left lg:gap-3.5 lg:px-[26px] lg:pb-0"
        type="button"
        onclick={() => (open = true)}
    >
        <span class="size-1.5 flex-none rounded-full {dot}" class:animate-blink-fast={pulse}
        ></span>
        <span
            class="flex-1 truncate font-mono text-[11px] leading-[1.6] lg:text-[12px] {alarmed
                ? 'text-notice'
                : 'text-dim'}"
        >
            {ticker}
        </span>
        <span class="hidden font-mono text-[11px] leading-[1.6] text-faint lg:inline">
            {entries.length.toLocaleString()}
            {entries.length === 1 ? 'event' : 'events'}
        </span>
        <span class="font-mono text-[11px] leading-[1.6] text-muted">
            <span class="lg:hidden">log ↑</span>
            <span class="hidden lg:inline">open ↑</span>
        </span>
    </button>
{:else}
    <!-- 6e — desktop drawer. -->
    <div
        class="hidden h-[330px] flex-none animate-drawer flex-col border-t border-hairline bg-sunken lg:flex"
    >
        <div class="flex h-12 flex-none items-center gap-3.5 px-[26px]">
            <span class="font-mono text-[11px] leading-none tracking-[.12em] text-muted uppercase">
                security log
            </span>
            <span class="flex-1 font-mono text-[11px] leading-none text-faint">
                {entries.length.toLocaleString()}
                {entries.length === 1 ? 'event' : 'events'}
            </span>
            <button
                class="font-mono text-[11px] leading-none text-faint"
                type="button"
                onclick={() => (revealed = !revealed)}
            >
                {revealed ? 'hide values ▾' : 'reveal values ▸'}
            </button>
            <button
                class="font-mono text-[11px] leading-none text-faint"
                type="button"
                onclick={() => (open = false)}
            >
                close ↓
            </button>
        </div>
        <div
            class="flex min-h-0 flex-1 flex-col gap-[7px] overflow-y-auto px-[26px] pt-1 pb-3"
            use:scrollToNewMessages={entries}
        >
            {#each entries as entry, i (entry.id)}
                <div class="flex items-baseline gap-3.5">
                    <span class="flex-none basis-[54px] font-mono text-[12px] leading-[1.5] text-faint">
                        {clockTime(entry.at)}
                    </span>
                    <div class="flex min-w-0 flex-1 flex-col">
                        <span
                            class="font-mono text-[12px] leading-[1.5] wrap-anywhere {entry.level ===
                            'error'
                                ? 'text-notice'
                                : i === entries.length - 1
                                  ? 'text-ink'
                                  : 'text-muted'}"
                        >
                            {line(entry)}
                        </span>
                        {@render details(entry)}
                    </div>
                </div>
            {/each}
        </div>
        <div class="flex-none px-[26px] pb-[18px]">
            <span class="font-mono text-[11px] leading-[1.5] text-ghost">
                nothing here leaves the device
            </span>
        </div>
    </div>

    <!-- 6m — phone pushes a full screen instead of a drawer. -->
    <div class="fixed inset-0 z-20 flex flex-col bg-canvas lg:hidden">
        <header class="flex h-14 flex-none items-center justify-between px-[18px]">
            <button
                class="-ml-2.5 flex min-h-11 items-center px-2.5 text-[15px] leading-none font-normal text-muted"
                type="button"
                onclick={() => (open = false)}
            >
                ← Note
            </button>
            <button
                class="-mr-2.5 flex min-h-11 items-center px-2.5 font-mono text-[11px] leading-none text-faint"
                type="button"
                onclick={() => (revealed = !revealed)}
            >
                {revealed ? 'hide values' : 'reveal values'}
            </button>
        </header>
        <div
            class="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] pt-2 pb-5"
            use:scrollToNewMessages={entries}
        >
            {#each entries as entry, i (entry.id)}
                <div class="flex flex-col gap-[3px]">
                    <span class="font-mono text-[11px] leading-[1.4] text-faint">
                        {clockTime(entry.at)}
                    </span>
                    <span
                        class="font-mono text-[13px] leading-[1.5] wrap-anywhere {entry.level ===
                        'error'
                            ? 'text-notice'
                            : i === entries.length - 1
                              ? 'text-ink'
                              : 'text-muted'}"
                    >
                        {line(entry)}
                    </span>
                    {@render details(entry)}
                </div>
            {/each}
        </div>
        <div
            class="flex-none border-t border-hairline bg-sunken px-4 py-3 pb-[max(22px,env(safe-area-inset-bottom))]"
        >
            <span class="font-mono text-[11px] leading-[1.5] text-faint">
                {entries.length.toLocaleString()}
                {entries.length === 1 ? 'event' : 'events'} · nothing here leaves the device
            </span>
        </div>
    </div>
{/if}
