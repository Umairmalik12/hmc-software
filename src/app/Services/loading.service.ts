import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ActivityState { busy: boolean; label: string; pending: number; }

/** Each request owns its release function, so overlapping requests cannot hide one another. */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private sequence = 0;
  private activities = new Map<number, { label: string; priority: number }>();
  private state = new BehaviorSubject<ActivityState>({ busy: false, label: '', pending: 0 });
  readonly state$ = this.state.asObservable();
  begin(label = 'Loading records...', priority = 0): () => void {
    const id = ++this.sequence;
    this.activities.set(id, { label, priority }); this.publish();
    return () => { if (this.activities.delete(id)) this.publish(); };
  }
  async track<T>(label: string, task: () => Promise<T>, priority = 0): Promise<T> {
    const release = this.begin(label, priority);
    try { return await task(); } finally { release(); }
  }
  private publish(): void {
    const current = Array.from(this.activities.values()).sort((a, b) => b.priority - a.priority)[0];
    this.state.next({ busy: !!current, label: current?.label || '', pending: this.activities.size });
  }
}
