export function createTimer({
    setInterval: schedule = globalThis.setInterval,
    clearInterval: cancel = globalThis.clearInterval,
    now = Date.now,
} = {}) {
    const started = now();
    let elapsed = 0,
        disposed = false;
    const listeners = new Set<() => void>();
    const handle = schedule(() => {
        if (disposed) return;
        elapsed = Math.floor((now() - started) / 1000);
        for (const listener of listeners) listener();
    }, 1000);
    return {
        getSnapshot: () => elapsed,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            cancel(handle);
            listeners.clear();
        },
    };
}
