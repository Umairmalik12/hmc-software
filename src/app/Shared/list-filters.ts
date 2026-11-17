export function includesText(value: unknown, query: string): boolean {
  return String(value ?? '').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

export function matchesDateFilter(value: unknown, filter: string): boolean {
  if (!filter || filter === 'all') return true;
  const time = new Date(String(value || '')).getTime();
  if (!Number.isFinite(time)) return false;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  if (filter === 'today') return time >= start && time < tomorrow;
  if (filter === 'yesterday') return time >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime() && time < start;
  const days = ['week', 'seven'].includes(filter) ? 7 : ['month', 'thirty'].includes(filter) ? 30 : 0;
  return !days || (time >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - days).getTime() && time < tomorrow);
}
