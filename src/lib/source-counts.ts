/** Raw Markdown counts: Unicode code points (including whitespace) and whitespace-delimited tokens. */
export function countSourceText(source: string): { characters: number; words: number } {
  const whitespace = /\s/u;
  let characters = 0;
  let words = 0;
  let inWord = false;
  for (const character of source) {
    characters++;
    if (whitespace.test(character)) {
      inWord = false;
    } else if (!inWord) {
      words++;
      inWord = true;
    }
  }
  return { characters, words };
}
