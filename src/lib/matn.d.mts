export function matnRanges(ar: string, isnads: { start: number; end: number }[]): [number, number][];
export function matnWords(ar: string, isnads: { start: number; end: number }[]): { key: string; start: number; end: number }[];
export function wordsOf(text: string): string[];
export function wordForms(word: string): string[];
export function shardOf(word: string): string;
