import { FeedbackModule } from 'src/app/Shared/feedback.module';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { of, throwError } from 'rxjs';
import { Opd } from 'src/app/Models/opd.model';
import { OpdService } from 'src/app/Services/opd.service';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { OpdSlipComponent } from './opd-slip.component';
import { OpdListComponent } from '../opd-list/opd-list.component';
import { buildOpdThermalPrint, buildOpdThermalReceipt } from './opd-thermal-receipt';

const visit: Opd = { patientId: 42, patientName: 'Ali Khan', date: '2026-11-18', time: '13:35', sex: 'Male', drName: 'Dr Haq', followUp: 'After 2 weeks',
  age: 30, bp: '', temp: '', weight: '', patientCategory: '', amount: 0, phone: '', address: '', history: '', createdAt: '2026-11-18T08:35:00Z' };

describe('OPD thermal receipt content and selection', () => {
  it('retains the saved visit details, formats time and escapes long patient/doctor/follow-up text', () => {
    const record = { ...visit, patientName: 'Ali <script>alert(1)</script>', drName: 'Dr <b>Haq</b>', followUp: 'Review <img src=x onerror=alert(1)> in 2 weeks' };
    const container = document.createElement('div'); container.innerHTML = buildOpdThermalReceipt(record);
    expect(container.querySelector('script,b,img')).toBeNull();
    for (const text of ['42', '18/11/2026', '1:35 PM', record.patientName, record.drName, record.followUp, 'Male', 'THANK YOU!']) expect(container.textContent).toContain(text);
    const blank = document.createElement('div'); blank.innerHTML = buildOpdThermalReceipt({ ...visit, date: '', time: '', drName: '', followUp: '' });
    expect(blank.querySelectorAll('.slip-value').length).toBe(7); expect(blank.textContent).toContain('Not recorded');
    const batch = document.createElement('div'); batch.innerHTML = buildOpdThermalPrint([visit, { ...visit, patientId: 43 }]);
    expect(batch.querySelectorAll('.opd-thermal-receipt').length).toBe(2); expect(batch.querySelectorAll('.opd-thermal-feed').length).toBe(1);
  });

  it('loads the selected saved visit for a single slip and prints all matching rows beyond the visible batch', async () => {
    const service = jasmine.createSpyObj<OpdService>('opd', ['getOpdDetails']); service.getOpdDetails.and.returnValue(of({ ...visit, drName: 'Updated doctor' }));
    const dialog = jasmine.createSpyObj<MatDialog>('dialog', ['open']); const dependency: any = new NotifyUpdateService();
    const list = new OpdListComponent(service, dialog, dependency, dependency, dependency, dependency, dependency);
    try {
      await list.printSlip(visit); expect(service.getOpdDetails).toHaveBeenCalledWith(42);
      expect((dialog.open.calls.mostRecent().args[1]!.data as any).opds[0].drName).toBe('Updated doctor');
      list.filteredOpds = Array.from({ length: 45 }, (_, index) => ({ ...visit, patientId: index + 1 })); list.displayedOpds = list.filteredOpds.slice(0, 20);
      list.printAllSlips(); const records: Opd[] = (dialog.open.calls.mostRecent().args[1]!.data as any).opds;
      expect(records.length).toBe(45); records[0].patientName = 'Changed in preview'; expect(list.filteredOpds[0].patientName).toBe('Ali Khan');
    } finally { list.ngOnDestroy(); }
  });

  it('does not fall back to unrelated visits when no records match and reports failed single-slip reads', async () => {
    const service = jasmine.createSpyObj<OpdService>('opd', ['getOpdDetails']); const dialog = jasmine.createSpyObj<MatDialog>('dialog', ['open']);
    const dependency: any = new NotifyUpdateService(); const alert = jasmine.createSpy('alert'); dependency.alertNotify.subscribe(alert);
    const list = new OpdListComponent(service, dialog, dependency, dependency, dependency, dependency, dependency);
    try {
      list.opd = [visit]; list.filteredOpds = []; list.printAllSlips(); expect(dialog.open).not.toHaveBeenCalled();
      service.getOpdDetails.and.returnValue(throwError(() => new Error('offline'))); await list.printSlip(visit);
      expect(dialog.open).not.toHaveBeenCalled(); expect(alert).toHaveBeenCalledTimes(2);
    } finally { list.ngOnDestroy(); }
  });

  it('keeps preview records separate from the list while honoring the saved roll size', () => {
    const previous = localStorage.getItem('hmc.opdPaperWidth'); localStorage.setItem('hmc.opdPaperWidth', '58');
    try {
      const source = { ...visit }; const preview = new OpdSlipComponent({ close: () => {} } as MatDialogRef<OpdSlipComponent>, { opds: [source] });
      source.patientName = 'Changed outside preview'; expect(preview.opds[0].patientName).toBe('Ali Khan'); expect(preview.paperWidth).toBe(58);
    } finally { if (previous === null) localStorage.removeItem('hmc.opdPaperWidth'); else localStorage.setItem('hmc.opdPaperWidth', previous); }
  });
});

describe('OPD thermal preview layout', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FeedbackModule, CommonModule, FormsModule, NoopAnimationsModule, MatDialogModule, MatButtonModule, MatIconModule], declarations: [OpdSlipComponent] }).compileComponents();
  });
  afterEach(() => TestBed.inject(MatDialog).closeAll());
  it('wraps long visit details in a single scrolling column and keeps the print controls visible', async () => {
    const ref = TestBed.inject(MatDialog).open(OpdSlipComponent, { width: '480px', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel', data: { opds: [
      { ...visit, patientName: 'LongPatientName'.repeat(20), drName: 'LongDoctorName'.repeat(20), followUp: 'LongFollowUpInstructions'.repeat(30) }, { ...visit, patientId: 43 },
    ] } });
    TestBed.inject(ApplicationRef).tick(); await new Promise(resolve => setTimeout(resolve, 40));
    const panel = document.querySelector<HTMLElement>('.hmc-dialog-panel')!;
    const content = panel.querySelector<HTMLElement>('mat-dialog-content')!, surface = panel.querySelector<HTMLElement>('.mat-mdc-dialog-surface')!;
    expect(surface.getBoundingClientRect().right).toBeLessThanOrEqual(innerWidth + 1); expect(surface.getBoundingClientRect().bottom).toBeLessThanOrEqual(innerHeight + 1);
    expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth + 1); expect(content.scrollHeight).toBeGreaterThan(content.clientHeight);
    expect(panel.querySelectorAll('.opd-thermal-receipt').length).toBe(2);
    expect(panel.querySelector('mat-dialog-actions')!.getBoundingClientRect().bottom).toBeLessThanOrEqual(surface.getBoundingClientRect().bottom + 1);
    expect(panel.querySelectorAll('.slip-thanks').length).toBe(2); ref.close();
  });
});
