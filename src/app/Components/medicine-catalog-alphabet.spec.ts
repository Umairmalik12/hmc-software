import { ApplicationRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MedicineCatalogComponent } from './precipion/medicine-catalog/medicine-catalog.component';
import { MedicineOptionDialogComponent } from './precipion/medicine-catalog/medicine-option-dialog.component';
import { OtMedicineCatalogComponent } from './ot-medicine-catalog/ot-medicine-catalog.component';
import { OtMedicineEditComponent } from './ot-medicine-catalog/ot-medicine-edit.component';
import { OtMedicineDeleteComponent } from './ot-medicine-catalog/ot-medicine-delete.component';
import { RecordDetailsComponent } from './record-details/record-details.component';
import { RecordPreviewDirective } from './record-details/record-preview.directive';
import { PrescriptionMedicineCatalogService, PRESCRIPTION_MEDICINE_CATALOG } from '../Services/prescription-medicine-catalog.service';
import { OtMedicineCatalogService, OT_MEDICINE_CATALOG } from '../Services/ot-medicine-catalog.service';
import { SupabaseDataService } from '../Services/supabase-data.service';
import { emptyOtCatalogMedicine } from '../Models/ot-medicine-catalog.model';
import { FeedbackModule } from '../Shared/feedback.module';
import { ScrollPaginationDirective } from '../Shared/scroll-pagination.directive';
import { ScrollListFooterComponent } from '../Shared/scroll-list-footer.component';
import { memoryDb } from '../testing/memory-db';

const sampleRows = () => [...Array.from({ length: 60 }, (_, i) => ({ id: 'a-' + i, name: 'Alpha medicine sample ' + String(i).padStart(2, '0') })),
  { id: 'amox', name: 'Amoxicillin sample' }, { id: 'ator', name: 'atorvastatin sample' }, { id: 'bruf', name: 'Brufen sample' }, { id: 'beta', name: 'beta sample' },
  { id: 'cet', name: 'Cetirizine sample' }, { id: 'zinc', name: 'zinc sample' }, { id: 'numeric', name: '2SUM sample' }, { id: 'special', name: '@Special sample' }].reverse();

