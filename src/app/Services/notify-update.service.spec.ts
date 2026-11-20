import { ActivityNotification, NotifyUpdateService, ToastMessage } from './notify-update.service';
import { Router } from '@angular/router';

describe('App-wide CRUD notifications', () => {
  let service: NotifyUpdateService; let toasts: ToastMessage[]; let history: ActivityNotification[]; let unread: number;
  beforeEach(() => { jasmine.clock().install(); jasmine.clock().mockDate(new Date('2026-11-18T00:00:00Z')); service = new NotifyUpdateService(); toasts = []; service.toasts$.subscribe(value => toasts = value); service.notifications$.subscribe(value => history = value); service.unreadCount$.subscribe(value => unread = value); });
  afterEach(() => { service.ngOnDestroy(); localStorage.removeItem('hmc.notifications.test-staff-a'); localStorage.removeItem('hmc.notifications.test-staff-b'); jasmine.clock().uninstall(); });
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

  it('keeps timestamped activity after toasts expire and updates read counts immediately', () => {
    service.success('Patient registered.', { route: '/patient' }); service.success('Medicine updated successfully.', { route: '/prescription-medicines' });
    expect(unread).toBe(2); expect(history[0].title).toBe('Successfully updated'); expect(history[0].route).toBe('/prescription-medicines');
    expect(history[0].createdAt).toBe('2026-11-18T00:00:00.000Z');
    jasmine.clock().tick(6000); expect(toasts).toEqual([]); expect(history.length).toBe(2); expect(unread).toBe(2);
    service.markAsRead(history[0].id); expect(unread).toBe(1); expect(history[0].read).toBeTrue();
    service.markAllAsRead(); expect(unread).toBe(0); expect(history.length).toBe(2);
    service.clearNotifications(); expect(history).toEqual([]); expect(unread).toBe(0);
  });

  it('records each action while combining identical transient toasts', () => {
    service.success('Successfully saved'); service.success('Successfully saved');
    expect(toasts.length).toBe(1); expect(history.length).toBe(2); expect(history[0].id).not.toBe(history[1].id); expect(unread).toBe(2);
    service.error('Offline'); service.error('Offline'); expect(history.length).toBe(4);
    service.markAsRead(history[0].id); service.error('Offline'); expect(history.length).toBe(5); expect(history[0].read).toBeFalse();
    service.clearNotifications(); service.error('Offline'); expect(history.length).toBe(1); expect(unread).toBe(1);
  });

  it('restores read state per staff account and isolates histories when signing out or switching accounts', () => {
    service.setUser('test-staff-a'); service.success('Patient saved.'); const id = history[0].id; service.markAsRead(id);
    service.setUser('test-staff-b'); expect(history).toEqual([]); expect(toasts).toEqual([]);
    service.success('Payment saved.'); service.setUser(null); expect(history).toEqual([]); expect(unread).toBe(0);
    service.setUser('test-staff-a'); expect(history.map(item => item.id)).toEqual([id]); expect(unread).toBe(0);
    service.setUser('test-staff-a'); expect(history.length).toBe(1);
    service.setUser('test-staff-b'); expect(history[0].description).toBe('Payment saved.'); expect(unread).toBe(1);
  });

  it('continues to deliver notifications and read changes when browser storage is unavailable', () => {
    const storage = spyOn(Storage.prototype, 'setItem').and.throwError('Storage full');
    try { service.setUser('test-staff-a'); service.success('Token generated.'); expect(unread).toBe(1); service.markAllAsRead(); expect(unread).toBe(0); }
    finally { storage.and.callThrough(); }
  });

  it('rejects corrupt history entries and external navigation targets', () => {
    localStorage.setItem('hmc.notifications.test-staff-a', JSON.stringify([{ id: 'safe', title: 'Saved', description: '<img src=x onerror=alert(1)>', type: 'success', createdAt: '2026-11-18T00:00:00Z', read: false, route: 'https://example.test' }, { id: 'corrupt', createdAt: 'invalid' }]));
    service.setUser('test-staff-a'); expect(history.length).toBe(1); expect(history[0].route).toBeUndefined();
    service.info('External link', { route: '//example.test' }); expect(history[0].route).toBeUndefined();
  });

  it('links edit-page actions to their list and bounds recent history independently of the toast stack', () => {
    const routed = new NotifyUpdateService({ url: '/prescriptions/5/edit' } as Router);
    let entries: ActivityNotification[] = []; routed.notifications$.subscribe(value => entries = value);
    try { for (let index = 0; index < 101; index++) routed.success('Patient ' + index + ' saved.');
      expect(entries.length).toBe(100); expect(entries[0].description).toBe('Patient 100 saved.'); expect(entries[99].description).toBe('Patient 1 saved.'); expect(entries[0].route).toBe('/prescriptions');
    } finally { routed.ngOnDestroy(); }
  });
});
