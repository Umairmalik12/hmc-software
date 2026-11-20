import { SearchableSelectComponent } from 'src/app/Shared/searchable-select.component';
import { ClinicalCatalogSelectComponent } from 'src/app/Components/clinical-catalog/clinical-catalog-select.component';
import { ClinicalCatalogService, DEFAULT_LAB_TESTS } from 'src/app/Services/clinical-catalog.service';
import { Subject as ClinicalChanges } from 'rxjs';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { of } from 'rxjs';
import { InpatientEditComponent } from './inpatient-edit/inpatient-edit.component';
import { InpatientListComponent } from './inpatient-list/inpatient-list.component';
import { ProcedureSelectComponent } from '../procedures/procedure-select.component';
import { InpatientService } from '../../Services/inpatient.service';
import { ProcedureService } from '../../Services/procedure.service';
import { UserLoginService } from '../../Services/user-login.service';
import { SupabaseDataService } from '../../Services/supabase-data.service';
import { InPatient } from '../../Models/inpatient.model';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FeedbackModule } from '../../Shared/feedback.module';
import { ScrollPaginationDirective } from '../../Shared/scroll-pagination.directive';
import { ScrollListFooterComponent } from '../../Shared/scroll-list-footer.component';
import { memoryDb } from '../../testing/memory-db';

