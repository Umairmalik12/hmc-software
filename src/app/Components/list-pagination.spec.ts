import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { PatientListComponent } from './patient/patient-list/patient-list.component';
import { OpdListComponent } from './opdslip/opd-list/opd-list.component';
import { InpatientListComponent } from './inpatient/inpatient-list/inpatient-list.component';
import { MedicineListComponent } from './medicine/medicine-list/medicine-list.component';
import { LabListComponent } from './lab/lab-list/lab-list.component';
import { Subject } from 'rxjs';
import { OtlistComponent } from './otlist/otlist.component';
import { PrescriptionListComponent } from './precipion/prescription-list.component';
import { ProceduresComponent } from './procedures/procedures.component';
import { PaymentComponent } from './payment/payment.component';
import { PatientTokenComponent } from './patient-token/patient-token.component';
import { emptyPrescription } from 'src/app/Models/prescription.model';
import { emptyOtRecord } from 'src/app/Models/ot-medicine.model';
import { FormBuilder } from '@angular/forms';

describe('Module list filtering and pagination', () => {
  const modules = [
    [PatientListComponent, 'patient', 'displayedPatients', 'searchName'],
    [OpdListComponent, 'opd', 'displayedOpds', 'searchName'],
    [InpatientListComponent, 'inpatient', 'displayedInpatients', 'searchPatientName'],
    [MedicineListComponent, 'medicine', 'displayedMedicines', 'searchPatientName'],
    [LabListComponent, 'patient', 'displayedPatients', 'searchQuery'],
  ] as const;
  for (const [type, source, displayed, query] of modules) {
    it(`filters ${type.name} by a selected doctor or surgeon across all pages and clears the selection`, () => {
      const dependency = { ...new NotifyUpdateService() };
      const component: any = new (type as any)(dependency, dependency, dependency, dependency, dependency, dependency, dependency);
      const field = type === PatientListComponent || type === OpdListComponent ? 'drName' : type === InpatientListComponent ? 'surgeonName' : type === LabListComponent ? 'suggestedDr' : 'doctorName';
      const doctorQuery = type === PatientListComponent || type === OpdListComponent ? 'searchDrName' : type === InpatientListComponent ? 'searchSurgeonName' : 'searchDoctorName';
      component[source] = Array.from({ length: 32 }, (_, index) => ({ patientId: index + 1, inpatientId: index + 1, medicineId: index + 1,
        name: 'Patient ' + (index + 1), patientName: 'Patient ' + (index + 1), [field]: index === 25 ? 'Dr Ali' : 'Dr Ali Noor', medicines: [], createdAt: new Date().toISOString() }));
      component.onSearch(); expect(component[displayed].length).toBe(20);
      component[doctorQuery] = ' dr   ALI '; component.onSearch();
      expect(component.total).toBe(1); expect(component[displayed][0].patientId).toBe(26);
      component[query] = 'Patient 1'; component.onSearch(); expect(component.total).toBe(0);
      component.onClearSearch(); expect(component[doctorQuery]).toBe(''); expect(component.total).toBe(32); expect(component[displayed].length).toBe(20);
      component.ngOnDestroy();
    });
    it(`paginates and filters ${type.name} consistently`, () => {
      const dependency = { ...new NotifyUpdateService() };
      const component: any = new (type as any)(dependency, dependency, dependency, dependency, dependency, dependency, dependency);
      component[source] = Array.from({ length: 32 }, (_, index) => ({ patientId: index + 1, inpatientId: index + 1, medicineId: index + 1,
        name: 'Patient ' + (index + 1), patientName: 'Patient ' + (index + 1), phone: '', contact: '', procedure: '', surgeonName: '',
        doctorName: '', roomNo: '', medicines: [], createdAt: new Date().toISOString() }));
      component.onSearch();
      expect(component.total).toBe(32);
      expect(component[displayed].length).toBe(20);
      component.loadMore();
      expect(component[displayed].length).toBe(32);
      expect(component[displayed][0].patientId).toBe(1);
      expect(new Set(component[displayed].map((record: any) => record.patientId)).size).toBe(32);
      component.loadMore();
      expect(component[displayed].length).toBe(32);
      component.onDateFilter(false);
      expect(component[displayed].length).toBe(32);
      component[query] = 'Patient 2';
      component.onSearch();
      expect(component.pagination.limit).toBe(20);
      expect(component.total).toBe(11);
      expect(component[displayed].length).toBe(11);
      component[query] = 'No match';
      component.onSearch();
      expect(component.total).toBe(0);
      expect(component[displayed]).toEqual([]);
      component[query] = '';
      component.onSearch();
      expect(component.total).toBe(32);
      expect(component[displayed].length).toBe(20);
      component.ngOnDestroy();
    });
    it(`ignores stale refreshes and retains loaded rows in ${type.name}`, () => {
      const requests: Subject<any[]>[] = [];
      const getAll = () => { const request = new Subject<any[]>(); requests.push(request); return request; };
      const dependency = { ...new NotifyUpdateService(), getAllPatient: getAll, getAllOpds: getAll,
        getAllInpatient: getAll, getAllMedicine: getAll, getAllLabPatient: getAll };
      const component: any = new (type as any)(dependency, dependency, dependency, dependency, dependency, dependency, dependency);
      component.dataActions('', '', 0, 0);
      component.dataActions('', '', 0, 0);
      const rows = Array.from({ length: 45 }, (_, i) => ({ patientId: i, inpatientId: i, medicineId: i, name: 'Current', patientName: 'Current', medicines: [] }));
      requests[1].next(rows);
      component.loadMore();
      expect(component[displayed].length).toBe(40);
      requests[0].next([]);
      expect(component.total).toBe(45);
      component.dataActions('', '', 0, 0);
      requests[2].next(rows.slice(0, 42));
      expect(component[displayed].length).toBe(40);
      component.ngOnDestroy();
      requests[2].next([]);
      expect(component.total).toBe(42);
    });
  }
});

