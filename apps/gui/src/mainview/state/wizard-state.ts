export type WizardStep = "database" | "apikey" | "template" | "completion";

const STEPS: WizardStep[] = ["database", "apikey", "template", "completion"];

export interface WizardState {
  step: WizardStep;
  primaryDb: string;
  apiKey: string;
  templatePreset: string;
  templateCustom: string;
  error: string | null;
}

export function getStepIndex(step: WizardStep): number {
  return STEPS.indexOf(step);
}

export function canGoBack(state: WizardState): boolean {
  return getStepIndex(state.step) > 0;
}

export function canAdvance(state: WizardState): boolean {
  if (state.step === "apikey" && !state.apiKey) return false;
  if (state.step === "completion") return false;
  return true;
}

export function getNextStep(state: WizardState): WizardStep | null {
  const idx = getStepIndex(state.step);
  return STEPS[idx + 1] ?? null;
}

export function getPreviousStep(state: WizardState): WizardStep | null {
  const idx = getStepIndex(state.step);
  return idx > 0 ? (STEPS[idx - 1] ?? null) : null;
}
