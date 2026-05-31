import { describe, expect, it } from "bun:test";
import { canAdvance, canGoBack, getStepIndex, type WizardState } from "./wizard-state";

const makeState = (overrides: Partial<WizardState> = {}): WizardState => ({
  step: overrides.step ?? "database",
  primaryDb: overrides.primaryDb ?? "tvdb",
  apiKey: overrides.apiKey ?? "",
  templatePreset: overrides.templatePreset ?? "standard",
  templateCustom: overrides.templateCustom ?? "",
  error: overrides.error ?? null,
});

describe("canGoBack", () => {
  it("returns false on first step", () => {
    expect(canGoBack(makeState({ step: "database" }))).toBe(false);
  });

  it("returns true on second step", () => {
    expect(canGoBack(makeState({ step: "apikey" }))).toBe(true);
  });

  it("returns true on third step", () => {
    expect(canGoBack(makeState({ step: "template" }))).toBe(true);
  });

  it("returns true on final step", () => {
    expect(canGoBack(makeState({ step: "completion" }))).toBe(true);
  });
});

describe("canAdvance", () => {
  it("returns true on database step", () => {
    expect(canAdvance(makeState({ step: "database" }))).toBe(true);
  });

  it("returns true on apikey step when key is provided", () => {
    expect(canAdvance(makeState({ step: "apikey", apiKey: "my-key" }))).toBe(true);
  });

  it("returns false on apikey step when key is empty", () => {
    expect(canAdvance(makeState({ step: "apikey", apiKey: "" }))).toBe(false);
  });

  it("returns true on template step", () => {
    expect(canAdvance(makeState({ step: "template" }))).toBe(true);
  });

  it("returns false on completion step", () => {
    expect(canAdvance(makeState({ step: "completion" }))).toBe(false);
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
