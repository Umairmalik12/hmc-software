/** A visible prefix of the filtered data, shared by all record lists. */
export class ScrollPagination {
  readonly batchSize: number;
  limit: number;
  revision = 0;

  constructor(batchSize = 20) {
    this.batchSize = Math.max(1, Math.floor(batchSize));
    this.limit = this.batchSize;
  }

  reset(): void { this.limit = this.batchSize; this.revision++; }

  loadMore(total: number): boolean {
    if (this.limit >= total) return false;
    this.limit = Math.min(total, this.limit + this.batchSize);
    return true;
  }

  slice<T>(rows: readonly T[]): T[] { return rows.slice(0, this.limit); }
}

export function trackRecord(_index: number, value: unknown): unknown {
  const record = value as Record<string, unknown> | null;
  return record?.['id'] ?? record?.['patientId'] ?? record?.['inpatientId'] ?? record?.['medicineId'] ?? value;
}
