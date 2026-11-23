import { DateTimeFieldComponent } from '../../Shared/date-time-field.component';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StaffEditComponent } from './staff-edit.component';
import { StaffListComponent } from './staff-list.component';
import { StaffDutyManagerComponent } from './staff-duty-manager.component';
import { StaffDutyCatalogService } from '../../Services/staff-duty-catalog.service';
import { StaffDraft, StaffRecord } from '../../Models/staff.model';
import { StaffService, STAFF_COLLECTION } from '../../Services/staff.service';
import { SupabaseDataService } from '../../Services/supabase-data.service';
import { NotifyUpdateService } from '../../Services/notify-update.service';
import { SearchableSelectComponent } from '../../Shared/searchable-select.component';
import { FeedbackModule } from '../../Shared/feedback.module';
import { ScrollPaginationDirective } from '../../Shared/scroll-pagination.directive';
import { ScrollListFooterComponent } from '../../Shared/scroll-list-footer.component';
import { RecordDetailsComponent } from '../record-details/record-details.component';
import { RecordPreviewDirective } from '../record-details/record-preview.directive';
import { memoryDb } from '../../testing/memory-db';

const profile = (index: number): StaffRecord => ({ id: String(index), name: 'Staff ' + index, designation: 'Ward assistant', employmentType: index % 2 ? 'intern' : 'permanent', active: true,
  assignments: [{ duty: 'OT in-charge', shift: 'Morning', startTime: '08:00', endTime: '16:00' }],
  createdAt: '2026-11-20T00:00:00Z', updatedAt: '2026-11-20T00:00:00Z' });

