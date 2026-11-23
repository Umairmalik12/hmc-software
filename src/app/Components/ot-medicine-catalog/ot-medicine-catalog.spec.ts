import { DateTimeFieldComponent } from '../../Shared/date-time-field.component';
import { SearchableSelectComponent } from 'src/app/Shared/searchable-select.component';
import { ClinicalCatalogSelectComponent } from 'src/app/Components/clinical-catalog/clinical-catalog-select.component';
import { ClinicalCatalogService, DEFAULT_LAB_TESTS } from 'src/app/Services/clinical-catalog.service';
import { Subject as ClinicalChanges } from 'rxjs';
import { FeedbackModule } from 'src/app/Shared/feedback.module';
import { ApplicationRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { OtMedicineCatalogComponent } from './ot-medicine-catalog.component';
import { OtMedicineEditComponent } from './ot-medicine-edit.component';
import { OtMedicineDeleteComponent } from './ot-medicine-delete.component';
import { OtMedicineCatalogService } from '../../Services/ot-medicine-catalog.service';
import { SupabaseDataService } from '../../Services/supabase-data.service';
import { ScrollPaginationDirective } from '../../Shared/scroll-pagination.directive';
import { ScrollListFooterComponent } from '../../Shared/scroll-list-footer.component';
import { RecordPreviewDirective } from '../record-details/record-preview.directive';
import { RecordDetailsComponent } from '../record-details/record-details.component';
import { memoryDb } from '../../testing/memory-db';
import { OtFormComponent } from '../otslip/otslip.component';
import { ProcedureSelectComponent } from '../procedures/procedure-select.component';
import { ProcedureService } from '../../Services/procedure.service';
import { emptyOtCatalogMedicine } from '../../Models/ot-medicine-catalog.model';

describe('OT medicine catalogue interface', () => {
  let store: ReturnType<typeof memoryDb>;
  const settle = async () => { TestBed.inject(ApplicationRef).tick(); await new Promise(resolve => setTimeout(resolve, 40)); TestBed.inject(ApplicationRef).tick(); };
  const action = (label: string): HTMLButtonElement => Array.from(document.querySelectorAll<HTMLButtonElement>('.hmc-dialog-panel mat-dialog-actions button')).find(button => button.textContent?.trim().endsWith(label))!;
  beforeEach(async () => {
    store = memoryDb();
    await TestBed.configureTestingModule({
      imports: [DateTimeFieldComponent, SearchableSelectComponent, ClinicalCatalogSelectComponent, FeedbackModule, CommonModule, FormsModule, ReactiveFormsModule, NoopAnimationsModule, RouterTestingModule, MatAutocompleteModule, MatDialogModule, MatInputModule, MatButtonModule, MatIconModule, MatSelectModule, MatCheckboxModule, MatCardModule],
      declarations: [OtMedicineCatalogComponent, OtMedicineEditComponent, OtMedicineDeleteComponent, ScrollPaginationDirective, ScrollListFooterComponent, RecordPreviewDirective, RecordDetailsComponent, OtFormComponent, ProcedureSelectComponent],
      providers: [{ provide: ClinicalCatalogService, useValue: { changes: new ClinicalChanges<string>(), getAll: async (kind: string) => kind === 'lab-tests' ? DEFAULT_LAB_TESTS : [] } }, { provide: SupabaseDataService, useValue: store.db }, { provide: ProcedureService, useValue: { getAll: async () => [] } }],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it('adds a strength through the row action while keeping the source medicine and details intact', async () => {
    const catalog = TestBed.inject(OtMedicineCatalogService);
    const original = await catalog.save({ ...emptyOtCatalogMedicine(), name: '2SUM', strength: '1g', genericName: 'Saved generic', category: 'Saved category', type: 'Injection', unit: 'Vial' });
    const fixture = TestBed.createComponent(OtMedicineCatalogComponent);
    try {
      fixture.detectChanges(); await settle(); fixture.componentInstance.query = '2SUM'; fixture.detectChanges();
      fixture.nativeElement.querySelector('button[aria-label="Add OT medicine strength"]').click(); await settle();
      const editor = TestBed.inject(MatDialog).openDialogs[0].componentInstance as OtMedicineEditComponent;
      expect(editor.data.id).toBeUndefined(); expect(editor.form.value.name).toBe('2SUM'); expect(editor.form.value.genericName).toBe('Saved generic'); expect(editor.form.value.strength).toBe('');
      await editor.save(); expect(TestBed.inject(MatDialog).openDialogs.length).toBe(1); editor.form.controls.strength.setValue('2 g'); await editor.save(); await settle();
      expect((await catalog.getById(original.id))!.strength).toBe('1g');
      const variants = (await catalog.getAll()).filter(item => item.name === '2SUM'); expect(variants.length).toBe(2); expect(variants.find(item => item.id !== original.id)!.unit).toBe('Vial');
    } finally { fixture.destroy(); }
  });
  it('adds and edits medicine details through the form, keeps only name required and fits the dialog on screen', async () => {
    const fixture = TestBed.createComponent(OtMedicineCatalogComponent);
    try {
      fixture.detectChanges(); await settle(); fixture.detectChanges();
      fixture.componentInstance.edit(); await settle();
      const dialog = TestBed.inject(MatDialog).openDialogs[0]; const editor = dialog.componentInstance as OtMedicineEditComponent;
      expect(editor.form.invalid).toBeTrue(); editor.form.patchValue({ name: 'UI medicine' }); expect(editor.form.valid).toBeTrue();
      editor.form.patchValue({ genericName: 'UI generic', category: 'Anaesthesia', type: 'Injection', strength: '10mg/ml', unit: 'Vial', description: 'Catalogue description' }); await settle();
      const panel = document.querySelector<HTMLElement>('.hmc-dialog-panel')!;
      const bounds = panel.getBoundingClientRect(); expect(bounds.left).toBeGreaterThanOrEqual(0); expect(bounds.right).toBeLessThanOrEqual(innerWidth + 1); expect(bounds.bottom).toBeLessThanOrEqual(innerHeight + 1);
      expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth + 1);
      action('Save medicine').click(); await settle(); fixture.detectChanges();
      fixture.componentInstance.query = 'UI medicine'; fixture.componentInstance.pagination.reset(); fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('tbody .medicine-row').length).toBe(1);
      fixture.nativeElement.querySelector('button[aria-label="Edit OT medicine"]').click(); await settle();
      const editing = TestBed.inject(MatDialog).openDialogs[0].componentInstance as OtMedicineEditComponent;
      expect(editing.form.value).toEqual(jasmine.objectContaining({ name: 'UI medicine', genericName: 'UI generic', strength: '10mg/ml', active: true }));
      editing.form.patchValue({ active: false, strength: '20mg/ml' }); await settle(); action('Save medicine').click(); await settle(); fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Inactive'); expect(fixture.componentInstance.filtered[0].strength).toBe('20mg/ml');
      const writes = Array.from(store.collections.get('otMedicineCatalog')!.values()); expect(writes.length).toBe(1); expect(writes[0].active).toBeFalse();
    } finally { fixture.destroy(); }
  });

  it('confirms removal, defaults focus to Cancel and preserves the catalogue when cancelled', async () => {
    const fixture = TestBed.createComponent(OtMedicineCatalogComponent);
    try {
      fixture.detectChanges(); await settle(); fixture.detectChanges();
      const row = fixture.componentInstance.visible[0];
      const canceled = fixture.componentInstance.delete(row); await settle();
      expect(TestBed.inject(MatDialog).openDialogs[0].componentInstance instanceof OtMedicineDeleteComponent).toBeTrue();
      expect(document.activeElement?.textContent?.trim()).toBe('Cancel');
      action('Cancel').click(); await canceled; await settle();
      expect(store.db.upsertRecord).not.toHaveBeenCalled();
      const confirmed = fixture.componentInstance.delete(row); await settle(); action('Remove medicine').click(); await confirmed; await settle(); fixture.detectChanges();
      expect(fixture.componentInstance.medicines.some(item => item.id === row.id)).toBeFalse();
      expect(store.collections.get('otMedicineCatalog')!.get(row.id).deleted).toBeTrue(); expect(store.db.deleteRecord).not.toHaveBeenCalled();
    } finally { fixture.destroy(); }
  });

  it('retains form details and reports a database write failure without closing the editor', async () => {
    const ref = TestBed.inject(MatDialog).open(OtMedicineEditComponent, { data: {}, width: '760px', maxWidth: '94vw', panelClass: 'hmc-dialog-panel' });
    await settle(); const editor = ref.componentInstance;
    editor.form.patchValue({ name: 'Keep unsaved medicine', genericName: 'Keep generic', active: false });
    (store.db.upsertRecord as jasmine.Spy).and.rejectWith(new Error('Database unavailable'));
    await settle(); action('Save medicine').click(); await settle();
    expect(TestBed.inject(MatDialog).openDialogs.length).toBe(1);
    expect(editor.form.value.name).toBe('Keep unsaved medicine'); expect(editor.form.value.active).toBeFalse();
    expect(editor.error).toContain('Database unavailable'); expect(editor.saving).toBeFalse();
    expect(store.collections.get('otMedicineCatalog')?.size || 0).toBe(0);
  });

  it('paginates, searches and previews the full medicine record without writing', async () => {
    const fixture = TestBed.createComponent(OtMedicineCatalogComponent);
    try {
      fixture.detectChanges(); await settle(); fixture.detectChanges();
      expect(fixture.componentInstance.visible.length).toBe(20); fixture.componentInstance.loadMore(); expect(fixture.componentInstance.visible.length).toBe(40);
      const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
      input.value = 'inj. avil'; input.dispatchEvent(new Event('input', { bubbles: true })); fixture.detectChanges(); await settle(); fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('tbody .medicine-row').length).toBe(1);
      fixture.nativeElement.querySelector('button[aria-label="Preview OT medicine"]').click(); await settle();
      expect(TestBed.inject(MatDialog).openDialogs[0].componentInstance instanceof RecordDetailsComponent).toBeTrue();
      expect(document.querySelector('.hmc-dialog-panel')?.textContent).toContain('INJ. AVIL'); expect(store.db.upsertRecord).not.toHaveBeenCalled();
    } finally { fixture.destroy(); }
  });

  it('manages the catalogue in a modal from a draft slip and returns with patient values and selected quantities intact', async () => {
    const catalog = TestBed.inject(OtMedicineCatalogService);
    const item = await catalog.save({ ...emptyOtCatalogMedicine(), name: 'A long OT medicine name with strength 100mg and detailed supply information', unit: 'Vial' });
    const fixture = TestBed.createComponent(OtFormComponent); fixture.componentInstance.canManageMedicines = true;
    try {
      fixture.detectChanges(); await settle(); fixture.detectChanges();
      const form = fixture.componentInstance; form.otForm.patchValue({ patientName: 'Ali draft', doctorName: 'Doctor' });
      const index = form.products.indexOf(item.name); form.onProductSelectionChange(index, true); form.productControls.at(index).get('quantity')!.setValue(6);
      form.productSearch = 'long OT medicine'; form.updateVisibleProducts(); fixture.detectChanges(); await settle();
      const root = fixture.nativeElement as HTMLElement; expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
      const card = root.querySelector<HTMLElement>('.product-item')!; const qty = card.querySelector<HTMLInputElement>('input')!;
      expect(qty.getBoundingClientRect().right).toBeLessThanOrEqual(card.getBoundingClientRect().right + 1);
      form.manageMedicines(); await settle();
      const manager = TestBed.inject(MatDialog).openDialogs[0].componentInstance as OtMedicineCatalogComponent; expect(manager.embedded).toBeTrue();
      await catalog.save({ ...emptyOtCatalogMedicine(), name: 'Added while filling slip' }); await settle();
      document.querySelector<HTMLButtonElement>('button[aria-label="Close OT medicine catalogue"]')!.click(); await settle(); fixture.detectChanges();
      expect(form.otForm.get('patientName')!.value).toBe('Ali draft'); expect(form.productControls.at(index).get('quantity')!.value).toBe(6);
      expect(form.products).toContain('Added while filling slip');
    } finally { fixture.destroy(); }
  });
  it('lets staff open the catalogue from an OT slip while keeping catalogue edit/delete unavailable', async () => {
    (store.db.requireAdministrator as jasmine.Spy).and.rejectWith(new Error('Admin required'));
    const fixture = TestBed.createComponent(OtFormComponent);
    try {
      fixture.detectChanges(); await settle(); fixture.detectChanges();
      expect(fixture.componentInstance.canManageMedicines).toBeTrue();
      fixture.componentInstance.manageMedicines(); await settle();
      const catalog = TestBed.inject(MatDialog).openDialogs[0].componentInstance as OtMedicineCatalogComponent;
      expect(catalog.embedded).toBeTrue(); expect(catalog.isSuperAdmin).toBeFalse();
      expect(document.querySelector('[aria-label="Edit OT medicine"]')).toBeNull();
      expect(document.querySelector('[aria-label="Delete OT medicine"]')).toBeNull();
    } finally { TestBed.inject(MatDialog).closeAll(); fixture.destroy(); }
  });
});
