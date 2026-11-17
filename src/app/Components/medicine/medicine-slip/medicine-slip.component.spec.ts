import { FeedbackModule } from 'src/app/Shared/feedback.module';
import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MedicineSlipComponent } from './medicine-slip.component';

describe('Daily medicine thermal preview layout', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeedbackModule, CommonModule, FormsModule, NoopAnimationsModule, MatDialogModule, MatButtonModule, MatIconModule], declarations: [MedicineSlipComponent],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it('shows every medicine and its room label in a scrolling preview without overflowing the modal', async () => {
    const ref = TestBed.inject(MatDialog).open(MedicineSlipComponent, { width: '480px', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel', data: { record: {
      medicineId: 42, patientName: 'LongPatientName'.repeat(10), roomNo: 'General Ward Bed 1 - ' + 'LongRoomLabel'.repeat(8), doctorName: 'Dr Haq', createdAt: new Date().toISOString(),
      medicines: Array.from({ length: 20 }, (_, index) => ({ medicineName: 'Medicine ' + index + ' ' + 'LongMedicineName'.repeat(8), quantity: 2 })),
    } } });
    TestBed.inject(ApplicationRef).tick();
    await new Promise(resolve => setTimeout(resolve, 40));
    const panel = document.querySelector<HTMLElement>('.hmc-dialog-panel')!;
    const surface = panel.querySelector<HTMLElement>('.mat-mdc-dialog-surface')!;
    const content = panel.querySelector<HTMLElement>('mat-dialog-content')!;
    const actions = panel.querySelector<HTMLElement>('mat-dialog-actions')!;
    expect(surface.getBoundingClientRect().right).toBeLessThanOrEqual(innerWidth + 1);
    expect(surface.getBoundingClientRect().bottom).toBeLessThanOrEqual(innerHeight + 1);
    expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth + 1);
    expect(content.scrollHeight).toBeGreaterThan(content.clientHeight);
    expect(actions.getBoundingClientRect().bottom).toBeLessThanOrEqual(surface.getBoundingClientRect().bottom + 1);
    expect(panel.querySelectorAll('.medicine-line:not(.medicine-heading)').length).toBe(20);
    expect(panel.querySelector('.room-row')!.textContent).toContain('General Ward Bed 1');
    expect(panel.querySelector('.slip-thanks')!.textContent).toBe('THANK YOU!');
    const receipt = panel.querySelector<HTMLElement>('.daily-medicine-receipt')!;
    expect(getComputedStyle(receipt).fontFamily).toContain('Segoe UI');
    const mm = 96 / 25.4;
    expect(receipt.getBoundingClientRect().width / mm).toBeCloseTo(ref.componentInstance.paperWidth === 58 ? 45 : 69, 1);
    ref.componentInstance.paperWidth = ref.componentInstance.paperWidth === 58 ? 80 : 58;
    TestBed.inject(ApplicationRef).tick();
    expect(receipt.getBoundingClientRect().width / mm).toBeCloseTo(ref.componentInstance.paperWidth === 58 ? 45 : 69, 1);
    expect(ref.componentInstance.record.medicineId).toBe(42); ref.close();
  });
});