describe('Staff management and duty roster', () => {
  let service: StaffService;
  let db: SupabaseDataService;
  let collections: Map<string, Map<string, any>>;
  let close: jasmine.Spy;
  let dialogData: any;
  const settle = async (fixture?: ComponentFixture<unknown>) => { fixture?.detectChanges(); TestBed.inject(ApplicationRef).tick(); await new Promise(resolve => setTimeout(resolve, 40)); fixture?.detectChanges(); TestBed.inject(ApplicationRef).tick(); };
  beforeEach(async () => {
    const memory = memoryDb(); db = memory.db; collections = memory.collections; close = jasmine.createSpy('close'); dialogData = {};
    await TestBed.configureTestingModule({
      imports: [DateTimeFieldComponent, SearchableSelectComponent, CommonModule, FormsModule, ReactiveFormsModule, NoopAnimationsModule, MatDialogModule, MatInputModule, MatSelectModule, MatAutocompleteModule, MatButtonModule, MatIconModule, FeedbackModule],
      declarations: [StaffEditComponent, StaffListComponent, StaffDutyManagerComponent, ScrollPaginationDirective, ScrollListFooterComponent, RecordDetailsComponent, RecordPreviewDirective],
      providers: [{ provide: SupabaseDataService, useValue: db }, { provide: MAT_DIALOG_DATA, useValue: dialogData }, { provide: MatDialogRef, useValue: { close } }],
    }).compileComponents();
    service = TestBed.inject(StaffService);
  });
  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it('saves only a staff name when other details are not yet available', async () => {
    const fixture = TestBed.createComponent(StaffEditComponent);
    try {
      await settle(fixture); const component = fixture.componentInstance;
      await component.save(); expect(close).not.toHaveBeenCalled();
      component.form.get('name')!.setValue('  Ali  '); await component.save();
      expect(close).toHaveBeenCalledWith(jasmine.objectContaining({ name: 'Ali', active: true, designation: '', employmentType: '', assignments: [] }));
      expect((await service.getAll()).length).toBe(1);
    } finally { fixture.destroy(); }
  });

  it('adds multiple duties, enforces paired times and saves an intern with an overnight schedule', async () => {
    const fixture = TestBed.createComponent(StaffEditComponent);
    try {
      await settle(fixture); const component = fixture.componentInstance;
      component.form.patchValue({ name: 'Ayesha', designation: 'OT nurse', employmentType: 'intern' });
      (fixture.nativeElement.querySelector('.duty-section-heading button') as HTMLButtonElement).click(); await settle(fixture);
      component.assignments.at(0).patchValue({ duty: 'OT in-charge', shift: 'Night', startTime: '22:00' });
      await component.save(); await settle(fixture);
      expect(close).not.toHaveBeenCalled(); expect(fixture.nativeElement.textContent).toContain('Enter both the duty start and end time');
      component.assignments.at(0).get('endTime')!.setValue('06:00'); component.addDuty();
      component.assignments.at(1).patchValue({ duty: 'Patient medicines', shift: 'Evening', startTime: '16:00', endTime: '21:00' });
      await settle(fixture); expect(fixture.nativeElement.textContent).toContain('Ends the following day');
      await component.save(); const saved = close.calls.mostRecent().args[0] as StaffRecord;
      expect(saved.employmentType).toBe('intern'); expect(saved.assignments.length).toBe(2);
      expect(saved.assignments[0].endTime).toBe('06:00');
    } finally { fixture.destroy(); }
  });

  it('loads edit details, supports removing duties and keeps the draft when saving fails', async () => {
    const existing = profile(12); collections.set(STAFF_COLLECTION, new Map([['12', existing]])); dialogData.record = existing;
    const fixture = TestBed.createComponent(StaffEditComponent);
    try {
      await settle(fixture); const component = fixture.componentInstance;
      expect(component.form.get('name')!.value).toBe('Staff 12'); expect(component.assignments.length).toBe(1);
      component.removeDuty(0); component.form.patchValue({ name: 'Updated staff', employmentType: 'intern' });
      const save = spyOn(service, 'save').and.rejectWith(new Error('Offline'));
      await component.save(); await settle(fixture); expect(close).not.toHaveBeenCalled();
      expect(component.form.get('name')!.value).toBe('Updated staff'); expect(component.form.enabled).toBeTrue(); expect(fixture.nativeElement.textContent).toContain('Offline');
      save.and.callThrough(); await component.save();
      expect(close).toHaveBeenCalledWith(jasmine.objectContaining({ id: '12', name: 'Updated staff', assignments: [], employmentType: 'intern', createdAt: existing.createdAt }));
      expect(existing.name).toBe('Staff 12'); expect(existing.assignments.length).toBe(1);
    } finally { fixture.destroy(); }
  });

  it('matches duty and shift on the same assignment, searches all staff pages and resets pagination', async () => {
    const rows = Array.from({ length: 45 }, (_, index) => profile(index + 1));
    rows[0].assignments.push({ duty: 'Counter / reception', shift: 'Night', startTime: '20:00', endTime: '04:00' });
    collections.set(STAFF_COLLECTION, new Map(rows.map(record => [record.id, record])));
    const fixture = TestBed.createComponent(StaffListComponent);
    try {
      await settle(fixture); const component = fixture.componentInstance;
      expect(component.visibleRecords.length).toBe(20); component.loadMore(); expect(component.visibleRecords.length).toBe(40);
      component.dutyFilter = 'OT in-charge'; component.shiftFilter = 'Night'; component.onSearch(); expect(component.filtered.length).toBe(0);
      component.dutyFilter = 'Counter / reception'; expect(component.filtered.map(record => record.id)).toEqual(['1']);
      component.clearFilters(); component.query = 'Staff 44'; component.onSearch(); expect(component.filtered.map(record => record.id)).toEqual(['44']); expect(component.pagination.limit).toBe(20);
      component.clearFilters(); component.typeFilter = 'intern'; expect(component.filtered.every(record => record.employmentType === 'intern')).toBeTrue();
      component.clearFilters(); expect(component.filtered.length).toBe(45);
    } finally { fixture.destroy(); }
  });

  it('opens preview and edit, confirms deactivation and allows restoring the inactive profile', async () => {
    const saved = await service.save({ name: 'Ali', designation: 'OPD assistant', employmentType: 'permanent', active: true, assignments: [] });
    const fixture = TestBed.createComponent(StaffListComponent);
    try {
      await settle(fixture); const component = fixture.componentInstance;
      component.view(saved); await settle(fixture); expect(document.body.textContent).toContain('Staff member'); TestBed.inject(MatDialog).closeAll(); await settle(fixture);
      await component.edit(saved); await settle(fixture);
      const editor = TestBed.inject(MatDialog).openDialogs[0].componentInstance as StaffEditComponent;
      expect(editor.form.get('name')!.value).toBe('Ali'); TestBed.inject(MatDialog).closeAll(); await settle(fixture);
      const confirm = spyOn(window, 'confirm').and.returnValue(false); await component.delete(saved); expect((await service.getById(saved.id))!.active).toBeTrue();
      confirm.and.returnValue(true); await component.delete(saved); await settle(fixture); expect(component.filtered.length).toBe(0);
      component.statusFilter = 'inactive'; component.onSearch(); expect(component.filtered[0].id).toBe(saved.id);
      await component.edit(component.filtered[0]); await settle(fixture);
      const restore = TestBed.inject(MatDialog).openDialogs[0].componentInstance as StaffEditComponent;
      restore.form.get('active')!.setValue(true); await restore.save(); await settle(fixture);
      component.statusFilter = 'active'; component.onSearch(); expect(component.filtered[0].id).toBe(saved.id);
      let messages: readonly any[] = []; const subscription = TestBed.inject(NotifyUpdateService).notifications$.subscribe(items => messages = items);
      expect(messages.some(item => item.description === 'Staff deactivated successfully.')).toBeTrue(); subscription.unsubscribe();
    } finally { fixture.destroy(); }
  });

  it('keeps a long duty form inside the viewport with one scroll area and visible save controls', async () => {
    const ref = TestBed.inject(MatDialog).open(StaffEditComponent, { data: {}, width: 'min(820px, calc(100vw - 32px))', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' });
    for (let index = 0; index < 10; index++) ref.componentInstance.addDuty();
    await settle();
    const panel = document.querySelector<HTMLElement>('.hmc-dialog-panel')!, surface = panel.querySelector<HTMLElement>('.mat-mdc-dialog-surface')!;
    const content = panel.querySelector<HTMLElement>('mat-dialog-content')!, actions = panel.querySelector<HTMLElement>('mat-dialog-actions')!;
    expect(surface.getBoundingClientRect().right).toBeLessThanOrEqual(innerWidth + 1); expect(surface.getBoundingClientRect().bottom).toBeLessThanOrEqual(innerHeight + 1);
    expect(content.scrollHeight).toBeGreaterThan(content.clientHeight); expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth + 1);
    expect(actions.getBoundingClientRect().bottom).toBeLessThanOrEqual(surface.getBoundingClientRect().bottom + 1); ref.close();
  });

  it('reports failed roster reads and retries without clearing loaded staff records', async () => {
    await service.save({ name: 'Ali', designation: '', employmentType: '', active: true, assignments: [] });
    const fixture = TestBed.createComponent(StaffListComponent);
    try {
      await settle(fixture); const component = fixture.componentInstance; const load = spyOn(service, 'getAll').and.rejectWith(new Error('Offline'));
      await component.load(); await settle(fixture); expect(component.loadFailed).toBeTrue(); expect(component.records.length).toBe(1);
      expect(fixture.nativeElement.textContent).toContain('Retry'); load.and.callThrough(); await component.load(); expect(component.loadFailed).toBeFalse();
    } finally { fixture.destroy(); }
  });
  it('opens duty CRUD from the list header and immediately offers a newly saved duty on the staff form', async () => {
    const fixture = TestBed.createComponent(StaffListComponent);
    try {
      await settle(fixture); fixture.nativeElement.querySelector('button[aria-label="Manage duties"]').click(); await settle(fixture);
      const manager = TestBed.inject(MatDialog).openDialogs[0].componentInstance as StaffDutyManagerComponent;
      expect(manager instanceof StaffDutyManagerComponent).toBeTrue(); manager.name.setValue('Inventory checking'); await manager.save(); await settle(fixture);
      expect(fixture.componentInstance.dutyOptions).toContain('Inventory checking');
      document.querySelector<HTMLButtonElement>('button[aria-label="Preview duty"]')!.click(); await settle(fixture);
      expect(TestBed.inject(MatDialog).openDialogs[1].componentInstance instanceof RecordDetailsComponent).toBeTrue(); TestBed.inject(MatDialog).openDialogs[1].close(); await settle(fixture);
      TestBed.inject(MatDialog).closeAll(); await settle(fixture); await fixture.componentInstance.edit(); await settle(fixture);
      const editor = TestBed.inject(MatDialog).openDialogs[0].componentInstance as StaffEditComponent; editor.addDuty(); await settle(fixture);
      expect(editor.dutyOptions(editor.assignments.at(0))).toContain('Inventory checking');
      editor.form.get('name')!.setValue('New member'); editor.selectDuty(editor.assignments.at(0), 'Inventory checking'); await editor.save(); await settle(fixture);
      expect((await service.getAll())[0].assignments[0].duty).toBe('Inventory checking');
    } finally { fixture.destroy(); }
  });
  it('renames, confirms removal and restores duties without rewriting saved staff assignments or hiding historical filters', async () => {
    const original = await service.save({ name: 'Ali', designation: '', employmentType: '', active: true, assignments: [{ duty: 'Original custom duty', shift: 'Night', startTime: '20:00', endTime: '08:00' }] });
    const fixture = TestBed.createComponent(StaffListComponent);
    try {
      await settle(fixture); fixture.componentInstance.manageDuties(); await settle(fixture);
      const manager = TestBed.inject(MatDialog).openDialogs[0].componentInstance as StaffDutyManagerComponent;
      const duty = manager.options.find(option => option.name === 'Original custom duty')!; manager.edit(duty); manager.name.setValue('Renamed custom duty'); await manager.save(); await settle(fixture);
      expect((await service.getById(original.id))!.assignments).toEqual(original.assignments);
      expect(fixture.componentInstance.dutyOptions).toContain('Original custom duty'); expect(fixture.componentInstance.dutyOptions).toContain('Renamed custom duty');
      const renamed = manager.options.find(option => option.id === duty.id)!; const confirm = spyOn(window, 'confirm').and.returnValue(false);
      await manager.toggle(renamed); expect(manager.options.find(option => option.id === duty.id)!.active).toBeTrue();
      confirm.and.returnValue(true); await manager.toggle(renamed); await settle(fixture); expect(manager.filtered.some(option => option.id === duty.id)).toBeFalse();
      expect(fixture.componentInstance.dutyOptions).toContain('Original custom duty'); expect(fixture.componentInstance.dutyOptions).not.toContain('Renamed custom duty');
      manager.status = 'inactive'; manager.onSearch(); expect(manager.filtered[0].id).toBe(duty.id); await manager.toggle(manager.filtered[0]); await settle(fixture);
      TestBed.inject(MatDialog).closeAll(); await settle(fixture); await fixture.componentInstance.edit(original); await settle(fixture);
      const editor = TestBed.inject(MatDialog).openDialogs[0].componentInstance as StaffEditComponent;
      expect(editor.dutyOptions(editor.assignments.at(0))).toContain('Original custom duty');
      editor.addDuty(); expect(editor.dutyOptions(editor.assignments.at(1))).not.toContain('Original custom duty');
      editor.removeDuty(1); editor.form.get('designation')!.setValue('Supervisor'); await editor.save();
      expect((await service.getById(original.id))!.assignments).toEqual(original.assignments);
    } finally { fixture.destroy(); }
  });
  it('validates duty names and keeps an unsaved duty draft after a failed database request', async () => {
    const ref = TestBed.inject(MatDialog).open(StaffDutyManagerComponent, { width: 'min(820px, calc(100vw - 32px))', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' }); await settle();
    const manager = ref.componentInstance; await manager.save(); expect(manager.name.touched).toBeTrue(); expect(db.allocateId).not.toHaveBeenCalled();
    manager.name.setValue('ot IN-CHARGE'); await manager.save(); expect(manager.error).toContain('already exists');
    const save = spyOn(TestBed.inject(StaffDutyCatalogService), 'save').and.rejectWith(new Error('Offline'));
    manager.name.setValue('Unsent duty'); await manager.save(); await settle(); expect(manager.error).toBe('Offline'); expect(manager.name.value).toBe('Unsent duty'); expect(manager.saving).toBeFalse();
    save.and.callThrough(); await manager.save(); await settle(); expect(manager.options.some(option => option.name === 'Unsent duty')).toBeTrue(); ref.close();
  });
  it('searches and paginates duty records in one modal scroll area with reachable close controls', async () => {
    collections.set('staffDutyCatalog', new Map(Array.from({ length: 45 }, (_, i) => [String(i + 1), { id: String(i + 1), name: 'Example duty ' + i, active: true }])));
    const ref = TestBed.inject(MatDialog).open(StaffDutyManagerComponent, { width: 'min(820px, calc(100vw - 32px))', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' }); await settle();
    const manager = ref.componentInstance; expect(manager.visible.length).toBe(20); manager.loadMore(); expect(manager.visible.length).toBe(40);
    manager.query = 'Example duty 44'; manager.onSearch(); await settle(); expect(manager.filtered.length).toBe(1); expect(manager.pagination.limit).toBe(20);
    manager.query = ''; manager.onSearch(); await settle();
    const panel = document.querySelector<HTMLElement>('.hmc-dialog-panel')!, content = panel.querySelector<HTMLElement>('mat-dialog-content')!;
    expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth + 1); expect(content.scrollHeight).toBeGreaterThan(content.clientHeight);
    const actions = panel.querySelector('mat-dialog-actions')!.getBoundingClientRect(); expect(actions.bottom).toBeLessThanOrEqual(innerHeight);
    expect(panel.querySelectorAll('mat-dialog-content').length).toBe(1); ref.close();
  });
  it('rejects unknown duties on new assignment rows and retries a failed duty lookup without changing the staff draft', async () => {
    const duties = TestBed.inject(StaffDutyCatalogService), load = spyOn(duties, 'getAll').and.rejectWith(new Error('Offline'));
    const fixture = TestBed.createComponent(StaffEditComponent);
    try {
      await settle(fixture); const editor = fixture.componentInstance; editor.form.get('name')!.setValue('Draft member'); editor.addDuty(); editor.assignments.at(0).get('duty')!.setValue('Unregistered duty');
      await editor.save(); expect(close).not.toHaveBeenCalled(); expect(editor.dutiesError).toContain('Unable to load duties');
      load.and.callThrough(); await editor.loadDuties(); editor.selectDuty(editor.assignments.at(0), 'OT in-charge'); editor.dutiesLoading = true;
      await editor.save(); expect(close).not.toHaveBeenCalled(); editor.dutiesLoading = false; await editor.save();
      expect(close).toHaveBeenCalledWith(jasmine.objectContaining({ name: 'Draft member' }));
    } finally { fixture.destroy(); }
  });
});
