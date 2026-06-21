const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function debouncePush(groupId: string, fn: () => Promise<unknown>, delay = 500): void {
  const existing = timers.get(groupId);
  if (existing) clearTimeout(existing);
  timers.set(
    groupId,
    setTimeout(() => {
      timers.delete(groupId);
      fn();
    }, delay),
  );
}
