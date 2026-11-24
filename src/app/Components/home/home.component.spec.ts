import { HomeComponent } from './home.component';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Subject } from 'rxjs';

describe('Workspace save navigation', () => {
  let component: HomeComponent;
  let closed: Subject<any>;
  let router: jasmine.SpyObj<Router>;
  let medicines: { addNewMedicine: jasmine.Spy };
  let save: jasmine.Spy;

  beforeEach(() => {
    closed = new Subject();
    const dialog = { open: () => ({ afterClosed: () => closed }) } as unknown as MatDialog;
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    save = jasmine.createSpy('save').and.resolveTo(true);
    medicines = { addNewMedicine: jasmine.createSpy('addNewMedicine') };
    component = new HomeComponent(dialog, new NotifyUpdateService(),
      { addNewPatient: save } as any, { addNewOpd: save } as any,
      { addNewLabPatient: save } as any, { addNewInpatient: save } as any,
      medicines as any, { showAlert: jasmine.createSpy('showAlert') } as any, {} as any, router, {} as any, {} as any,
      { load: async () => undefined, can: () => true } as any);
  });

  afterEach(() => component.ngOnDestroy());

  for (const [method, destination] of [
    ['addPatient', '/patient'], ['addOpdSlip', '/opd'],
    ['addLabTestSlip', '/lab'], ['addInnPatient', '/inpatient'],
    ['addMedicine', '/medicine'],
  ] as const) {
    it(`returns a saved ${method} record to ${destination}`, async () => {
      component[method]();
      closed.next({ patientName: 'Ali' });
      await Promise.resolve();
      await Promise.resolve();
      expect(router.navigate).toHaveBeenCalledWith([destination]);
      if (method === 'addMedicine') expect(medicines.addNewMedicine).not.toHaveBeenCalled();
      else expect(save).toHaveBeenCalledTimes(1);
    });
  }

  it('keeps the current destination when a dialog is cancelled or saving fails', async () => {
    component.addPatient();
    closed.next(undefined);
    expect(router.navigate).not.toHaveBeenCalled();
    save.and.resolveTo(false);
    closed.next({ firstName: 'Ali' });
    await Promise.resolve();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
