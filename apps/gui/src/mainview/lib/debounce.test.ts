import { afterEach, describe, expect, it, mock } from "bun:test";
import { debouncePush } from "./debounce";

describe("debouncePush", () => {
  afterEach(() => {
    mock.restore();
  });

  it("calls the function after the delay", async () => {
    const fn = mock(() => Promise.resolve());
    debouncePush("g1", fn, 50);

    expect(fn).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 80));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("resets the timer on subsequent calls for the same key", async () => {
    const fn = mock(() => Promise.resolve());
    debouncePush("g1", fn, 50);
    await new Promise((r) => setTimeout(r, 30));
    debouncePush("g1", fn, 50);
    await new Promise((r) => setTimeout(r, 80));

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not interfere across different keys", async () => {
    const fn1 = mock(() => Promise.resolve());
    const fn2 = mock(() => Promise.resolve());
    debouncePush("g1", fn1, 50);
    debouncePush("g2", fn2, 50);

    await new Promise((r) => setTimeout(r, 80));
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
  });
});
