import { DateTimeFieldComponent } from 'src/app/Shared/date-time-field.component';
import { SearchableSelectComponent } from 'src/app/Shared/searchable-select.component';
import { ClinicalCatalogSelectComponent } from 'src/app/Components/clinical-catalog/clinical-catalog-select.component';
import { ClinicalCatalogService, DEFAULT_LAB_TESTS } from 'src/app/Services/clinical-catalog.service';
import { Subject as ClinicalChanges } from 'rxjs';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { of } from 'rxjs';
import { PatientEditComponent } from './patient-edit/patient-edit.component';
import { PatientListComponent } from './patient-list/patient-list.component';
import { ProcedureSelectComponent } from '../procedures/procedure-select.component';
import { PatientService } from '../../Services/patient.service';
import { ProcedureService } from '../../Services/procedure.service';
import { UserLoginService } from '../../Services/user-login.service';
import { SupabaseDataService } from '../../Services/supabase-data.service';
import { Patient } from '../../Models/patient.model';
import { FeedbackModule } from '../../Shared/feedback.module';
import { ScrollPaginationDirective } from '../../Shared/scroll-pagination.directive';
import { ScrollListFooterComponent } from '../../Shared/scroll-list-footer.component';
import { memoryDb } from '../../testing/memory-db';

