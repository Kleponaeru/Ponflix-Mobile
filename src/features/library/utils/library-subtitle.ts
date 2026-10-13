/** Remove a repeated media title from a history subtitle (for example,
 * "One Piece Chapter 1" becomes "Chapter 1").
 */
export function stripMediaTitleFromSubtitle(title?: string, subtitle?: string): string | undefined {
  const cleanTitle = title?.trim();
  const cleanSubtitle = subtitle?.trim();
  if (!cleanTitle || !cleanSubtitle) return cleanSubtitle || undefined;

  const words = (value: string) => [...value.matchAll(/[\p{L}\p{N}]+/gu)].map((match) => ({
    value: match[0].toLocaleLowerCase(),
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
  const titleWords = words(cleanTitle);
  const subtitleWords = words(cleanSubtitle);
  if (!titleWords.length || !subtitleWords.length) return cleanSubtitle;

  const removals: Array<{ start: number; end: number }> = [];
  for (let index = 0; index <= subtitleWords.length - titleWords.length; index += 1) {
    if (titleWords.every((word, offset) => subtitleWords[index + offset].value === word.value)) {
      removals.push({ start: subtitleWords[index].start, end: subtitleWords[index + titleWords.length - 1].end });
      index += titleWords.length - 1;
    }
  }
  if (!removals.length) return cleanSubtitle;

  let cursor = 0;
  let result = '';
  for (const removal of removals) {
    result += `${cleanSubtitle.slice(cursor, removal.start)} `;
    cursor = removal.end;
  }
  const remainder = `${result}${cleanSubtitle.slice(cursor)}`
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-:|.,;\u00b7\u2013\u2014(){}\[\]]+|[\s\-:|.,;\u00b7\u2013\u2014(){}\[\]]+$/g, '')
    .trim();
  return remainder || undefined;
}

/** Show only the numbered chapter label in reading history. */
export function getComicChapterNumber(title?: string, subtitle?: string, route?: string): string | undefined {
  const chapterText = stripMediaTitleFromSubtitle(title, subtitle) || subtitle?.trim() || '';
  const numberedChapter = chapterText.match(/\b(?:chapter|chap(?:ter)?|ch\.?|episode|ep\.?)\s*(?:no\.?\s*)?[-:#.]?\s*(\d+(?:\.\d+)?)/i);
  if (numberedChapter) return `Chapter ${numberedChapter[1]}`;

  // Some source chapter titles are just "12 - The title" without a label.
  const leadingNumber = chapterText.match(/^\s*(\d+(?:\.\d+)?)(?:\s|[-:|.]|$)/);
  if (leadingNumber) return `Chapter ${leadingNumber[1]}`;

  // Older saved entries may only have the chapter slug in their route.
  const chapterSlug = route?.split('/').filter(Boolean).pop() || '';
  const slugNumber = chapterSlug.match(/(?:chapter|chap|ch)[-_ ]*(\d+(?:\.\d+)?)/i)
    || chapterSlug.match(/(?:^|[-_ ])(\d+(?:\.\d+)?)$/i);
  return slugNumber ? `Chapter ${slugNumber[1]}` : undefined;
}
