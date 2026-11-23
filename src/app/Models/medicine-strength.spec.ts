import { medicineNameParts, medicineNameWithStrength, medicineVariantKey } from './medicine-strength';

describe('Medicine name and strength identities', () => {
  it('distinguishes strengths of the same medicine without converting their units', () => {
    expect(medicineVariantKey('2SUM', '1g')).toBe(medicineVariantKey(' 2sum 1 G '));
    expect(medicineVariantKey('2SUM', '1g')).not.toBe(medicineVariantKey('2SUM', '2g'));
    expect(medicineVariantKey('2SUM', '1g')).not.toBe(medicineVariantKey('2SUM', '1000mg'));
    expect(medicineNameParts('2SUM 1g')).toEqual({ name: '2SUM', strength: '1 g' });
  });
  it('replaces an old strength suffix instead of duplicating it and keeps custom combination strengths intact', () => {
    expect(medicineNameParts('2SUM 1g', '2g')).toEqual({ name: '2SUM', strength: '2 g' });
    expect(medicineNameWithStrength('2SUM 1g', '2g')).toBe('2SUM 2 g');
    expect(medicineNameWithStrength('Sample combination 500 mg/125 mg', '500mg/125mg')).toBe('Sample combination 500 mg/125 mg');
    expect(medicineNameParts('B12', '500mcg')).toEqual({ name: 'B12', strength: '500 mcg' });
  });
});
