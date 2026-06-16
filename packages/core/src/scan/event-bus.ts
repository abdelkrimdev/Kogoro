export interface EventBus<T extends { type: string }> {
  on(event: T["type"] | "*", listener: (event: T) => void): void;
  emit(event: T): void;
  removeAllListeners(): void;
}

export function createEventBus<T extends { type: string }>(): EventBus<T> {
  const listeners: Array<{ event: T["type"] | "*"; listener: (event: T) => void }> = [];

  return {
    on(event, listener) {
      listeners.push({ event, listener });
    },
    emit(event) {
      for (const { event: subscribedEvent, listener } of listeners) {
        if (subscribedEvent === "*" || subscribedEvent === event.type) {
          listener(event);
        }
      }
    },
    removeAllListeners() {
      listeners.length = 0;
    },
  };
}
