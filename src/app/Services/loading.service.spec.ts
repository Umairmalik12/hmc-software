import { LoadingService } from './loading.service';

describe('Application loading state', () => {
  it('keeps the loader active until all concurrent requests finish, with writes taking priority', () => {
    const service = new LoadingService(); let state = { busy: false, label: '', pending: 0 };
    service.state$.subscribe(value => state = value);
    const read = service.begin('Loading records...'); const write = service.begin('Saving record...', 2);
    expect(state.pending).toBe(2); expect(state.label).toBe('Saving record...');
    write(); write(); expect(state.pending).toBe(1); expect(state.busy).toBeTrue(); expect(state.label).toBe('Loading records...');
    read(); expect(state.busy).toBeFalse(); expect(state.pending).toBe(0);
  });
  it('releases a failed request and a synchronous exception without hiding another request', async () => {
    const service = new LoadingService(); let pending = 0; service.state$.subscribe(value => pending = value.pending);
    const finish = service.begin('Other request');
    await expectAsync(service.track('Saving...', async () => { throw new Error('Offline'); })).toBeRejectedWithError('Offline');
    expect(pending).toBe(1);
    await expectAsync(service.track('Loading...', () => { throw new Error('Immediate failure'); })).toBeRejectedWithError('Immediate failure');
    expect(pending).toBe(1); finish(); expect(pending).toBe(0);
  });
});
