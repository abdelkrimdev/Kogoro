import { describe, expect, test } from "bun:test";
import { createEventBus } from "./event-bus";

interface TestEvent {
  type: "testA" | "testB";
  data: string;
}

describe("EventBus", () => {
  test("listener receives emitted event", () => {
    const bus = createEventBus<TestEvent>();
    let received: TestEvent | undefined;

    bus.on("testA", (e) => {
      received = e;
    });
    bus.emit({ type: "testA", data: "hello" });

    expect(received).toEqual({ type: "testA", data: "hello" });
  });

  test('wildcard "*" listener receives all events', () => {
    const bus = createEventBus<TestEvent>();
    const received: TestEvent[] = [];

    bus.on("*", (e) => received.push(e));
    bus.emit({ type: "testA", data: "one" });
    bus.emit({ type: "testB", data: "two" });

    expect(received).toHaveLength(2);
    expect(received[0]).toEqual({ type: "testA", data: "one" });
    expect(received[1]).toEqual({ type: "testB", data: "two" });
  });

  test("removeAllListeners prevents delivery", () => {
    const bus = createEventBus<TestEvent>();
    let called = false;

    bus.on("testA", () => {
      called = true;
    });
    bus.removeAllListeners();
    bus.emit({ type: "testA", data: "hello" });

    expect(called).toBe(false);
  });

  test("multiple listeners all receive same event", () => {
    const bus = createEventBus<TestEvent>();
    const received: string[] = [];

    bus.on("testA", () => received.push("a"));
    bus.on("testA", () => received.push("b"));
    bus.emit({ type: "testA", data: "hello" });

    expect(received).toEqual(["a", "b"]);
  });
});
