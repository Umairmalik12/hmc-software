import { FeedbackModule } from 'src/app/Shared/feedback.module';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogModule, MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RecordDetailsComponent } from './record-details.component';
import { RecordPreviewDirective } from './record-preview.directive';

@Component({ template: `<button type="button" [appRecordPreview]="record" previewTitle="Patient preview">Preview</button>` })
class PreviewHost {
  record: object | null = { patientName: 'Ali <script>alert(1)</script>', address: 'LongUnbrokenAddress'.repeat(30),
    medicines: [{ medicineName: 'Medicine A', quantity: 2, instructions: 'After food' }], amount: 100, staffName: 'Ayesha' };
}

describe('Record preview dialog', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeedbackModule, CommonModule, NoopAnimationsModule, MatDialogModule, MatButtonModule, MatIconModule],
      declarations: [RecordDetailsComponent, RecordPreviewDirective, PreviewHost],
      providers: [{ provide: MAT_DIALOG_DEFAULT_OPTIONS, useValue: { width: 'min(820px, calc(100vw - 32px))', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' } }],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it('shows readable prices, dates, empty values, nested medicines and boolean fields without changing the original record', () => {
    const record = { amount: 100.5, staffName: 'Ayesha', shiftDate: '2026-11-16', recordedByEmail: 'staff@example.test', recordedById: 'account-id',
      phone: '', dischargeDate: null, maritalStatus: 'Married', medicines: [{ medicineName: 'Medicine A', quantity: 2, instructions: 'After food', morning: true, evening: false }] };
    const before = JSON.stringify(record);
    const preview = new RecordDetailsComponent({ title: 'Test', record });
    expect(preview.fields.find(field => field.label === 'Amount')!.value).toBe('Rs 100.50');
    expect(preview.fields.find(field => field.label === 'Counter staff')!.value).toBe('Ayesha');
    expect(preview.fields.find(field => field.label === 'Phone')!.value).toBe('Not recorded');
    expect(preview.fields.find(field => field.label === 'Medicines')!.value).toContain('Instructions: After food');
    expect(preview.fields.find(field => field.label === 'Medicines')!.value).toContain('Morning: Yes');
    expect(preview.fields.find(field => field.label === 'Medicines')!.value).toContain('Evening: No');
    expect(preview.fields.some(field => field.label === 'Recorded by')).toBeTrue();
    expect(preview.fields.some(field => /Marital|Recorded by Id/.test(field.label))).toBeFalse();
    expect(JSON.stringify(record)).toBe(before);
    record.staffName = 'Changed after opening';
    expect(preview.fields.find(field => field.label === 'Counter staff')!.value).toBe('Ayesha');
  });

  it('opens a read-only modal from a list button, wraps long text, and closes without changing records', async () => {
    const fixture = TestBed.createComponent(PreviewHost);
    try {
      fixture.detectChanges();
      const before = JSON.stringify(fixture.componentInstance.record);
      fixture.nativeElement.querySelector('button').click();
      await new Promise(resolve => setTimeout(resolve, 40));
      const panel = document.querySelector<HTMLElement>('.hmc-dialog-panel')!;
      expect(panel).not.toBeNull();
      expect(panel.textContent).toContain('Patient preview');
      expect(panel.textContent).toContain('Ali <script>alert(1)</script>');
      expect(panel.querySelector('script,input,select,textarea')).toBeNull();
      const surface = panel.querySelector<HTMLElement>('.mat-mdc-dialog-surface')!;
      const bounds = surface.getBoundingClientRect();
      expect(bounds.left).toBeGreaterThanOrEqual(0); expect(bounds.right).toBeLessThanOrEqual(innerWidth + 1);
      expect(bounds.bottom).toBeLessThanOrEqual(innerHeight + 1);
      const grid = panel.querySelector<HTMLElement>('.record-details-grid')!;
      expect(grid.scrollWidth).toBeLessThanOrEqual(grid.clientWidth + 1);
      panel.querySelector<HTMLButtonElement>('mat-dialog-actions button')!.click();
      await new Promise(resolve => setTimeout(resolve, 40));
      expect(TestBed.inject(MatDialog).openDialogs.length).toBe(0);
      expect(JSON.stringify(fixture.componentInstance.record)).toBe(before);
    } finally { fixture.destroy(); }
  });

  it('does not open an empty selection', () => {
    const fixture = TestBed.createComponent(PreviewHost); fixture.componentInstance.record = null;
    fixture.detectChanges(); fixture.nativeElement.querySelector('button').click();
    expect(TestBed.inject(MatDialog).openDialogs.length).toBe(0); fixture.destroy();
  });
});
