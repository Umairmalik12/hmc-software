import { FeedbackModule } from 'src/app/Shared/feedback.module';
import { ApplicationRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { PrescriptionMedicineSelectComponent } from './prescription-medicine-select.component';
import { MedicineCatalogComponent } from './medicine-catalog.component';
import { MedicineOptionDialogComponent } from './medicine-option-dialog.component';
import { PrescriptionMedicineCatalogService } from 'src/app/Services/prescription-medicine-catalog.service';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { ScrollPaginationDirective } from 'src/app/Shared/scroll-pagination.directive';
import { ScrollListFooterComponent } from 'src/app/Shared/scroll-list-footer.component';
import { RecordPreviewDirective } from '../../record-details/record-preview.directive';
import { memoryDb } from 'src/app/testing/memory-db';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { PreciptionComponent } from '../precipion.component';

@Component({ template: `<div style="margin-left:min(140px,20vw);width:min(260px,60vw)"><form (ngSubmit)="submits=submits+1"><app-prescription-medicine-select [(ngModel)]="value" name="medicine" label="Medicine 1" [disabled]="disabled"></app-prescription-medicine-select></form></div><app-prescription-medicine-catalog></app-prescription-medicine-catalog>` })
class CatalogHost { value = ''; disabled = false; submits = 0; }

describe('Searchable prescription medicine selector and catalogue', () => {
  let store: ReturnType<typeof memoryDb>;
  beforeEach(async () => {
    store = memoryDb();
    await TestBed.configureTestingModule({
      imports: [FeedbackModule, CommonModule, FormsModule, ReactiveFormsModule, NoopAnimationsModule, RouterTestingModule, MatAutocompleteModule, MatDialogModule, MatInputModule, MatButtonModule, MatIconModule, MatSelectModule],
      declarations: [CatalogHost, PreciptionComponent, PrescriptionMedicineSelectComponent, MedicineCatalogComponent, MedicineOptionDialogComponent, ScrollPaginationDirective, ScrollListFooterComponent, RecordPreviewDirective],
      providers: [{ provide: SupabaseDataService, useValue: store.db }, { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } }],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(MatDialog).closeAll());
  const settle = async (): Promise<void> => { TestBed.inject(ApplicationRef).tick(); await new Promise(resolve => setTimeout(resolve, 35)); };
  function type(input: HTMLInputElement, text: string): void { input.value = text; input.dispatchEvent(new Event('input', { bubbles: true })); }
  function key(input: HTMLInputElement, name: string, code: number): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }); Object.defineProperty(event, 'keyCode', { value: code }); input.dispatchEvent(event); return event;
  }
  async function openAdd(fixture: any, name: string): Promise<void> {
    const input = fixture.nativeElement.querySelector('app-prescription-medicine-select input') as HTMLInputElement;
    input.focus(); type(input, name); fixture.detectChanges(); await settle();
    const add = Array.from(document.querySelectorAll<HTMLElement>('.rx-medicine-options mat-option')).find(option => option.textContent?.includes('to catalogue'))!;
    expect(add).toBeDefined(); add.click(); await settle();
  }

  async function chooseStrength(value: string): Promise<void> {
    document.querySelector<HTMLElement>('mat-select[aria-label="Medicine strength"] .mat-mdc-select-trigger')!.click(); await settle();
    const option = Array.from(document.querySelectorAll<HTMLElement>('.mat-mdc-select-panel mat-option')).find(item => item.textContent?.trim() === value)!;
    expect(option).withContext(value).toBeDefined(); option.click(); await settle();
  }

  it('adds a strength in the inner medicine dialog, selects the full label and restores it when editing', async () => {
    const fixture = TestBed.createComponent(CatalogHost);
    try {
      fixture.detectChanges(); await settle(); fixture.detectChanges(); await openAdd(fixture, 'Strength example');
      await chooseStrength('500 mg');
      const save = () => Array.from(document.querySelectorAll<HTMLButtonElement>('app-medicine-option-dialog mat-dialog-actions button')).find(button => button.textContent?.includes('Save medicine'))!;
      save().click(); await settle(); fixture.detectChanges();
      expect(fixture.componentInstance.value).toBe('Strength example 500 mg');
      const catalog = fixture.debugElement.query(By.directive(MedicineCatalogComponent)).componentInstance as MedicineCatalogComponent;
      catalog.query = 'Strength example'; catalog.pagination.reset(); fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('tbody').textContent).toContain('500 mg');
      fixture.nativeElement.querySelector('button[aria-label="Edit catalogue medicine"]').click(); await settle();
      const editor = TestBed.inject(MatDialog).openDialogs[0].componentInstance as MedicineOptionDialogComponent;
      expect(editor.name.value).toBe('Strength example'); expect(editor.strength.value).toBe('500 mg');
      await chooseStrength('1 g'); save().click(); await settle(); fixture.detectChanges();
      const saved = Array.from(store.collections.get('prescriptionMedicineCatalog')!.values())[0];
      expect(saved.name).toBe('Strength example 1 g'); expect(saved.strength).toBe('1 g');
      expect(fixture.componentInstance.value).toBe('Strength example 500 mg');
      const selector = fixture.debugElement.query(By.directive(PrescriptionMedicineSelectComponent)).componentInstance as PrescriptionMedicineSelectComponent;
      expect(selector.options.some(item => item.name === 'Strength example 1 g')).toBeTrue();
      expect(store.db.setItem).not.toHaveBeenCalled();
    } finally { fixture.destroy(); }
  });

  it('allows custom strengths and loads legacy medicine labels without duplicating their strength', async () => {
    const fixture = TestBed.createComponent(CatalogHost);
    try {
      await TestBed.inject(PrescriptionMedicineCatalogService).save('Legacy medicine 1g');
      fixture.detectChanges(); await settle(); fixture.detectChanges();
      const catalog = fixture.debugElement.query(By.directive(MedicineCatalogComponent)).componentInstance as MedicineCatalogComponent;
      catalog.query = 'Legacy medicine'; fixture.detectChanges();
      fixture.nativeElement.querySelector('button[aria-label="Edit catalogue medicine"]').click(); await settle();
      const editor = TestBed.inject(MatDialog).openDialogs[0].componentInstance as MedicineOptionDialogComponent;
      expect(editor.name.value).toBe('Legacy medicine'); expect(editor.strength.value).toBe('1 g');
      await chooseStrength('Other strength...'); await editor.save();
      expect(editor.customStrength.touched).toBeTrue(); expect(TestBed.inject(MatDialog).openDialogs.length).toBe(1);
      const input = document.querySelector<HTMLInputElement>('app-medicine-option-dialog input[placeholder="e.g. 50 mcg or 0.5%"]')!;
      type(input, '50mcg'); await settle(); await editor.save(); await settle(); fixture.detectChanges();
      expect(catalog.filtered[0].name).toBe('Legacy medicine 50 mcg'); expect(catalog.filtered[0].strength).toBe('50 mcg');
      const writes = (store.db.upsertRecord as jasmine.Spy).calls.allArgs(); expect(writes.length).toBe(2);
    } finally { fixture.destroy(); }
  });

  it('searches case-insensitively, selects with the keyboard and keeps the themed panel inside the viewport', async () => {
    const fixture = TestBed.createComponent(CatalogHost);
    try {
      fixture.detectChanges(); await settle(); fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('app-prescription-medicine-select input') as HTMLInputElement;
      input.focus(); type(input, 'mIx'); fixture.detectChanges(); await settle();
      const panel = document.querySelector<HTMLElement>('.rx-medicine-options')!;
      expect(panel).not.toBeNull(); expect(getComputedStyle(panel).backgroundColor).toBe('rgb(255, 255, 255)');
      const bounds = panel.getBoundingClientRect(); expect(bounds.left).toBeGreaterThanOrEqual(0); expect(bounds.right).toBeLessThanOrEqual(innerWidth);
      expect(bounds.height).toBeLessThanOrEqual(301);
      expect(panel.querySelectorAll('mat-option').length).toBe(1); expect(panel.textContent).toContain('MIXEL');
      key(input, 'ArrowDown', 40); const enter = key(input, 'Enter', 13); fixture.detectChanges(); await settle();
      expect(fixture.componentInstance.value).toBe('MIXEL'); expect(enter.defaultPrevented).toBeTrue(); expect(fixture.componentInstance.submits).toBe(0);
      input.blur(); expect(store.db.upsertRecord).not.toHaveBeenCalled(); expect(store.db.setItem).not.toHaveBeenCalled();
    } finally { fixture.destroy(); }
  });

  it('adds a medicine explicitly from the dropdown and selects it after the database save succeeds', async () => {
    const fixture = TestBed.createComponent(CatalogHost);
    try {
      fixture.detectChanges(); await settle(); fixture.detectChanges();
      await openAdd(fixture, 'Brand New Medicine 250mg');
      const dialog = TestBed.inject(MatDialog).openDialogs[0]; expect(dialog.componentInstance instanceof MedicineOptionDialogComponent).toBeTrue();
      expect((dialog.componentInstance as MedicineOptionDialogComponent).name.value).toBe('Brand New Medicine 250mg');
      const save = Array.from(document.querySelectorAll<HTMLButtonElement>('.hmc-dialog-panel mat-dialog-actions button')).find(button => button.textContent?.includes('Save medicine'))!;
      save.click(); await settle(); fixture.detectChanges();
      expect(fixture.componentInstance.value).toBe('Brand New Medicine 250mg');
      expect((await TestBed.inject(PrescriptionMedicineCatalogService).getAll()).some(option => option.name === 'Brand New Medicine 250mg')).toBeTrue();
      expect(store.db.upsertRecord).toHaveBeenCalledTimes(1); expect(store.db.setItem).not.toHaveBeenCalled(); expect(fixture.componentInstance.submits).toBe(0);
    } finally { fixture.destroy(); }
  });

  it('retains typed medicine/dose text and avoids catalogue writes when adding is cancelled', async () => {
    const fixture = TestBed.createComponent(CatalogHost);
    try {
      fixture.detectChanges(); await settle(); fixture.detectChanges(); await openAdd(fixture, 'Manual medicine / patient-specific dose');
      const cancel = Array.from(document.querySelectorAll<HTMLButtonElement>('.hmc-dialog-panel mat-dialog-actions button')).find(button => button.textContent?.includes('Cancel'))!;
      cancel.click(); await settle(); fixture.detectChanges();
      expect(fixture.componentInstance.value).toBe('Manual medicine / patient-specific dose'); expect(store.db.upsertRecord).not.toHaveBeenCalled();
    } finally { fixture.destroy(); }
  });

  it('edits and deletes list options without rewriting a medicine already selected in the prescription', async () => {
    const fixture = TestBed.createComponent(CatalogHost); fixture.componentInstance.value = 'MIXEL';
    try {
      fixture.detectChanges(); await settle(); fixture.detectChanges();
      const catalog = fixture.debugElement.query(By.directive(MedicineCatalogComponent)).componentInstance as MedicineCatalogComponent;
      const selector = fixture.debugElement.query(By.directive(PrescriptionMedicineSelectComponent)).componentInstance as PrescriptionMedicineSelectComponent;
      expect(catalog.visible.length).toBe(20); catalog.loadMore(); expect(catalog.visible.length).toBe(40);
      catalog.query = 'MIXEL'; catalog.pagination.reset(); fixture.detectChanges();
      fixture.nativeElement.querySelector('button[aria-label="Edit catalogue medicine"]').click(); await settle();
      const name = document.querySelector<HTMLInputElement>('.hmc-dialog-panel input')!; type(name, 'MIXEL UPDATED'); await settle();
      const save = Array.from(document.querySelectorAll<HTMLButtonElement>('.hmc-dialog-panel mat-dialog-actions button')).find(button => button.textContent?.includes('Save medicine'))!;
      save.click(); await settle(); fixture.detectChanges();
      expect(selector.options.some(option => option.name === 'MIXEL UPDATED')).toBeTrue(); expect(fixture.componentInstance.value).toBe('MIXEL');
      spyOn(window, 'confirm').and.returnValue(true); fixture.nativeElement.querySelector('button[aria-label="Delete catalogue medicine"]').click(); await settle(); fixture.detectChanges();
      expect(selector.options.some(option => option.name === 'MIXEL UPDATED')).toBeFalse(); expect(fixture.componentInstance.value).toBe('MIXEL');
      expect(catalog.filtered.length).toBe(0); expect(catalog.success).toContain('removed');
    } finally { fixture.destroy(); }
  });

  it('allows manual medicine entry during a catalogue outage and honors the disabled state', async () => {
    (store.db.getItem as jasmine.Spy).and.rejectWith(new Error('offline'));
    const fixture = TestBed.createComponent(CatalogHost);
    try {
      fixture.detectChanges(); await settle(); fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('app-prescription-medicine-select input') as HTMLInputElement;
      type(input, 'Manual medicine'); fixture.detectChanges(); expect(fixture.componentInstance.value).toBe('Manual medicine');
      expect(fixture.nativeElement.querySelector('.rx-suggestion-retry')).not.toBeNull();
      fixture.componentInstance.disabled = true; fixture.detectChanges(); await settle(); fixture.detectChanges(); expect(input.disabled).toBeTrue();
      expect(store.db.upsertRecord).not.toHaveBeenCalled();
    } finally { fixture.destroy(); }
  });

  it('uses the new selector in the prescription form and manages medicines without losing patient details or doses', async () => {
    const fixture = TestBed.createComponent(PreciptionComponent);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    try {
      fixture.detectChanges(); await settle(); fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('datalist')).toBeNull();
      const patient = fixture.nativeElement.querySelector('input[aria-label="Patient name"]') as HTMLInputElement;
      type(patient, 'Ali Khan');
      const medicine = fixture.nativeElement.querySelector('app-prescription-medicine-select input') as HTMLInputElement;
      medicine.focus(); type(medicine, 'mixel'); fixture.detectChanges(); await settle();
      const option = Array.from(document.querySelectorAll<HTMLElement>('.rx-medicine-options mat-option')).find(element => element.textContent?.trim().endsWith('MIXEL'))!;
      option.click(); await settle(); fixture.detectChanges();
      fixture.nativeElement.querySelector('input[aria-label="Morning, medicine 1"]').click();
      fixture.nativeElement.querySelector('.rx-medicine-tools button:last-child').click(); await settle(); fixture.detectChanges();
      const inputs = fixture.nativeElement.querySelectorAll('app-prescription-medicine-select input') as NodeListOf<HTMLInputElement>;
      type(inputs[1], 'Manual medicine / patient-specific dose'); inputs[1].blur(); fixture.detectChanges();
      const patientBefore = JSON.stringify(fixture.componentInstance.record.patient), medicinesBefore = JSON.stringify(fixture.componentInstance.record.medicines);
      fixture.nativeElement.querySelector('.rx-medicine-tools button:first-child').click(); await settle(); fixture.detectChanges();
      expect(document.querySelector('.rx-catalog-modal')).not.toBeNull();
      document.querySelector<HTMLButtonElement>('button[aria-label="Close medicine catalogue"]')!.click(); await settle(); fixture.detectChanges();
      expect(JSON.stringify(fixture.componentInstance.record.patient)).toBe(patientBefore);
      expect(JSON.stringify(fixture.componentInstance.record.medicines)).toBe(medicinesBefore);
      expect(store.db.upsertRecord).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
      fixture.nativeElement.querySelector('.rx-editor-actions button[type="submit"]').click(); await settle(); fixture.detectChanges();
      const saved = Array.from(store.collections.get('prescriptions')!.values())[0];
      expect(saved.patient.name).toBe('Ali Khan'); expect(saved.medicines[0].name).toBe('MIXEL'); expect(saved.medicines[0].morning).toBeTrue();
      expect(saved.medicines[1].name).toBe('Manual medicine / patient-specific dose'); expect(navigate).toHaveBeenCalledWith(['/prescriptions']);
    } finally { fixture.destroy(); }
  });
});
