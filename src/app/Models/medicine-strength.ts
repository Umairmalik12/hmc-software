export const MEDICINE_STRENGTHS = [
  '5 mg', '10 mg', '20 mg', '25 mg', '50 mg', '75 mg', '100 mg', '125 mg',
  '150 mg', '200 mg', '250 mg', '300 mg', '400 mg', '500 mg', '600 mg',
  '650 mg', '750 mg', '800 mg', '1 g', '1.5 g', '2 g',
  '5 mg/ml', '10 mg/ml', '100 mg/5 ml', '125 mg/5 ml', '250 mg/5 ml',
] as const;

export function normalizeMedicineStrength(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/(\d)\s*(mcg|mg|g|ml|iu|units)\b/gi, '$1 $2').replace(/\s*\/\s*/g, '/');
}

/** Split a saved strength suffix without interpreting doses or converting units. */
export function medicineNameParts(name: string, strength = ''): { name: string; strength: string } {
  const text = name.trim();
  const normalized = normalizeMedicineStrength(strength);
  if (normalized) {
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
    return { name: text.replace(new RegExp('\\s+' + escaped + '$', 'i'), '').trim(), strength: normalized };
  }
  const match = text.match(/^(.*\S)\s+(\d+(?:\.\d+)?\s*(?:mcg|mg|g|ml|iu|units|%)(?:\s*\/\s*(?:\d+(?:\.\d+)?\s*)?(?:ml|l|g|mg))?)$/i);
  return match ? { name: match[1], strength: normalizeMedicineStrength(match[2]) } : { name: text, strength: '' };
}

export function medicineNameWithStrength(name: string, strength: string): string {
  const normalized = normalizeMedicineStrength(strength);
  return normalized ? medicineNameParts(name).name + ' ' + normalized : name;
}

/** Match existing "500mg" labels with "500 mg" without changing their IDs or text. */
export function medicineVariantKey(name: string): string {
  const parts = medicineNameParts(name);
  return parts.name.trim().replace(/\s+/g, ' ').toLowerCase() + '|' + parts.strength.toLowerCase().replace(/\s+/g, '');
}

export function matchesMedicineSearch(name: string, query: string): boolean {
  const compact = (value: string): string => value.toLowerCase().replace(/\s+/g, '');
  return compact(name).includes(compact(query));
}
