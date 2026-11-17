import { NotifyUpdateService, ToastMessage } from './notify-update.service';

describe('App-wide CRUD notifications', () => {
  let service: NotifyUpdateService; let toasts: ToastMessage[];
  beforeEach(() => { jasmine.clock().install(); jasmine.clock().mockDate(new Date('2026-11-18T00:00:00Z')); service = new NotifyUpdateService(); toasts = []; service.toasts$.subscribe(value => toasts = value); });
  afterEach(() => { service.ngOnDestroy(); jasmine.clock().uninstall(); });
  it('keeps independent timers so an earlier toast cannot clear a newer message', () => {
    service.success('Patient created.'); jasmine.clock().tick(3000); service.success('Payment saved.');
    jasmine.clock().tick(2001); expect(toasts.map(item => item.msg)).toEqual(['Payment saved.']);
    jasmine.clock().tick(3000); expect(toasts).toEqual([]);
  });
  it('deduplicates repeated errors and pauses expiry while a notification is being read', () => {
    service.error('Unable to load records.'); service.error('Unable to load records.'); expect(toasts.length).toBe(1);
    const id = toasts[0].id; jasmine.clock().tick(2000); service.pause(id); jasmine.clock().tick(20000);
    expect(toasts.length).toBe(1); service.resume(id); jasmine.clock().tick(6999); expect(toasts.length).toBe(1);
    jasmine.clock().tick(2); expect(toasts).toEqual([]);
  });
  it('supports legacy events, warning and information states, safe text and a bounded stack', () => {
    service.alertNotify.next({ msg: 'Record updated.', type: 'success' });
    service.info('Refreshing list.'); service.warning('Saved; refresh the history.'); service.error('<script>not markup</script>'); service.success('Latest update.');
    expect(toasts.length).toBe(4); expect(toasts[0].msg).toBe('Refreshing list.'); expect(toasts[1].type).toBe('warning');
    expect(toasts[2].msg).toBe('<script>not markup</script>'); service.dismiss(toasts[2].id); expect(toasts.length).toBe(3);
  });
});
