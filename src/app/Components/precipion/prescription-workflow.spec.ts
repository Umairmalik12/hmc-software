import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { HomeComponent } from '../home/home.component';
import { PreciptionComponent } from './precipion.component';
import { PrescriptionListComponent } from './prescription-list.component';
import { PrescriptionMedicineSelectComponent } from './medicine-catalog/prescription-medicine-select.component';
import { PrescriptionService } from '../../Services/prescription.service';
import { SupabaseDataService } from '../../Services/supabase-data.service';
import { PatientService } from '../../Services/patient.service';
import { OpdService } from '../../Services/opd.service';
import { LabService } from '../../Services/lab.service';
import { InpatientService } from '../../Services/inpatient.service';
import { MedicineService } from '../../Services/medicine.service';
import { UserLoginService } from '../../Services/user-login.service';
import { FeedbackModule } from '../../Shared/feedback.module';
import { DateTimeFieldComponent } from '../../Shared/date-time-field.component';
import { ScrollPaginationDirective } from '../../Shared/scroll-pagination.directive';
import { ScrollListFooterComponent } from '../../Shared/scroll-list-footer.component';
import { memoryDb } from '../../testing/memory-db';
import { emptyPrescription } from '../../Models/prescription.model';
import { of } from 'rxjs';

@Component({ template: '<router-outlet></router-outlet>' })
class PrescriptionRouterHost {}

