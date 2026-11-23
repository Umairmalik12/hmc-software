import { DateTimeFieldComponent } from '../../Shared/date-time-field.component';
import { SearchableSelectComponent } from 'src/app/Shared/searchable-select.component';
import { Component } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ClinicalCatalogComponent } from './clinical-catalog.component';
import { ClinicalCatalogSelectComponent } from './clinical-catalog-select.component';
import { ClinicalCatalogKind, ClinicalCatalogService } from '../../Services/clinical-catalog.service';
import { SupabaseDataService } from '../../Services/supabase-data.service';
import { NotifyUpdateService } from '../../Services/notify-update.service';
import { FeedbackModule } from '../../Shared/feedback.module';
import { ScrollPaginationDirective } from '../../Shared/scroll-pagination.directive';
import { ScrollListFooterComponent } from '../../Shared/scroll-list-footer.component';
import { RecordPreviewDirective } from '../record-details/record-preview.directive';
import { RecordDetailsComponent } from '../record-details/record-details.component';
import { LabEditComponent } from '../lab/lab-edit/lab-edit.component';
import { memoryDb } from '../../testing/memory-db';

@Component({ template: `<app-clinical-select label="Doctor name" [(ngModel)]="doctor" [savedValues]="saved"></app-clinical-select>
  <app-clinical-select kind="lab-tests" label="Lab tests" [formControl]="tests" [multiple]="true" [required]="true" [invalid]="tests.invalid && tests.touched"></app-clinical-select>` })
class SelectionHost {
  doctor = '';
  saved: string[] = [];
  tests = new FormControl<string[]>([], { nonNullable: true, validators: Validators.required });
}

