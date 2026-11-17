import { FeedbackModule } from 'src/app/Shared/feedback.module';
import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule } from '@angular/material/paginator';
import { of } from 'rxjs';
import { PatientListComponent } from '../patient/patient-list/patient-list.component';
import { OpdListComponent } from '../opdslip/opd-list/opd-list.component';
import { InpatientListComponent } from '../inpatient/inpatient-list/inpatient-list.component';
import { MedicineListComponent } from '../medicine/medicine-list/medicine-list.component';
import { LabListComponent } from '../lab/lab-list/lab-list.component';
import { PatientTokenComponent } from '../patient-token/patient-token.component';
import { PaymentComponent } from '../payment/payment.component';
import { OtlistComponent } from '../otlist/otlist.component';
import { PrescriptionListComponent } from '../precipion/prescription-list.component';
import { ProceduresComponent } from '../procedures/procedures.component';
import { PatientService } from 'src/app/Services/patient.service';
import { OpdService } from 'src/app/Services/opd.service';
import { InpatientService } from 'src/app/Services/inpatient.service';
import { MedicineService } from 'src/app/Services/medicine.service';
import { LabService } from 'src/app/Services/lab.service';
import { OtMedicineService } from 'src/app/Services/ot-medicine.service';
import { PrescriptionService } from 'src/app/Services/prescription.service';
import { ProcedureService } from 'src/app/Services/procedure.service';
import { UserLoginService } from 'src/app/Services/user-login.service';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { ScrollPaginationDirective } from 'src/app/Shared/scroll-pagination.directive';
import { ScrollListFooterComponent } from 'src/app/Shared/scroll-list-footer.component';
import { TimeFormatPipe } from 'src/app/Pipes/time-format.pipe';
import { emptyPrescription } from 'src/app/Models/prescription.model';
import { memoryDb } from 'src/app/testing/memory-db';
import { RecordPreviewDirective } from './record-preview.directive';
import { RecordDetailsComponent } from './record-details.component';
import { RoomSelectComponent } from '../rooms/room-select.component';
import { RoomsComponent } from '../rooms/rooms.component';
import { RoomService, DEFAULT_ROOMS } from 'src/app/Services/room.service';
import { MedicineCatalogComponent } from '../precipion/medicine-catalog/medicine-catalog.component';

describe('Preview actions in every record list', () => {
  const clinical = [PatientListComponent, OpdListComponent, InpatientListComponent, MedicineListComponent, LabListComponent];
  const others = [PatientTokenComponent, PaymentComponent, OtlistComponent, PrescriptionListComponent, ProceduresComponent, RoomsComponent, MedicineCatalogComponent];
  let dialog: jasmine.SpyObj<MatDialog>;
  let role: string;
  let db: SupabaseDataService;
  let fullRecord: any;

  beforeEach(async () => {
    role = 'staff';
    const memory = memoryDb(); db = memory.db;
    const now = new Date();
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const record = { ...emptyPrescription(), id: '1', patientId: 1, inpatientId: 1, medicineId: 1, name: 'Patient on list', patientName: 'Patient on list',
      amount: 100, cashGiven: 100, cashReturn: 0, paymentMethod: 'cash', paymentStatus: 'completed', phone: '', contact: '', roomNo: '', gender: '',
      date, time: '10:30 AM', dateTime: now.toISOString(), createdAt: now.toISOString(), admissionDate: date, dischargeDate: null,
      medicines: [{ name: 'Medicine A', medicineName: 'Medicine A', quantity: 2, morning: true, afternoon: false, evening: true }],
      products: [{ name: 'Medicine A', quantity: 2 }], active: true, sequence: 1, tokenNumber: 'A001', customerName: 'Patient on list' };
    fullRecord = { ...record, address: 'Complete saved address', firstName: 'Full patient details' };
    (db.getItem as jasmine.Spy).and.resolveTo([record]);
    (db as any).getAllPatientTokens = jasmine.createSpy().and.resolveTo([{ ...record, id: 1 }]);
    const service = { getAllPatient: () => of([record]), getAllOpds: () => of([record]), getAllInpatient: () => of([record]), getAllMedicine: () => of([record]), getAllLabPatient: () => of([record]),
      getPatientDetails: () => of(fullRecord), getOpdDetails: () => of(fullRecord), getInpatientDetails: () => of(fullRecord), getMedicineDetails: () => of(fullRecord), getLabPatientDetails: () => of(fullRecord),
      getAll: async () => [record] };
    dialog = jasmine.createSpyObj<MatDialog>('dialog', ['open']);
    await TestBed.configureTestingModule({
      imports: [FeedbackModule, CommonModule, FormsModule, ReactiveFormsModule, NoopAnimationsModule, RouterTestingModule, MatDialogModule,
        MatTableModule, MatCardModule, MatInputModule, MatButtonModule, MatIconModule, MatSelectModule, MatPaginatorModule],
      declarations: [...clinical, ...others, ScrollPaginationDirective, ScrollListFooterComponent, TimeFormatPipe, RecordPreviewDirective, RoomSelectComponent],
      providers: [
        ...[PatientService, OpdService, InpatientService, MedicineService, LabService, OtMedicineService, PrescriptionService, ProcedureService].map(provide => ({ provide, useValue: service })),
        { provide: SupabaseDataService, useValue: db }, { provide: MatDialog, useValue: dialog },
        { provide: RoomService, useValue: { getAll: async () => DEFAULT_ROOMS } },
        { provide: UserLoginService, useValue: { getLoginUser: async () => role, getStaffIdentity: async () => ({ id: 'preview-staff', name: 'Staff', email: 'staff@example.test' }) } },
      ],
    }).compileComponents();
  });

  for (const type of [...clinical, ...others]) {
    for (const account of clinical.includes(type as any) ? ['staff', 'admin'] : ['staff']) {
      it(`opens the saved record from ${type.name} for ${account}`, async () => {
        role = account;
        const fixture = TestBed.createComponent(type as any);
        try {
          fixture.detectChanges(); await new Promise(resolve => setTimeout(resolve, 40)); fixture.detectChanges();
          const root: HTMLElement = fixture.nativeElement;
          const preview = root.querySelector<HTMLButtonElement>('button[aria-label^="Preview"]');
          expect(preview).withContext(type.name).not.toBeNull();
          expect(preview!.disabled).toBeFalse();
          preview!.click(); await Promise.resolve(); await Promise.resolve();
          expect(dialog.open).toHaveBeenCalledTimes(1);
          const data = dialog.open.calls.mostRecent().args[1]!.data as any;
          expect(data.record).toBeDefined();
          if (clinical.includes(type as any)) {
            expect(dialog.open.calls.mostRecent().args[0]).toBe(RecordDetailsComponent);
            expect(data.record.address).toBe('Complete saved address');
            expect(root.querySelectorAll('button[aria-label^="Edit"]').length).toBe(account === 'admin' ? 1 : 0);
            expect(root.querySelectorAll('button[aria-label^="Delete"]').length).toBe(account === 'admin' ? 1 : 0);
          }
          expect(db.upsertRecord).not.toHaveBeenCalled(); expect(db.deleteRecord).not.toHaveBeenCalled(); expect(db.setItem).not.toHaveBeenCalled();
        } finally { fixture.destroy(); }
      });
    }
  }
});
