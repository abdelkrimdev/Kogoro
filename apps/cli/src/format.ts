import { log } from "@clack/prompts";

export function createFormatter(
  json: boolean,
  onError: (msg: string) => void,
): (msg: string) => void {
  return (msg: string) => {
    if (json) {
      console.log(msg);
      return;
    }
    try {
      const data = JSON.parse(msg) as unknown;
      if (Array.isArray(data)) {
        if (data.length > 0) {
          console.table(data);
        }
      } else if (data !== null && typeof data === "object") {
        console.table(data);
      } else {
        log.message(msg);
      }
    } catch {
      onError(msg);
    }
  };
}
