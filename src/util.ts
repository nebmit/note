export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolve `fn`, but never sooner than `ms` — used to pace the console pane so
 *  each crypto step stays legible. */
export const waitMin = async <T>(fn: Promise<T>, ms: number) => {
    const start = Date.now();
    const result = await fn;
    const elapsed = Date.now() - start;
    if (elapsed < ms) {
        await wait(ms - elapsed);
    }
    return result;
};