describe('Laboratory catalogue filters', () => {
  it('matches individual tests in saved multiple-test records and combines them with the doctor dropdown', () => {
    const dependency = { ...new NotifyUpdateService() };
    const component: any = new (LabListComponent as any)(dependency, dependency, dependency, dependency, dependency, dependency);
    component.patient = [
      { patientId: 1, name: 'Ali', testName: 'CBC, LFTs', suggestedDr: 'Dr Ali' },
      { patientId: 2, name: 'Sara', testName: ['CBC', 'Older test'], suggestedDr: 'Dr Sara' },
      { patientId: 3, name: 'Other', testName: 'CBC extra', suggestedDr: 'Dr Ali' },
    ];
    component.searchTestName = 'cbc'; component.onSearch(); expect(component.filteredPatients.map((row: any) => row.patientId)).toEqual([1, 2]);
    component.searchDoctorName = 'Dr Ali'; component.onSearch(); expect(component.filteredPatients.map((row: any) => row.patientId)).toEqual([1]);
    component.onClearSearch(); expect(component.total).toBe(3); expect(component.searchTestName).toBe(''); expect(component.searchDoctorName).toBe('');
    component.ngOnDestroy();
  });
});

describe('Remaining module scroll lists', () => {
  for (const module of ['OT', 'Prescriptions', 'Procedures']) {
    it(`appends ${module}, resets searches and retains the loaded batch after refresh`, async () => {
      const service: any = { getAll: jasmine.createSpy().and.resolveTo([]) };
      const db: any = { changes: new Subject<string>() };
      const component: any = module === 'OT' ? new OtlistComponent(service, db, {} as any, {} as any)
        : module === 'Prescriptions' ? new PrescriptionListComponent(service, db, {} as any) : new ProceduresComponent(service, db);
      const rows = Array.from({ length: 65 }, (_, index) => module === 'OT' ? { ...emptyOtRecord(), id: String(index), patientName: 'Patient ' + index }
        : module === 'Prescriptions' ? { ...emptyPrescription(), id: String(index), patient: { ...emptyPrescription().patient, name: 'Patient ' + index } }
        : { id: String(index), name: 'Procedure ' + index });
      service.getAll.and.resolveTo(rows);
      await component.load();
      const visible = () => module === 'Procedures' ? component.visibleOptions : component.visibleRecords;
      const filtered = () => module === 'Procedures' ? component.filtered : component.filteredRecords;
      expect(visible().length).toBe(20);
      component.loadMore(); expect(visible().length).toBe(40);
      await component.load(); expect(visible().length).toBe(40);
      component.loadMore(); component.loadMore(); component.loadMore();
      expect(visible().length).toBe(65);
      expect(new Set(visible().map((record: any) => record.id)).size).toBe(65);
      component.query = module === 'Procedures' ? 'Procedure 1' : 'Patient 1'; component.onSearch();
      expect(visible().length).toBe(filtered().length);
      expect(component.pagination.limit).toBe(20);
      component.query = ''; component.onSearch(); expect(visible().length).toBe(20);
      expect(filtered().length).toBe(65); // All filtered rows remain available to export.
      component.ngOnDestroy();
    });
  }

  it('retains payment batches after reload and resets the prefix for a new search', async () => {
    const rows = Array.from({ length: 65 }, (_, id) => ({ id: String(id), patientName: 'Patient ' + id }));
    const db: any = { getItem: jasmine.createSpy().and.resolveTo(rows) };
    const component = new PaymentComponent(new FormBuilder(), db, {} as any);
    await component.loadPayments(); expect(component.displayedPayments.length).toBe(20);
    component.loadMore(); expect(component.displayedPayments.length).toBe(40);
    await component.loadPayments(); expect(component.displayedPayments.length).toBe(40);
    component.loadMore(); component.loadMore(); expect(component.displayedPayments.length).toBe(65);
    component.paymentSearch = 'Patient 1'; component.applyPaymentFilter();
    expect(component.displayedPayments.length).toBe(11);
    component.paymentSearch = ''; component.applyPaymentFilter();
    expect(component.displayedPayments.length).toBe(20); expect(component.filteredPayments.length).toBe(65);
    component.ngOnDestroy();
  });

  it('paginates date-wise token history while keeping every filtered token for export', async () => {
    const date = '2026-11-17';
    const rows = Array.from({ length: 65 }, (_, id) => ({ id, sequence: id + 1, tokenNumber: 'A' + id, customerName: 'Patient ' + id,
      date, time: '10:00 AM', createdAt: date + 'T05:00:00Z' }));
    const db: any = { getAllPatientTokens: jasmine.createSpy().and.resolveTo(rows) };
    const component: any = new PatientTokenComponent(db, {} as any);
    component.slips = [...rows, { ...rows[0], id: 99, date: '2026-11-16' }];
    component.filterByDate(date); expect(component.historyGroups[0].slips.length).toBe(20);
    expect(component.filteredSlips.length).toBe(65);
    component.loadMore(); expect(component.historyGroups[0].slips.length).toBe(40);
    await component.loadSlips(); expect(component.historyGroups[0].slips.length).toBe(40);
    component.loadMore(); component.loadMore(); component.loadMore(); expect(component.historyGroups[0].slips.length).toBe(65);
    component.search = 'Patient 1'; component.searchHistory(); expect(component.historyGroups[0].slips.length).toBe(11);
    component.search = ''; component.searchHistory(); expect(component.historyGroups[0].slips.length).toBe(20);
    component.filterByDate('2026-11-15'); expect(component.historyGroups).toEqual([]);
    component.ngOnDestroy();
  });
});
