<script lang="ts">
    import { onDestroy } from 'svelte';
    import { ago, clockTime } from './format';
    import { logStore } from './store';

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

    let now = $state(Date.now());

    const entries = $derived($logStore);
    const latest = $derived(entries.at(-1) ?? null);
    const ticker = $derived(
        placeholder !== null
            ? placeholder
            : latest === null
              ? 'no events yet'
              : `${latest.text} · ${ago(latest.at, now)}`
    );

    // Ages are coarse by design; `ago` clamps, so a line that arrives between
    // ticks reads "0s ago" rather than borrowing the previous line's age.
    const timer = setInterval(() => (now = Date.now()), 5_000);
    onDestroy(() => clearInterval(timer));

    function scrollToNewMessages(node: HTMLDivElement, _entries: unknown[]) {
        const scroll = () => node.scroll({ top: node.scrollHeight, behavior: 'smooth' });
        scroll();
        return { update: scroll };
    }
</script>

{#if !open}
    <button
        class="flex h-11 w-full flex-none items-center gap-3 border-t border-hairline bg-sunken px-[18px] pb-[env(safe-area-inset-bottom)] text-left lg:gap-3.5 lg:px-[26px] lg:pb-0"
        type="button"
        onclick={() => (open = true)}
    >
        <span class="size-1.5 flex-none rounded-full {dot}" class:animate-blink-fast={pulse}
        ></span>
        <span
            class="flex-1 truncate font-mono text-[11px] leading-[1.6] lg:text-[12px] {placeholder ===
                null &&
            latest !== null &&
            latest.text.startsWith('ERROR')
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
        <button
            class="flex h-12 flex-none items-center gap-3.5 px-[26px] text-left"
            type="button"
            onclick={() => (open = false)}
        >
            <span class="font-mono text-[11px] leading-none tracking-[.12em] text-muted uppercase">
                security log
            </span>
            <span class="flex-1 font-mono text-[11px] leading-none text-faint">
                {entries.length.toLocaleString()}
                {entries.length === 1 ? 'event' : 'events'}
            </span>
            <span class="font-mono text-[11px] leading-none text-faint">close ↓</span>
        </button>
        <div
            class="flex min-h-0 flex-1 flex-col gap-[7px] overflow-y-auto px-[26px] pt-1 pb-[18px]"
            use:scrollToNewMessages={entries}
        >
            {#each entries as entry, i (i)}
                <div class="flex items-baseline gap-3.5">
                    <span class="flex-none basis-[54px] font-mono text-[12px] leading-[1.5] text-faint">
                        {clockTime(entry.at)}
                    </span>
                    <span
                        class="font-mono text-[12px] leading-[1.5] wrap-anywhere {i ===
                        entries.length - 1
                            ? 'text-ink'
                            : 'text-muted'}"
                    >
                        {entry.text}
                    </span>
                </div>
            {/each}
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
            <span class="font-mono text-[11px] leading-none tracking-[.12em] text-muted uppercase">
                security log
            </span>
        </header>
        <div
            class="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] pt-2 pb-5"
            use:scrollToNewMessages={entries}
        >
            {#each entries as entry, i (i)}
                <div class="flex flex-col gap-[3px]">
                    <span class="font-mono text-[11px] leading-[1.4] text-faint">
                        {clockTime(entry.at)}
                    </span>
                    <span
                        class="font-mono text-[13px] leading-[1.5] wrap-anywhere {i ===
                        entries.length - 1
                            ? 'text-ink'
                            : 'text-muted'}"
                    >
                        {entry.text}
                    </span>
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
