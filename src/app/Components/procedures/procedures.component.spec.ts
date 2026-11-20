import { ProceduresComponent } from './procedures.component';
import { ProcedureService } from '../../Services/procedure.service';
import { ActivityNotification, NotifyUpdateService } from '../../Services/notify-update.service';
import { memoryDb } from '../../testing/memory-db';

describe('Procedure action notifications', () => {
  it('distinguishes saved and updated records and does not report success when persistence fails', async () => {
    const record = { id: '1', name: 'Urology', active: true };
    const service = jasmine.createSpyObj<ProcedureService>('procedures', ['save', 'getAll']);
    service.save.and.resolveTo(record); service.getAll.and.resolveTo([record]);
    const feedback = new NotifyUpdateService(); let messages: ActivityNotification[] = [];
    feedback.notifications$.subscribe(value => messages = value);
    const component = new ProceduresComponent(service, memoryDb().db, feedback);
    try {
      component.name.setValue(record.name); await component.save();
      expect(messages[0].title).toBe('Successfully saved'); expect(messages[0].route).toBe('/procedures');
      component.edit(record); component.name.setValue('Urology revised'); await component.save();
      expect(service.save).toHaveBeenCalledWith('Urology revised', '1'); expect(messages[0].title).toBe('Successfully updated');
      service.save.and.rejectWith(new Error('Offline')); component.name.setValue('Keep this draft'); await component.save();
      expect(messages[0].type).toBe('error'); expect(messages[0].description).toBe('Offline');
      expect(messages.filter(message => message.type === 'success').length).toBe(2); expect(component.name.value).toBe('Keep this draft');
    } finally { component.ngOnDestroy(); feedback.ngOnDestroy(); }
  });
});
