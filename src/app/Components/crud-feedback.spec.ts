import { Subject, throwError } from 'rxjs';
import { NotifyUpdateService } from '../Services/notify-update.service';
import { PatientListComponent } from './patient/patient-list/patient-list.component';
import { OpdListComponent } from './opdslip/opd-list/opd-list.component';
import { InpatientListComponent } from './inpatient/inpatient-list/inpatient-list.component';
import { MedicineListComponent } from './medicine/medicine-list/medicine-list.component';
import { LabListComponent } from './lab/lab-list/lab-list.component';

describe('Clinical CRUD failure feedback', () => {
  for (const [type, edit] of [
    [PatientListComponent, 'editPatient'], [OpdListComponent, 'editOpd'],
    [InpatientListComponent, 'editInpatient'], [MedicineListComponent, 'editMedicine'], [LabListComponent, 'editLabPatient'],
  ] as const) {
    it(`clears the list loader and reports failed reads and edits in ${type.name}`, () => {
      const notify = new NotifyUpdateService(); const request = new Subject<any[]>();
      const load = () => request; const details = () => throwError(() => new Error('Offline'));
      const dependency = Object.assign(notify, {
        getAllPatient: load, getAllOpds: load, getAllInpatient: load, getAllMedicine: load, getAllLabPatient: load,
        getPatientDetails: details, getOpdDetails: details, getInpatientDetails: details, getMedicineDetails: details, getLabPatientDetails: details,
      });
      const messages: Array<{ msg: string; type: string }> = []; notify.alertNotify.subscribe(value => messages.push(value));
      const component: any = new (type as any)(dependency, dependency, dependency, dependency, dependency, dependency, dependency);
      try {
        component.dataActions('', '', 0, 20); expect(component.loading).toBeTrue();
        request.error(new Error('Offline')); expect(component.loading).toBeFalse(); expect(component.loadFailed).toBeTrue();
        component[edit](1); expect(messages.length).toBe(2); expect(messages.every(message => message.type === 'error')).toBeTrue();
        expect(messages[1].msg).toContain('details could not be loaded');
      } finally { component.ngOnDestroy(); notify.ngOnDestroy(); }
    });
  }
});