describe('Routed prescription Add, Edit and admin Delete', () => {
  let fixture: ComponentFixture<PrescriptionRouterHost>, store: ReturnType<typeof memoryDb>, router: Router;
  let opdService: jasmine.SpyObj<OpdService>;
  const settle = async () => { for (let step = 0; step < 3; step++) { fixture.detectChanges(); await new Promise(resolve => setTimeout(resolve, 25)); } fixture.detectChanges(); };
  const navigate = async (url: string) => { await router.navigateByUrl(url); await settle(); };
  const editor = () => fixture.debugElement.query(By.directive(PreciptionComponent)).componentInstance as PreciptionComponent;
  const type = (selector: string, value: string) => { const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement; input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('blur')); };
  beforeEach(async () => {
    store = memoryDb();
    opdService = jasmine.createSpyObj<OpdService>('opd', ['getOpdDetails']);
    opdService.getOpdDetails.and.returnValue(of({ visitId: 'opd-visit-a', patientId: 8123, patientName: 'Ali Khan', age: 35, sex: 'Male', phone: '03001234567', drName: 'Dr Haq', history: 'Burning urination', date: '2026-11-22', time: '14:35' } as any));
    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, NoopAnimationsModule, DateTimeFieldComponent, FeedbackModule, MatSidenavModule, MatToolbarModule, MatListModule, MatMenuModule, MatDialogModule, MatButtonModule, MatIconModule, MatInputModule, MatAutocompleteModule,
        RouterTestingModule.withRoutes([
          { path: 'prescriptions/new', component: HomeComponent, data: { dashboardView: 'prescription' } },
          { path: 'prescriptions/:prescriptionId/edit', component: HomeComponent, data: { dashboardView: 'prescription' } },
          { path: 'prescriptions', component: HomeComponent, data: { dashboardView: 'prescription-list' } },
        ])],
      declarations: [PrescriptionRouterHost, HomeComponent, PreciptionComponent, PrescriptionListComponent, PrescriptionMedicineSelectComponent, ScrollPaginationDirective, ScrollListFooterComponent], schemas: [NO_ERRORS_SCHEMA],
      providers: [...[PatientService, LabService, InpatientService, MedicineService].map(provide => ({ provide, useValue: {} })), { provide: OpdService, useValue: opdService }, { provide: SupabaseDataService, useValue: store.db }, { provide: UserLoginService, useValue: { getLoginUser: async () => 'admin' } }],
    }).compileComponents();
    router = TestBed.inject(Router); fixture = TestBed.createComponent(PrescriptionRouterHost); fixture.detectChanges();
  });
  afterEach(() => { TestBed.inject(MatDialog).closeAll(); fixture.destroy(); });

  it('uses the same complete editor for Add and Edit, saves to the same ID and deletes after admin confirmation', async () => {
    await navigate('/prescriptions/new');
    const root: HTMLElement = fixture.nativeElement;
    const labels = () => Array.from(root.querySelectorAll('.rx-cell-label')).map(label => label.textContent);
    const newLabels = labels(), newWidth = root.querySelector('.rx-editor-paper')!.getBoundingClientRect().width;
    expect(root.querySelector('.prescription-editor h1')!.textContent).toBe('New prescription');
    type('input[aria-label="Patient name"]', 'Ali Khan'); type('app-prescription-medicine-select input', '2SUM 1g');
    editor().record.issuedAt = '2020-01-02T00:05'; root.querySelector<HTMLInputElement>('input[aria-label="Morning, medicine 1"]')!.click(); await settle();
    expect(await editor().save()).toBeTrue(); await settle();
    expect(router.url).toBe('/prescriptions'); const saved = (await TestBed.inject(PrescriptionService).getAll())[0];
    expect(saved.patient.name).toBe('Ali Khan'); expect(saved.medicines[0].name).toBe('2SUM 1g');
    const editLink = root.querySelector<HTMLAnchorElement>('[aria-label="Edit prescription"]')!; expect(editLink.getAttribute('href')).toBe('/prescriptions/' + saved.id + '/edit');
    await navigate(editLink.getAttribute('href')!);
    expect(editor().prescriptionId).toBe(saved.id); expect(editor().isEditing).toBeTrue();
    expect(root.querySelector('.prescription-editor h1')!.textContent).toBe('Edit prescription'); expect(labels()).toEqual(newLabels);
    expect(Math.abs(root.querySelector('.rx-editor-paper')!.getBoundingClientRect().width - newWidth)).toBeLessThanOrEqual(1);
    expect((root.querySelector('input[aria-label="Patient name"]') as HTMLInputElement).value).toBe('Ali Khan');
    expect((root.querySelector('app-prescription-medicine-select input') as HTMLInputElement).value).toBe('2SUM 1g');
    expect(root.querySelector<HTMLInputElement>('input[aria-label="Morning, medicine 1"]')!.checked).toBeTrue();
    expect(root.querySelector('.rx-medicine-tools')!.textContent).toContain('Add medicine'); expect(root.querySelectorAll('app-date-time-field').length).toBe(1);
    type('input[aria-label="Patient name"]', 'Updated Ali'); type('app-prescription-medicine-select input', '2SUM 2g'); await settle();
    expect(await editor().save()).toBeTrue(); await settle(); const updated = await TestBed.inject(PrescriptionService).getAll();
    expect(updated.length).toBe(1); expect(updated[0].id).toBe(saved.id); expect(updated[0].patient.name).toBe('Updated Ali'); expect(updated[0].medicines[0].name).toBe('2SUM 2g'); expect(updated[0].issuedAt).toBe(saved.issuedAt);
    const list = fixture.debugElement.query(By.directive(PrescriptionListComponent)).componentInstance as PrescriptionListComponent;
    spyOn(window, 'confirm').and.returnValue(true); await list.delete(list.records[0]); await settle();
    expect(store.collections.get('prescriptions')!.size).toBe(0); expect(list.records.length).toBe(0); expect(root.textContent).toContain('No prescriptions saved yet.');
  });

  it('reloads when moving between edit URLs and clears all saved fields when returning to Add', async () => {
    const first = { ...emptyPrescription(), id: '1' }, second = { ...emptyPrescription(), id: '2' }; first.patient.name = 'First patient'; second.patient.name = 'Second patient';
    store.collections.set('prescriptions', new Map([['1', first], ['2', second]]));
    await navigate('/prescriptions/1/edit'); expect(editor().record.patient.name).toBe('First patient');
    await navigate('/prescriptions/2/edit'); expect(editor().record.id).toBe('2'); expect(editor().record.patient.name).toBe('Second patient');
    await navigate('/prescriptions/new'); expect(editor().record.id).toBe(''); expect(editor().record.patient.name).toBe(''); expect(editor().isEditing).toBeFalse();
  });

  it('prefills only matching fields from the selected OPD visit and leaves unavailable clinical fields blank', async () => {
    await navigate('/prescriptions/new?opdVisitId=opd-visit-a');
    const form = editor().record;
    expect(opdService.getOpdDetails).toHaveBeenCalledWith('opd-visit-a');
    expect(form.opdVisitId).toBe('opd-visit-a'); expect(form.doctorName).toBe('Dr Haq');
    expect(form.patient.refId).toBe('8123'); expect(form.patient.visit).toBe('opd-visit-a');
    expect(form.patient.name).toBe('Ali Khan'); expect(form.patient.age).toBe('35'); expect(form.patient.sex).toBe('Male');
    expect(form.patient.contact).toBe('03001234567'); expect(form.patient.symptoms).toBe('Burning urination');
    expect(form.patient.weight).toBe(''); expect(form.patient.allergies).toBe(''); expect(form.patient.findings).toBe(''); expect(form.patient.diagnosis).toBe('');
  });
});
