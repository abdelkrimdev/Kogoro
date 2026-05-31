export type WizardStep = "database" | "apikey" | "template" | "completion";

const STEPS: WizardStep[] = ["database", "apikey", "template", "completion"];

export function getStepIndex(step: WizardStep): number {
  return STEPS.indexOf(step);
}

export function canGoBack(step: WizardStep): boolean {
  return getStepIndex(step) > 0;
}

export function canAdvance(step: WizardStep, apiKey: string): boolean {
  if (step === "apikey" && !apiKey) return false;
  if (step === "completion") return false;
  return true;
}

export function getNextStep(step: WizardStep): WizardStep | null {
  const idx = getStepIndex(step);
  return STEPS[idx + 1] ?? null;
}

export function getPreviousStep(step: WizardStep): WizardStep | null {
  const idx = getStepIndex(step);
  return idx > 0 ? (STEPS[idx - 1] ?? null) : null;
}
