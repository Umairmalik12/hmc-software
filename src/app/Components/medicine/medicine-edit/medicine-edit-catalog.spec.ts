import { FeedbackModule } from 'src/app/Shared/feedback.module';
import { ApplicationRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Medicine } from 'src/app/Models/medicine.model';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { PRESCRIPTION_MEDICINE_CATALOG, PrescriptionMedicineCatalogService } from 'src/app/Services/prescription-medicine-catalog.service';
import { memoryDb } from 'src/app/testing/memory-db';
import { MedicineEditComponent } from './medicine-edit.component';
import { RoomSelectComponent } from '../../rooms/room-select.component';
import { PrescriptionMedicineSelectComponent } from '../../precipion/medicine-catalog/prescription-medicine-select.component';
import { MedicineCatalogComponent } from '../../precipion/medicine-catalog/medicine-catalog.component';
import { MedicineOptionDialogComponent } from '../../precipion/medicine-catalog/medicine-option-dialog.component';
import { ScrollPaginationDirective } from 'src/app/Shared/scroll-pagination.directive';
import { ScrollListFooterComponent } from 'src/app/Shared/scroll-list-footer.component';
import { RecordPreviewDirective } from '../../record-details/record-preview.directive';
import { MedicineListComponent } from '../medicine-list/medicine-list.component';
import { MedicineService } from 'src/app/Services/medicine.service';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';