describe('Operation patient registration and filters', () => {
  let db: SupabaseDataService;
  let procedures: jasmine.SpyObj<ProcedureService>;
  let close: jasmine.Spy;
  let rows: Patient[];
  const settle = async (fixture: ComponentFixture<unknown>) => { fixture.detectChanges(); await new Promise(resolve => setTimeout(resolve, 40)); fixture.detectChanges(); };
  beforeEach(async () => {
    db = memoryDb().db; close = jasmine.createSpy('close');
    rows = Array.from({ length: 45 }, (_, index) => ({ patientId: 8000 + index, name: 'Patient ' + index, contact: '', drName: '', gender: 'Male', age: 30, maritalStatus: '', city: '', address: '', procedure: index === 44 ? 'Archived procedure' : index % 2 ? 'Cystoscopy' : 'Right nephrectomy', createdAt: new Date().toISOString() }));
    procedures = jasmine.createSpyObj<ProcedureService>('procedures', ['getAll']);
    procedures.getAll.and.resolveTo([{ id: '1', name: 'Cystoscopy', active: true }, { id: '2', name: 'Right nephrectomy', active: true }, { id: '3', name: 'Database procedure', active: true }]);
    await TestBed.configureTestingModule({
      imports: [DateTimeFieldComponent, SearchableSelectComponent, ClinicalCatalogSelectComponent, FeedbackModule, CommonModule, FormsModule, ReactiveFormsModule, NoopAnimationsModule, MatDialogModule, MatInputModule, MatSelectModule, MatIconModule, MatButtonModule, MatTableModule, MatPaginatorModule],
      declarations: [PatientEditComponent, PatientListComponent, ProcedureSelectComponent, ScrollPaginationDirective, ScrollListFooterComponent],
      providers: [{ provide: ClinicalCatalogService, useValue: { changes: new ClinicalChanges<string>(), getAll: async (kind: string) => kind === 'lab-tests' ? DEFAULT_LAB_TESTS : [] } }, { provide: MAT_DIALOG_DATA, useValue: {} }, { provide: MatDialogRef, useValue: { close } }, { provide: ProcedureService, useValue: procedures }, { provide: SupabaseDataService, useValue: db },
        { provide: PatientService, useValue: { getAllPatient: () => of(rows) } }, { provide: UserLoginService, useValue: { getLoginUser: async () => 'admin' } }],
    }).compileComponents();
  });

  it('requires the entered MR, removes the note, offers only Male/Female and saves numeric Age', async () => {
    const fixture = TestBed.createComponent(PatientEditComponent);
    try {
      await settle(fixture); const root = fixture.nativeElement as HTMLElement;
      expect(root.textContent).not.toContain('Only the patient name is required.');
      const mr = root.querySelector<HTMLInputElement>('input[formControlName="patientId"]')!;
      expect(mr.value).toBe(''); expect(mr.placeholder).toBe('Enter MR Number'); expect(mr.required).toBeTrue();
      fixture.componentInstance.onSubmit(); expect(close).not.toHaveBeenCalled();
      const gender = fixture.debugElement.query(By.css('mat-select[formControlName="gender"]')).componentInstance as MatSelect;
      gender.open(); fixture.detectChanges();
      const options = Array.from(document.querySelectorAll<HTMLElement>('mat-option'));
      expect(options.map(option => option.textContent?.trim())).toEqual(['Male', 'Female']);
      options[1].click(); await settle(fixture);
      const name = root.querySelector<HTMLInputElement>('input[formControlName="firstName"]')!;
      name.value = 'Ali'; name.dispatchEvent(new Event('input', { bubbles: true }));
      mr.value = '8123'; mr.dispatchEvent(new Event('input', { bubbles: true }));
      const age = root.querySelector<HTMLInputElement>('input[formControlName="age"]')!;
      expect(age.placeholder).toBe('Age'); expect(age.type).toBe('number');
      age.value = '30'; age.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.componentInstance.onSubmit();
      expect(close).toHaveBeenCalledWith(jasmine.objectContaining({ patientId: 8123, firstName: 'Ali', gender: 'Female', age: 30 }));
    } finally { fixture.destroy(); }
  });

  it('edits Registered on through date and time pickers and saves the selected timestamp', async () => {
    const fixture = TestBed.createComponent(PatientEditComponent);
    try {
      await settle(fixture); const editor = fixture.componentInstance;
      const field = fixture.debugElement.query(By.directive(DateTimeFieldComponent)).componentInstance as DateTimeFieldComponent;
      expect(editor.b.createdAt.value).toBe(''); expect(field.date).toBeNull(); expect(field.time).toBe('');
      editor.b.patientId.setValue(8123); editor.c.firstName.setValue('Ali');
      (fixture.nativeElement.querySelector('[aria-label="Registered on date"]') as HTMLInputElement).click(); await settle(fixture);
      expect(document.querySelector('mat-calendar')).not.toBeNull();
      field.calendar?.close(); field.selectDate(new Date(2020, 0, 2)); await settle(fixture);
      editor.onSubmit(); expect(close).not.toHaveBeenCalled(); expect(editor.patientForm.invalid).toBeTrue();
      field.openTime(); await settle(fixture); TestBed.inject(MatDialog).openDialogs[0].close('00:05'); await settle(fixture);
      expect(editor.b.createdAt.value).toBe('2020-01-02T00:05'); editor.onSubmit();
      expect(close).toHaveBeenCalledWith(jasmine.objectContaining({ createdAt: new Date('2020-01-02T00:05').toISOString() }));
      expect(fixture.nativeElement.scrollWidth).toBeLessThanOrEqual(fixture.nativeElement.clientWidth + 1);
    } finally { fixture.destroy(); }
  });

  it('loads procedure choices from the catalogue and applies exact procedure and actual MR filters across all rows', async () => {
    rows[1].drName = 'Dr Roman'; rows[31].drName = 'Dr Roman'; rows[2].contact = 'Dr Roman';
    const fixture = TestBed.createComponent(PatientListComponent);
    try {
      await settle(fixture); const component = fixture.componentInstance;
      const select = fixture.debugElement.query(By.css('app-searchable-select.catalog-filter')).componentInstance as SearchableSelectComponent;
      const choose = async (name: string) => {
        select.open(); fixture.detectChanges();
        const option = Array.from(document.querySelectorAll<HTMLElement>('mat-option')).find(item => (item.querySelector('.hmc-option-label')?.textContent || item.textContent)?.trim() === name)!;
        expect(option).toBeDefined(); option.click(); await settle(fixture);
      };
      select.open(); fixture.detectChanges();
      expect(document.body.textContent).toContain('All Procedures'); expect(document.body.textContent).toContain('Database procedure'); expect(document.body.textContent).toContain('Archived procedure');
      select.close(); await settle(fixture);
      await choose('Cystoscopy'); expect(component.total).toBe(22); expect(component.displayedPatients.length).toBe(20);
      expect(component.filteredPatients.every(patient => patient.procedure === 'Cystoscopy')).toBeTrue();
      component.loadMore(); expect(component.displayedPatients.length).toBe(22);
      await choose('All Procedures'); expect(component.total).toBe(45); expect(component.displayedPatients.length).toBe(20);
      const mr = fixture.nativeElement.querySelector('input[aria-label="MR Number"]') as HTMLInputElement;
      expect(mr.placeholder).toBe('MR Number');
      mr.value = '8001'; mr.dispatchEvent(new Event('input', { bubbles: true })); await settle(fixture);
      expect(component.filteredPatients.map(patient => patient.patientId)).toEqual([8001]);
      component.onClearSearch(); expect(component.total).toBe(45);
      const doctor = fixture.debugElement.query(By.css('app-clinical-select app-searchable-select')).componentInstance as SearchableSelectComponent;
      expect(doctor).toBeDefined(); expect(fixture.nativeElement.querySelector('input[placeholder="Search by Phone"]')).toBeNull();
      doctor.open(); fixture.detectChanges();
      Array.from(document.querySelectorAll<HTMLElement>('mat-option')).find(option => (option.querySelector('.hmc-option-label')?.textContent || option.textContent)?.trim() === 'Dr Roman')!.click();
      await settle(fixture);
      expect(component.filteredPatients.map(patient => patient.patientId)).toEqual([8001, 8031]);
      await choose('Right nephrectomy'); expect(component.total).toBe(0);
      await choose('Cystoscopy'); expect(component.total).toBe(2);
      mr.value = '8031'; mr.dispatchEvent(new Event('input', { bubbles: true })); await settle(fixture);
      expect(component.filteredPatients.map(patient => patient.patientId)).toEqual([8031]);
      component.onClearSearch(); await settle(fixture);
      expect(doctor.value).toBe(''); expect(component.total).toBe(45); expect(component.displayedPatients.length).toBe(20);
      (component.patient[0] as Patient & { id: number }).id = 123456;
      component.searchPatientId = '123456'; component.onSearch(); expect(component.total).toBe(0);
      component.onClearSearch();
      procedures.getAll.and.resolveTo([{ id: 'new', name: 'New database procedure', active: true }]); db.changes.next('procedures'); await settle(fixture);
      expect(component.procedureFilterOptions).toContain('New database procedure'); expect(component.procedureFilterOptions).toContain('Archived procedure');
      procedures.getAll.and.rejectWith(new Error('Offline')); await component.loadProcedures();
      expect(component.proceduresFailed).toBeTrue(); expect(component.total).toBe(45);
    } finally { fixture.destroy(); }
  });
});
