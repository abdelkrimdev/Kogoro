export interface ParsedTitle {
  lang: string;
  value: string;
}

export function parseTitles(xml: string): ParsedTitle[] {
  const titles: ParsedTitle[] = [];
  const regex = /<title[^>]*(?:xml:)?lang="([^"]*)"[^>]*>([^<]*)<\/title>/g;
  for (const match of xml.matchAll(regex)) {
    const lang = match[1] ?? "";
    const value = match[2];
    if (value) {
      titles.push({ lang, value });
    }
  }
  return titles;
}

export function findTitles(titles: Iterable<{ lang: string; value: string | undefined }>): {
  titleEn: string | undefined;
  titleJa: string | undefined;
} {
  let titleEn: string | undefined;
  let titleJa: string | undefined;
  for (const t of titles) {
    if (t.lang === "en" && titleEn === undefined) titleEn = t.value;
    if (t.lang === "ja" && titleJa === undefined) titleJa = t.value;
    if (titleEn !== undefined && titleJa !== undefined) break;
  }
  return { titleEn, titleJa };
}