describe('Daily medicine form using the shared medicine catalogue', () => {
  let store: ReturnType<typeof memoryDb>;
  const settle = async (): Promise<void> => { TestBed.inject(ApplicationRef).tick(); await new Promise(resolve => setTimeout(resolve, 35)); TestBed.inject(ApplicationRef).tick(); };
  function type(input: HTMLInputElement, value: string): void { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }
  async function open(medicines: Medicine[] = []): Promise<MatDialogRef<MedicineEditComponent>> {
    const dependency: any = new NotifyUpdateService();
    const list = new MedicineListComponent(TestBed.inject(MedicineService), TestBed.inject(MatDialog), dependency, dependency, dependency, store.db, dependency);
    if (medicines.length) list.editMedicine(medicines[0].medicineId); else list.addNewMedicine();
    await settle();
    const ref = TestBed.inject(MatDialog).openDialogs.find(dialog => dialog.componentInstance instanceof MedicineEditComponent)! as MatDialogRef<MedicineEditComponent>;
    ref.afterClosed().subscribe(() => list.ngOnDestroy());
    return ref;
  }
  async function choose(parent: HTMLElement, row: number, search: string, expected: string): Promise<void> {
    const input = parent.querySelectorAll<HTMLInputElement>('app-prescription-medicine-select input')[row];
    input.focus(); type(input, search); await settle();
    const option = Array.from(document.querySelectorAll<HTMLElement>('.rx-medicine-options mat-option')).find(element => element.textContent?.trim().endsWith(expected))!;
    expect(option).withContext(expected).toBeDefined(); option.click(); await settle();
  }
  beforeEach(async () => {
    store = memoryDb();
    await TestBed.configureTestingModule({
      imports: [FeedbackModule, CommonModule, FormsModule, ReactiveFormsModule, NoopAnimationsModule, RouterTestingModule, MatAutocompleteModule, MatDialogModule, MatInputModule, MatSelectModule, MatIconModule, MatButtonModule],
      declarations: [MedicineEditComponent, RoomSelectComponent, PrescriptionMedicineSelectComponent, MedicineCatalogComponent, MedicineOptionDialogComponent, ScrollPaginationDirective, ScrollListFooterComponent, RecordPreviewDirective],
      providers: [{ provide: SupabaseDataService, useValue: store.db }],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it('validates empty medicine names, selects catalogue values in separate rows and saves their quantities', async () => {
    const ref = await open(); const component = ref.componentInstance;
    const parent = document.querySelector<HTMLElement>('app-medicine-edit')!;
    component.medicineForm.patchValue({ patientName: 'Ali Khan', roomNo: 'GW Bed 1' });
    await component.onSubmit(); await settle();
    const first = parent.querySelector<HTMLInputElement>('app-prescription-medicine-select input')!;
    expect(first.getAttribute('aria-required')).toBe('true'); expect(first.getAttribute('aria-invalid')).toBe('true');
    expect(parent.querySelector('.rx-picker-error')!.textContent).toContain('Enter a medicine name'); expect(store.db.upsertRecord).not.toHaveBeenCalled();
    await choose(parent, 0, 'mix', 'MIXEL');
    expect(first.getAttribute('aria-invalid')).toBeNull();
    component.medicines.at(0).get('quantity')!.setValue(2); component.addMedicine(); await settle();
    await choose(parent, 1, 'cyc', 'CYCIN'); component.medicines.at(1).get('quantity')!.setValue(3);
    expect(component.medicines.at(0).get('medicineName')!.value).toBe('MIXEL');
    expect(store.db.upsertRecord).not.toHaveBeenCalled();
    await component.onSubmit(); await settle();
    const saved = Array.from(store.collections.get('medicineDetails')!.values())[0];
    expect(saved.patientName).toBe('Ali Khan'); expect(saved.roomNo).toBe('GW Bed 1');
    expect(saved.medicines).toEqual([{ medicineName: 'MIXEL', quantity: 2 }, { medicineName: 'CYCIN', quantity: 3 }]);
    expect(store.db.upsertRecord).toHaveBeenCalledTimes(1); expect(store.db.setItem).not.toHaveBeenCalled();
  });

  it('manages the same catalogue inside an edit dialog without losing existing record values', async () => {
    const original: Medicine = { medicineId: 44, roomNo: 'Room 1', patientName: 'Ali', doctorName: '', createdAt: '2026-11-17T06:30:00Z', medicines: [{ medicineName: 'Historical medicine / original dose', quantity: 4 }] };
    store.collections.set('medicineDetails', new Map([['44', original]]));
    const ref = await open([original]); const component = ref.componentInstance;
    const parent = document.querySelector<HTMLElement>('app-medicine-edit')!;
    expect(parent.querySelector<HTMLInputElement>('app-prescription-medicine-select input')!.value).toBe('Historical medicine / original dose');
    const before = JSON.stringify(component.medicineForm.getRawValue());
    component.manageMedicines(); await settle();
    const manager = document.querySelector<HTMLElement>('.rx-catalog-modal')!; expect(manager).not.toBeNull();
    const add = Array.from(manager.querySelectorAll<HTMLButtonElement>('.search-bar button')).find(button => button.textContent?.includes('Add medicine'))!;
    add.click(); await settle();
    const editor = document.querySelector<HTMLElement>('app-medicine-option-dialog')!;
    type(editor.querySelector<HTMLInputElement>('input')!, 'Daily Catalogue New'); await settle();
    editor.querySelector<HTMLElement>('mat-select[aria-label="Medicine strength"] .mat-mdc-select-trigger')!.click(); await settle();
    Array.from(document.querySelectorAll<HTMLElement>('.mat-mdc-select-panel mat-option')).find(option => option.textContent?.trim() === '500 mg')!.click(); await settle();
    const save = Array.from(editor.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button')).find(button => button.textContent?.includes('Save medicine'))!;
    save.click(); await settle();
    expect((await TestBed.inject(PrescriptionMedicineCatalogService).getAll()).some(option => option.name === 'Daily Catalogue New 500 mg' && option.strength === '500 mg')).toBeTrue();
    expect(JSON.stringify(component.medicineForm.getRawValue())).toBe(before);
    document.querySelector<HTMLButtonElement>('button[aria-label="Close medicine catalogue"]')!.click(); await settle();
    await choose(parent, 0, 'Daily Catalogue New', 'Daily Catalogue New 500 mg'); component.medicines.at(0).get('quantity')!.setValue(5);
    await component.onSubmit(); await settle();
    const saved = store.collections.get('medicineDetails')!.get('44');
    expect(saved.medicines).toEqual([{ medicineName: 'Daily Catalogue New 500 mg', quantity: 5 }]); expect(saved.createdAt).toBe(original.createdAt);
    expect(original.medicines[0].medicineName).toBe('Historical medicine / original dose');
    expect(store.db.allocateId).toHaveBeenCalledWith(PRESCRIPTION_MEDICINE_CATALOG); expect(store.db.allocateId).not.toHaveBeenCalledWith('medicineDetails');
  });
});