describe('Matching alphabetical navigation in main and OT medicine catalogues', () => {
  let store: ReturnType<typeof memoryDb>;
  let main: PrescriptionMedicineCatalogService, ot: OtMedicineCatalogService;
  const settle = async (fixture?: ComponentFixture<unknown>) => { fixture?.detectChanges(); TestBed.inject(ApplicationRef).tick(); await new Promise(resolve => setTimeout(resolve, 45)); fixture?.detectChanges(); TestBed.inject(ApplicationRef).tick(); };
  beforeEach(async () => {
    store = memoryDb();
    store.collections.set(PRESCRIPTION_MEDICINE_CATALOG, new Map(sampleRows().map(row => [row.id, { ...row, active: true }])));
    store.collections.set(OT_MEDICINE_CATALOG, new Map(sampleRows().map(row => [row.id, { ...emptyOtCatalogMedicine(), ...row, category: row.id === 'beta' ? 'Anaesthesia' : 'General', active: row.id !== 'beta' }])));
    await TestBed.configureTestingModule({ imports: [CommonModule, FormsModule, ReactiveFormsModule, NoopAnimationsModule, RouterTestingModule, MatDialogModule, MatInputModule, MatSelectModule, MatAutocompleteModule, MatButtonModule, MatIconModule, FeedbackModule],
      declarations: [MedicineCatalogComponent, MedicineOptionDialogComponent, OtMedicineCatalogComponent, OtMedicineEditComponent, OtMedicineDeleteComponent, RecordDetailsComponent, RecordPreviewDirective, ScrollPaginationDirective, ScrollListFooterComponent],
      providers: [{ provide: SupabaseDataService, useValue: store.db }],
    }).compileComponents();
    main = TestBed.inject(PrescriptionMedicineCatalogService); ot = TestBed.inject(OtMedicineCatalogService);
    spyOn(main, 'getAll').and.callFake(async () => [...store.collections.get(PRESCRIPTION_MEDICINE_CATALOG)!.values()].filter(row => row.active).map(row => ({ ...row })));
    spyOn(ot, 'getAll').and.callFake(async () => [...store.collections.get(OT_MEDICINE_CATALOG)!.values()].filter(row => !row.deleted).map(row => ({ ...row })));
  });
  afterEach(() => TestBed.inject(MatDialog).closeAll());
  for (const kind of ['main', 'ot'] as const) {
    const type = kind === 'main' ? MedicineCatalogComponent : OtMedicineCatalogComponent;
    const collection = kind === 'main' ? PRESCRIPTION_MEDICINE_CATALOG : OT_MEDICINE_CATALOG;
    it('lets staff browse, preview and add while hiding and blocking edit/delete in ' + kind, async () => {
      (store.db.requireAdministrator as jasmine.Spy).and.rejectWith(new Error('Admin required'));
      const fixture = TestBed.createComponent(type as typeof MedicineCatalogComponent); await settle(fixture);
      try {
        const page = fixture.componentInstance, root: HTMLElement = fixture.nativeElement;
        expect(page.isSuperAdmin).toBeFalse(); expect(page.visible.length).toBe(20);
        expect(root.querySelector('[aria-label="' + (kind === 'main' ? 'Edit catalogue medicine' : 'Edit OT medicine') + '"]')).toBeNull();
        expect(root.querySelector('[aria-label="' + (kind === 'main' ? 'Delete catalogue medicine' : 'Delete OT medicine') + '"]')).toBeNull();
        const preview = root.querySelector<HTMLButtonElement>('[aria-label="' + (kind === 'main' ? 'Preview catalogue medicine' : 'Preview OT medicine') + '"]')!;
        preview.click(); await settle(fixture); expect(TestBed.inject(MatDialog).openDialogs.length).toBe(1); TestBed.inject(MatDialog).closeAll(); await settle(fixture);
        const confirm = spyOn(window, 'confirm'); const dialog = spyOn(TestBed.inject(MatDialog), 'open').and.callThrough();
        (page as any).edit(page.visible[0]); await (page as any).delete(page.visible[0]);
        expect(confirm).not.toHaveBeenCalled(); expect(dialog).not.toHaveBeenCalled(); expect(store.db.upsertRecord).not.toHaveBeenCalled();
        page.edit(); await settle(fixture); expect(dialog).toHaveBeenCalledTimes(1); TestBed.inject(MatDialog).closeAll(); await settle(fixture);
        (store.db.requireAdministrator as jasmine.Spy).and.resolveTo(); await page.load(); await settle(fixture);
        expect(page.isSuperAdmin).toBeTrue(); expect(root.querySelector('[aria-label="' + (kind === 'main' ? 'Edit catalogue medicine' : 'Edit OT medicine') + '"]')).not.toBeNull();
        (store.db.requireAdministrator as jasmine.Spy).and.rejectWith(new Error('Role revoked')); await page.load(); await settle(fixture);
        expect(page.isSuperAdmin).toBeFalse();
        page.isSuperAdmin = true;
        ((kind === 'main' ? main.getAll : ot.getAll) as jasmine.Spy).and.rejectWith(new Error('Offline'));
        await page.load(); await settle(fixture); expect(page.isSuperAdmin).toBeFalse();
      } finally { fixture.destroy(); }
    });
    it('renders all A–Z/# choices, combines search with the selected letter and does not fetch or write on letter changes in ' + kind, async () => {
      const fixture = TestBed.createComponent(type as typeof MedicineCatalogComponent); await settle(fixture);
      try {
        const page = fixture.componentInstance; expect(page.visible.length).toBe(20); expect(page.visibleGroups[0].total).toBe(62);
        fixture.nativeElement.querySelector('.alphabet-filter .mat-mdc-select-trigger').click(); await settle(fixture);
        const choices = Array.from(document.querySelectorAll<HTMLElement>('.mat-mdc-select-panel mat-option'));
        const panel = document.querySelector<HTMLElement>('.mat-mdc-select-panel')!; const bounds = panel.getBoundingClientRect();
        expect(bounds.left).toBeGreaterThanOrEqual(0); expect(bounds.right).toBeLessThanOrEqual(innerWidth + 1); expect(getComputedStyle(panel).backgroundColor).toBe('rgb(255, 255, 255)');
        expect(choices.length).toBe(28); expect(choices[0].textContent).toContain('All Medicines'); expect(choices[27].textContent).toContain('#');
        choices.find(option => option.textContent?.trim().startsWith('B '))!.click(); await settle(fixture);
        expect(page.letterFilter).toBe('B'); expect(page.filtered.map(row => row.id)).toEqual(['beta', 'bruf']);
        page.query = 'bruf'; page.onFilterChange(); await settle(fixture); expect(page.filtered.map(row => row.id)).toEqual(['bruf']);
        expect(page.alphabetView.letters.find(item => item.letter === 'B')!.count).toBe(1);
        page.selectLetter('all'); expect(page.query).toBe('bruf'); expect(page.filtered.length).toBe(1);
        page.clearFilters(); page.selectLetter('#'); await settle(fixture); expect(page.filtered.map(row => row.id)).toEqual(['special', 'numeric']);
        page.selectLetter('X'); await settle(fixture); expect(fixture.nativeElement.querySelector('.list-empty')).not.toBeNull();
        expect(kind === 'main' ? main.getAll : ot.getAll).toHaveBeenCalledTimes(1); expect(store.db.upsertRecord).not.toHaveBeenCalled(); expect(store.db.allocateId).not.toHaveBeenCalled();
      } finally { fixture.destroy(); }
    });
    it('paginates medicines across section boundaries without duplicate headings or IDs and resets on alphabet changes in ' + kind, async () => {
      const fixture = TestBed.createComponent(type as typeof MedicineCatalogComponent); await settle(fixture);
      try {
        const page = fixture.componentInstance;
        page.loadMore(); expect(page.visible.length).toBe(40); expect(page.visibleGroups.length).toBe(1);
        page.loadMore(); page.loadMore(); await settle(fixture);
        expect(page.visible.length).toBe(68); expect(new Set(page.visible.map(row => row.id)).size).toBe(68);
        expect(page.visibleGroups.map(group => group.letter)).toEqual(['A', 'B', 'C', 'Z', '#']);
        expect(fixture.nativeElement.querySelectorAll('.alphabet-heading').length).toBe(5); expect(fixture.nativeElement.querySelectorAll('.medicine-row').length).toBe(68);
        page.selectLetter('A'); await settle(fixture); expect(page.visible.length).toBe(20); expect(page.filtered.length).toBe(62);
        expect(fixture.nativeElement.querySelector('.alphabet-section-count').textContent).toContain('20 of 62');
        const scroll = fixture.nativeElement.querySelector('.table-scroll-container') as HTMLElement; expect(scroll.scrollTop).toBe(0);
        expect(fixture.nativeElement.scrollWidth).toBeLessThanOrEqual(fixture.nativeElement.clientWidth + 1);
      } finally { fixture.destroy(); }
    });
    it('preserves filtered CRUD and moves renamed records into their new letter without changing the other catalogue in ' + kind, async () => {
      const fixture = TestBed.createComponent(type as typeof MedicineCatalogComponent); await settle(fixture);
      try {
        const page = fixture.componentInstance; const other = JSON.stringify([...store.collections.get(kind === 'main' ? OT_MEDICINE_CATALOG : PRESCRIPTION_MEDICINE_CATALOG)!.values()]);
        page.selectLetter('B'); await settle(fixture); fixture.nativeElement.querySelector('button[aria-label^="Edit"]').click(); await settle(fixture);
        const ref = TestBed.inject(MatDialog).openDialogs[0];
        if (kind === 'main') { const editor = ref.componentInstance as MedicineOptionDialogComponent; editor.name.setValue('Zeta renamed sample'); await editor.save(); }
        else { const editor = ref.componentInstance as OtMedicineEditComponent; editor.form.patchValue({ name: 'Zeta renamed sample' }); await editor.save(); }
        await settle(fixture); expect(page.filtered.length).toBe(1); page.selectLetter('Z'); await settle(fixture);
        const renamed = page.filtered.find(row => row.id === 'beta')!; expect(renamed.name).toBe('Zeta renamed sample');
        if (kind === 'main') { spyOn(window, 'confirm').and.returnValue(true); await page.delete(renamed); }
        else { const deleted = (page as unknown as OtMedicineCatalogComponent).delete(renamed as any); await settle(fixture); const button = Array.from(document.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button')).find(item => item.textContent?.includes('Remove medicine'))!; button.click(); await deleted; }
        await settle(fixture); expect(page.filtered.some(row => row.id === 'beta')).toBeFalse();
        page.edit(); await settle(fixture); const add = TestBed.inject(MatDialog).openDialogs[0];
        if (kind === 'main') { const editor = add.componentInstance as MedicineOptionDialogComponent; editor.name.setValue('Bravo newly added sample'); await editor.save(); }
        else { const editor = add.componentInstance as OtMedicineEditComponent; editor.form.patchValue({ name: 'Bravo newly added sample' }); await editor.save(); }
        await settle(fixture); page.selectLetter('B'); await settle(fixture); expect(page.filtered.some(row => row.name === 'Bravo newly added sample')).toBeTrue();
        expect(JSON.stringify([...store.collections.get(kind === 'main' ? OT_MEDICINE_CATALOG : PRESCRIPTION_MEDICINE_CATALOG)!.values()])).toBe(other);
        expect(store.db.setItem).not.toHaveBeenCalled(); expect(store.db.deleteRecord).not.toHaveBeenCalled();
      } finally { fixture.destroy(); }
    });
  }
  it('keeps each catalogue filter independent and combines OT status and category with alphabetical search', async () => {
    const mainFixture = TestBed.createComponent(MedicineCatalogComponent), otFixture = TestBed.createComponent(OtMedicineCatalogComponent);
    try {
      await settle(mainFixture); await settle(otFixture); mainFixture.componentInstance.selectLetter('A');
      const page = otFixture.componentInstance; page.selectLetter('B'); page.status = 'inactive'; page.category = 'Anaesthesia'; page.onFilterChange(); await settle(otFixture);
      expect(page.filtered.map(row => row.id)).toEqual(['beta']); expect(mainFixture.componentInstance.filtered.length).toBe(62);
      page.query = 'not found'; page.onFilterChange(); expect(page.filtered.length).toBe(0); expect(mainFixture.componentInstance.letterFilter).toBe('A');
    } finally { mainFixture.destroy(); otFixture.destroy(); }
  });
});