describe('Inpatient registration and filters', () => {
  let db: SupabaseDataService;
  let procedures: jasmine.SpyObj<ProcedureService>;
  let close: jasmine.Spy;
  let rows: InPatient[];
  const settle = async (fixture: ComponentFixture<unknown>) => { fixture.detectChanges(); await new Promise(resolve => setTimeout(resolve, 40)); fixture.detectChanges(); };
  beforeEach(async () => {
    db = memoryDb().db; close = jasmine.createSpy('close');
    rows = Array.from({ length: 45 }, (_, index) => ({ inpatientId: 8000 + index, patientName: 'Patient ' + index, surgeonName: '', admissionDate: '', dischargeDate: '', procedure: index === 44 ? 'Archived procedure' : index % 2 ? 'Cystoscopy' : 'Right nephrectomy', createdAt: new Date().toISOString() }));
    procedures = jasmine.createSpyObj<ProcedureService>('procedures', ['getAll']);
    procedures.getAll.and.resolveTo([{ id: '1', name: 'Cystoscopy', active: true }, { id: '2', name: 'Right nephrectomy', active: true }, { id: '3', name: 'Database procedure', active: true }]);
    await TestBed.configureTestingModule({
      imports: [SearchableSelectComponent, ClinicalCatalogSelectComponent, FeedbackModule, CommonModule, FormsModule, ReactiveFormsModule, NoopAnimationsModule, MatDialogModule, MatInputModule, MatSelectModule, MatIconModule, MatButtonModule, MatTableModule, MatPaginatorModule, MatDatepickerModule, MatNativeDateModule],
      declarations: [InpatientEditComponent, InpatientListComponent, ProcedureSelectComponent, ScrollPaginationDirective, ScrollListFooterComponent],
      providers: [{ provide: ClinicalCatalogService, useValue: { changes: new ClinicalChanges<string>(), getAll: async (kind: string) => kind === 'lab-tests' ? DEFAULT_LAB_TESTS : [] } }, { provide: MAT_DIALOG_DATA, useValue: {} }, { provide: MatDialogRef, useValue: { close } }, { provide: ProcedureService, useValue: procedures }, { provide: SupabaseDataService, useValue: db },
        { provide: InpatientService, useValue: { getAllInpatient: () => of(rows) } }, { provide: UserLoginService, useValue: { getLoginUser: async () => 'admin' } }],
    }).compileComponents();
  });

  it('accepts an entered patient ID and catalogue procedure without requiring discharge details or showing the note', async () => {
    const fixture = TestBed.createComponent(InpatientEditComponent);
    try {
      await settle(fixture); const root = fixture.nativeElement as HTMLElement;
      expect(root.textContent).not.toContain('Only the patient name is required.');
      expect(root.textContent).not.toContain('Auto-assigned');
      const id = root.querySelector<HTMLInputElement>('input[formControlName="inpatientId"]')!;
      expect(id.value).toBe(''); expect(id.readOnly).toBeFalse(); expect(id.required).toBeTrue();
      expect(id.placeholder).toBe('Enter Patient ID');
      fixture.componentInstance.onSubmit(); expect(close).not.toHaveBeenCalled();
      id.value = '8123'; id.dispatchEvent(new Event('input', { bubbles: true }));
      const name = root.querySelector<HTMLInputElement>('input[formControlName="patientName"]')!;
      name.value = '  Ali  '; name.dispatchEvent(new Event('input', { bubbles: true }));
      const select = fixture.debugElement.query(By.css('app-procedure-select app-searchable-select')).componentInstance as SearchableSelectComponent;
      select.open(); fixture.detectChanges();
      Array.from(document.querySelectorAll<HTMLElement>('mat-option')).find(option => (option.querySelector('.hmc-option-label')?.textContent || option.textContent)?.trim() === 'Cystoscopy')!.click();
      await settle(fixture); fixture.componentInstance.onSubmit();
      expect(close).toHaveBeenCalledWith(jasmine.objectContaining({ inpatientId: 8123, patientName: 'Ali', procedure: 'Cystoscopy', dischargeDate: null }));
    } finally { fixture.destroy(); }
  });

  it('loads existing IDs, saved historical procedures and dates for editing', async () => {
    const saved = { ...rows[44], patientName: 'Existing patient', admissionDate: '2026-11-20', createdAt: '2026-11-20T08:00:00Z' };
    TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: saved });
    const fixture = TestBed.createComponent(InpatientEditComponent);
    try {
      await settle(fixture);
      const id = fixture.nativeElement.querySelector('input[formControlName="inpatientId"]') as HTMLInputElement;
      expect(id.readOnly).toBeTrue(); expect(id.value).toBe(String(saved.inpatientId));
      expect((fixture.nativeElement.querySelector('input[aria-label="Procedure"]') as HTMLInputElement).value).toBe('Archived procedure');
      fixture.componentInstance.c.patientName.setValue('Updated patient');
      fixture.componentInstance.onSubmit();
      expect(close).toHaveBeenCalledWith(jasmine.objectContaining({ inpatientId: saved.inpatientId, patientName: 'Updated patient', procedure: 'Archived procedure', createdAt: saved.createdAt }));
      const result = close.calls.mostRecent().args[0];
      expect(new Date(result.admissionDate).getDate()).toBe(20); expect(result.dischargeDate).toBeNull();
    } finally { fixture.destroy(); }
  });

  it('loads procedure choices from the catalogue and applies exact procedure and entered patient ID filters across all rows', async () => {
    const fixture = TestBed.createComponent(InpatientListComponent);
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
      await choose('Cystoscopy'); expect(component.total).toBe(22); expect(component.displayedInpatients.length).toBe(20);
      expect(component.filteredInpatients.every(patient => patient.procedure === 'Cystoscopy')).toBeTrue();
      component.loadMore(); expect(component.displayedInpatients.length).toBe(22);
      await choose('All Procedures'); expect(component.total).toBe(45); expect(component.displayedInpatients.length).toBe(20);
      const mr = fixture.nativeElement.querySelector('input[aria-label="Patient ID"]') as HTMLInputElement;
      expect(mr.placeholder).toBe('Patient ID');
      mr.value = '8031'; mr.dispatchEvent(new Event('input', { bubbles: true })); await settle(fixture);
      expect(component.filteredInpatients.map(patient => patient.inpatientId)).toEqual([8031]);
      await choose('Cystoscopy'); expect(component.total).toBe(1);
      await choose('Right nephrectomy'); expect(component.total).toBe(0);
      await choose('All Procedures'); expect(component.total).toBe(1);
      component.onClearSearch(); expect(component.total).toBe(45);
      (component.inpatient[0] as InPatient & { id: number }).id = 123456;
      component.searchInpatientId = '123456'; component.onSearch(); expect(component.total).toBe(0);
      component.onClearSearch();
      procedures.getAll.and.resolveTo([{ id: 'new', name: 'New database procedure', active: true }]); db.changes.next('procedures'); await settle(fixture);
      expect(component.procedureFilterOptions).toContain('New database procedure'); expect(component.procedureFilterOptions).toContain('Archived procedure');
      procedures.getAll.and.rejectWith(new Error('Offline')); await component.loadProcedures();
      expect(component.proceduresFailed).toBeTrue(); expect(component.total).toBe(45);
    } finally { fixture.destroy(); }
  });
});
