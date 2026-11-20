export const MEDICINE_LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'] as const;
export interface NamedMedicine { id: string; name: string; }
export interface MedicineLetterCount { letter: string; count: number; }
export interface MedicineAlphabetView<T> { items: T[]; letters: MedicineLetterCount[]; total: number; }
export interface MedicineLetterGroup<T> { letter: string; items: T[]; total: number; }

/** Ignore leading whitespace; punctuation, digits and non-Latin initials belong to #. */
export function medicineLetter(name: string): string {
  const initial = name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
  return /^[A-Z]$/.test(initial) ? initial : '#';
}
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
export const trackMedicineLetter = (_index: number, value: { letter: string }): string => value.letter;

/** Sort once per source refresh and filter once per search/filter change. Never mutate records. */
export class MedicineAlphabet<T extends NamedMedicine> {
  private source?: readonly T[];
  private sorted: { item: T; letter: string }[] = [];
  private scopeKey?: string;
  private matching: { item: T; letter: string }[] = [];
  private letters: MedicineLetterCount[] = [];
  private selected?: string;
  private result?: MedicineAlphabetView<T>;
  private groupedView?: MedicineAlphabetView<T>;
  private groupedLimit = -1;
  private groups: MedicineLetterGroup<T>[] = [];

  view(source: readonly T[], key: string, matches: (item: T) => boolean, letter: string): MedicineAlphabetView<T> {
    if (source !== this.source) {
      this.source = source; const ids = new Set<string>();
      this.sorted = source.filter(item => { if (ids.has(item.id)) return false; ids.add(item.id); return true; })
        .map(item => ({ item, letter: medicineLetter(item.name) }))
        .sort((a, b) => (a.letter === '#' ? 27 : a.letter.charCodeAt(0) - 65) - (b.letter === '#' ? 27 : b.letter.charCodeAt(0) - 65)
          || collator.compare(a.item.name.trim(), b.item.name.trim()) || collator.compare(a.item.id, b.item.id));
      this.scopeKey = undefined;
    }
    if (key !== this.scopeKey) {
      this.scopeKey = key; this.matching = this.sorted.filter(entry => matches(entry.item));
      const counts = new Map<string, number>();
      for (const entry of this.matching) counts.set(entry.letter, (counts.get(entry.letter) || 0) + 1);
      this.letters = MEDICINE_LETTERS.map(initial => ({ letter: initial, count: counts.get(initial) || 0 }));
      this.result = undefined;
    }
    if (!this.result || this.selected !== letter) {
      this.selected = letter;
      this.result = { items: this.matching.filter(entry => !letter || entry.letter === letter).map(entry => entry.item), letters: this.letters, total: this.matching.length };
    }
    return this.result;
  }
  visibleGroups(view: MedicineAlphabetView<T>, limit: number): MedicineLetterGroup<T>[] {
    if (view === this.groupedView && limit === this.groupedLimit) return this.groups;
    this.groupedView = view; this.groupedLimit = limit;
    const groups = new Map<string, MedicineLetterGroup<T>>();
    for (const item of view.items.slice(0, limit)) {
      const letter = medicineLetter(item.name);
      let group = groups.get(letter);
      if (!group) { group = { letter, items: [], total: view.letters.find(count => count.letter === letter)!.count }; groups.set(letter, group); }
      group.items.push(item);
    }
    return this.groups = [...groups.values()];
  }
}
