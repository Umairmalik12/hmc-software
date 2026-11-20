import { MedicineAlphabet, MEDICINE_LETTERS, medicineLetter } from './medicine-alphabet';

describe('Medicine alphabetical organization', () => {
  it('sorts case-insensitively in A–Z groups with digits and punctuation under # without mutating records', () => {
    const records = Object.freeze([{ id: 'z', name: 'zinc' }, { id: 'b', name: 'Brufen' }, { id: 'a2', name: ' amoxicillin ' }, { id: 'a1', name: 'Aceclofenac' }, { id: 'n', name: '2SUM' }, { id: 's', name: '@Special' }].map(row => Object.freeze(row)));
    const before = JSON.stringify(records), alphabet = new MedicineAlphabet<{ id: string; name: string }>();
    const view = alphabet.view(records, '', () => true, '');
    expect(view.items.map(item => item.name)).toEqual(['Aceclofenac', ' amoxicillin ', 'Brufen', 'zinc', '@Special', '2SUM']);
    expect(alphabet.visibleGroups(view, 100).map(group => group.letter)).toEqual(['A', 'B', 'Z', '#']);
    expect(JSON.stringify(records)).toBe(before); expect(view.letters.map(item => item.letter)).toEqual([...MEDICINE_LETTERS]);
    expect(medicineLetter('  INJ. AVIL')).toBe('I'); expect(medicineLetter('éxample')).toBe('E'); expect(medicineLetter('β medicine')).toBe('#');
  });
  it('never repeats an ID but retains distinct records and strengths with the same initial', () => {
    const first = { id: '1', name: 'Alpha 500 mg' }, second = { id: '2', name: 'alpha 1 g' };
    const alphabet = new MedicineAlphabet<typeof first>(); const view = alphabet.view([first, first, second], '', () => true, 'A');
    expect(view.items.length).toBe(2); expect(new Set(view.items.map(item => item.id)).size).toBe(2); expect(view.total).toBe(2);
  });
  it('combines searches and letter filtering, counts every matching row, and caches results between UI reads', () => {
    const records = [{ id: '1', name: 'Alpha sample' }, { id: '2', name: 'Beta sample' }, { id: '3', name: 'Alpha other' }];
    const alphabet = new MedicineAlphabet<typeof records[0]>(), predicate = jasmine.createSpy('matches').and.callFake(item => item.name.includes('sample'));
    const all = alphabet.view(records, 'sample', predicate, '');
    expect(alphabet.view(records, 'sample', predicate, '')).toBe(all); expect(predicate).toHaveBeenCalledTimes(3);
    const b = alphabet.view(records, 'sample', predicate, 'B'); expect(b.items.map(item => item.id)).toEqual(['2']); expect(b.total).toBe(2);
    expect(b.letters.find(item => item.letter === 'A')!.count).toBe(1); expect(predicate).toHaveBeenCalledTimes(3);
    expect(alphabet.view(records, 'sample', predicate, '#').items).toEqual([]);
    const refreshed = alphabet.view([...records, { id: '4', name: 'Beta sample 2' }], 'sample', predicate, 'B'); expect(refreshed.items.length).toBe(2);
  });
  it('counts medicines rather than headings while appending a group across multiple pagination batches', () => {
    const rows = Array.from({ length: 65 }, (_, i) => ({ id: String(i), name: 'Alpha ' + i }));
    const alphabet = new MedicineAlphabet<typeof rows[0]>(), view = alphabet.view(rows, '', () => true, '');
    const first = alphabet.visibleGroups(view, 20); expect(first[0].items.length).toBe(20); expect(first[0].total).toBe(65);
    expect(alphabet.visibleGroups(view, 20)).toBe(first); expect(alphabet.visibleGroups(view, 40)[0].items.length).toBe(40);
    const all = alphabet.visibleGroups(view, 80); expect(all.length).toBe(1); expect(new Set(all[0].items.map(item => item.id)).size).toBe(65);
  });
});
