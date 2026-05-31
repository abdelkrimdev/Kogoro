import { describe, expect, it } from "bun:test";
import { canAdvance, canGoBack, getStepIndex } from "./wizard-state";

describe("canGoBack", () => {
  it("returns false on first step", () => {
    expect(canGoBack("database")).toBe(false);
  });

  it("returns true on second step", () => {
    expect(canGoBack("apikey")).toBe(true);
  });

  it("returns true on third step", () => {
    expect(canGoBack("template")).toBe(true);
  });

  it("returns true on final step", () => {
    expect(canGoBack("completion")).toBe(true);
  });
});

describe("canAdvance", () => {
  it("returns true on database step", () => {
    expect(canAdvance("database", "")).toBe(true);
  });

  it("returns true on apikey step when key is provided", () => {
    expect(canAdvance("apikey", "my-key")).toBe(true);
  });

  it("returns false on apikey step when key is empty", () => {
    expect(canAdvance("apikey", "")).toBe(false);
  });

  it("returns true on template step", () => {
    expect(canAdvance("template", "")).toBe(true);
  });

  it("returns false on completion step", () => {
    expect(canAdvance("completion", "")).toBe(false);
  });
});

describe("getStepIndex", () => {
  it("returns 0 for database", () => {
    expect(getStepIndex("database")).toBe(0);
  });

  it("returns 1 for apikey", () => {
    expect(getStepIndex("apikey")).toBe(1);
  });

  it("returns 2 for template", () => {
    expect(getStepIndex("template")).toBe(2);
  });

  it("returns 3 for completion", () => {
    expect(getStepIndex("completion")).toBe(3);
  });
});
