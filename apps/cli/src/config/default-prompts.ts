import { cancel, confirm, intro, isCancel, outro, select, text } from "@clack/prompts";
import type { PromptsAPI } from "@kogoro/core";

export function getDefaultPrompts(): PromptsAPI {
  return {
    intro,
    outro,
    select,
    text,
    confirm,
    cancel,
    isCancel,
  };
}