describe('Clinical catalogue management and dropdowns', () => {
  let catalog: ClinicalCatalogService;
  let db: SupabaseDataService;
  let collections: Map<string, Map<string, any>>;
  let close: jasmine.Spy;
  let dialogData: any;
  const settle = async (fixture: ComponentFixture<unknown>) => { fixture.detectChanges(); await new Promise(resolve => setTimeout(resolve, 40)); fixture.detectChanges(); };
  const choose = async (fixture: ComponentFixture<unknown>, select: MatSelect | SearchableSelectComponent, name: string) => {
    select.open(); fixture.detectChanges();
    const option = Array.from(document.querySelectorAll<HTMLElement>('mat-option')).find(item => (item.querySelector('.hmc-option-label')?.textContent || item.textContent)?.trim() === name)!;
    expect(option).toBeDefined(); option.click(); await settle(fixture);
  };
  beforeEach(async () => {
    const memory = memoryDb(); db = memory.db; collections = memory.collections; close = jasmine.createSpy('close'); dialogData = {};
    await TestBed.configureTestingModule({
      imports: [DateTimeFieldComponent, SearchableSelectComponent, ClinicalCatalogSelectComponent, FeedbackModule, CommonModule, FormsModule, ReactiveFormsModule, NoopAnimationsModule, MatDialogModule, MatSelectModule, MatInputModule, MatButtonModule, MatIconModule],
      declarations: [ClinicalCatalogComponent, SelectionHost, LabEditComponent, ScrollPaginationDirective, ScrollListFooterComponent, RecordPreviewDirective, RecordDetailsComponent],
      providers: [{ provide: SupabaseDataService, useValue: db }, { provide: MAT_DIALOG_DATA, useValue: dialogData }, { provide: MatDialogRef, useValue: { close } }],
    }).compileComponents();
    catalog = TestBed.inject(ClinicalCatalogService);
  });
  afterEach(() => TestBed.inject(MatDialog).closeAll());

  for (const kind of ['doctors', 'lab-tests'] as ClinicalCatalogKind[]) {
    it(`adds, edits, previews, confirms deletion and restores ${kind} through its list`, async () => {
      const fixture = TestBed.createComponent(ClinicalCatalogComponent); fixture.componentInstance.kind = kind;
      try {
        await settle(fixture); const component = fixture.componentInstance;
        component.name.setValue('New catalogue name'); await component.save(); await settle(fixture);
        component.query = 'New catalogue name'; component.onSearch(); await settle(fixture);
        expect(component.filtered.length).toBe(1);
        const root = fixture.nativeElement as HTMLElement;
        root.querySelector<HTMLButtonElement>('button[title="Preview"]')!.click(); await settle(fixture);
        expect(document.body.textContent).toContain('New catalogue name'); TestBed.inject(MatDialog).closeAll();
        root.querySelector<HTMLButtonElement>('button[title="Edit"]')!.click(); await settle(fixture);
        expect(component.name.value).toBe('New catalogue name'); component.name.setValue('Renamed catalogue name'); await component.save();
        component.query = 'Renamed'; await settle(fixture);
        const record = component.filtered[0]; expect(record.name).toBe('Renamed catalogue name');
        const confirm = spyOn(window, 'confirm').and.returnValue(false);
        await component.delete(record); expect((await catalog.getAll(kind)).some(option => option.id === record.id)).toBeTrue();
        confirm.and.returnValue(true); await component.delete(record); await settle(fixture);
        expect(component.filtered.length).toBe(0);
        component.status = 'inactive'; component.onSearch(); await settle(fixture); expect(component.filtered[0].active).toBeFalse();
        component.edit(component.filtered[0]); component.active = true; await component.save();
        expect((await catalog.getAll(kind)).find(option => option.id === record.id)!.active).toBeTrue();
        let notifications: readonly any[] = []; const subscription = TestBed.inject(NotifyUpdateService).notifications$.subscribe(items => notifications = items);
        expect(notifications.some(item => item.description.includes('added successfully'))).toBeTrue();
        expect(notifications.some(item => item.description.includes('updated successfully'))).toBeTrue();
        expect(notifications.some(item => item.description.includes('deleted successfully'))).toBeTrue(); subscription.unsubscribe();
      } finally { fixture.destroy(); }
    });
  }

  it('loads dropdown updates immediately and retains historical names without making deleted doctors available in new forms', async () => {
    const original = await catalog.save('doctors', 'Dr Active'); const fixture = TestBed.createComponent(SelectionHost);
    try {
      await settle(fixture); const select = fixture.debugElement.query(By.css('app-clinical-select app-searchable-select')).componentInstance as SearchableSelectComponent;
      await choose(fixture, select, 'Dr Active'); expect(fixture.componentInstance.doctor).toBe('Dr Active');
      await catalog.save('doctors', 'Dr Renamed', original.id); await settle(fixture);
      select.open(); fixture.detectChanges(); expect(document.body.textContent).toContain('Dr Active'); expect(document.body.textContent).toContain('Dr Renamed'); select.close();
      await catalog.delete('doctors', { ...original, name: 'Dr Renamed' }); await settle(fixture);
      fixture.componentInstance.doctor = ''; await settle(fixture);
      select.open(); fixture.detectChanges(); expect(document.querySelector('.cdk-overlay-pane')!.textContent).not.toContain('Dr Active'); expect(document.querySelector('.cdk-overlay-pane')!.textContent).not.toContain('Dr Renamed'); select.close();
      fixture.componentInstance.saved = ['Historical surgeon']; await settle(fixture);
      await choose(fixture, select, 'Historical surgeon'); expect(fixture.componentInstance.doctor).toBe('Historical surgeon');
    } finally { fixture.destroy(); }
  });

  it('uses the lab catalogue for multiple selections, validates required tests and keeps saved test/doctor snapshots on edit', async () => {
    await catalog.save('lab-tests', 'Custom test');
    Object.assign(dialogData, { patientId: 5, name: 'Saved patient', testName: 'Legacy test', suggestedDr: 'Previous doctor', dateTime: '2026-11-20T10:30:00' });
    const fixture = TestBed.createComponent(LabEditComponent);
    try {
      await settle(fixture);
      const selects = fixture.debugElement.queryAll(By.css('app-clinical-select mat-select')).map(item => item.componentInstance as MatSelect);
      expect((fixture.nativeElement.querySelector('input[aria-label="Referred by"]') as HTMLInputElement).value).toBe('Previous doctor'); expect(fixture.nativeElement.textContent).toContain('Legacy test');
      await choose(fixture, selects[0], 'Custom test'); selects[0].close(); await settle(fixture);
      fixture.componentInstance.onSubmit(); expect(close).toHaveBeenCalledWith(jasmine.objectContaining({ patientId: 5, suggestedDr: 'Previous doctor', testName: 'Custom test, Legacy test' }));
      fixture.componentInstance.c.testName.setValue([]); fixture.componentInstance.onSubmit(); await settle(fixture);
      expect(fixture.componentInstance.labPatientForm.invalid).toBeTrue(); expect(fixture.nativeElement.textContent).toContain('Select at least one lab test');
    } finally { fixture.destroy(); }
  });

  it('paginates, searches, reports failed loads and retries without losing catalogue data', async () => {
    collections.set('doctorCatalog', new Map(Array.from({ length: 45 }, (_, index) => [String(index + 1), { id: String(index + 1), name: 'Doctor ' + index, active: true }])));
    const fixture = TestBed.createComponent(ClinicalCatalogComponent);
    try {
      await settle(fixture); const component = fixture.componentInstance;
      expect(component.visibleOptions.length).toBe(20); component.loadMore(); expect(component.visibleOptions.length).toBe(40);
      component.query = 'Doctor 44'; component.onSearch(); expect(component.filtered.length).toBe(1); expect(component.pagination.limit).toBe(20);
      const getAll = spyOn(catalog, 'getAll').and.rejectWith(new Error('Offline')); await component.load(); await settle(fixture);
      expect(component.loadFailed).toBeTrue(); expect(component.options.length).toBe(45); expect(fixture.nativeElement.textContent).toContain('Retry');
      getAll.and.callThrough(); await component.load(); expect(component.loadFailed).toBeFalse(); expect(component.options.length).toBe(45);
    } finally { fixture.destroy(); }
  });
});
