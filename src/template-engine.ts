export function render(template: string, context: Record<string, string | number>): string {
  return template.replace(
    /\{([\w.]+)(?::(\d+))?\}/g,
    (_match, key: string, format: string | undefined) => {
      const value = context[key];
      if (value === undefined) return "";
      let result = String(value);
      if (format !== undefined) {
        const width = Number.parseInt(format, 10);
        result = result.padStart(width, "0");
      }
      return result;
    },
  );
}
