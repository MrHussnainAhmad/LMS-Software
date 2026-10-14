// One request at a time; hidden windows do not generate polling traffic.
export function createVisiblePoll(task: () => Promise<void>, options: {
  interval: number | (() => number);
  shouldPoll?: () => boolean;
  minRefreshGap?: number;
}) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | null = null;
  let lastStarted = Number.NEGATIVE_INFINITY;
  let failures = 0;
  let pendingRefresh = false;
  const visible = () => document.visibilityState !== 'hidden';
  function schedule() {
    clearTimeout(timer);
    if (stopped || !visible() || (!failures && options.shouldPoll && !options.shouldPoll())) return;
    const interval = typeof options.interval === 'function' ? options.interval() : options.interval;
    const delay = Math.min(interval * 2 ** failures, 120_000);
    timer = setTimeout(() => { void refresh(); }, delay);
  }
  function refresh(force = false): Promise<void> {
    if (stopped || !visible()) return Promise.resolve();
    if (running) {
      // A mutation during a read needs a subsequent read, rather than reusing
      // a snapshot that may have been produced before the mutation.
      pendingRefresh ||= force;
      return running;
    }
    if (!force && Date.now() - lastStarted < (options.minRefreshGap ?? 1000)) { schedule(); return Promise.resolve(); }
    clearTimeout(timer);
    lastStarted = Date.now();
    running = Promise.resolve().then(() => {
      if (stopped || !visible()) { lastStarted = Number.NEGATIVE_INFINITY; return; }
      return task();
    }).then(() => { failures = 0; }, () => { failures += 1; }).finally(() => {
      running = null;
      if (pendingRefresh && !stopped) {
        pendingRefresh = false;
        void refresh(true);
      } else schedule();
    });
    return running;
  }
  const onVisible = () => {
    if (visible()) void refresh();
    else clearTimeout(timer);
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  void refresh();
  return {
    refresh,
    stop() {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    },
  };
}
