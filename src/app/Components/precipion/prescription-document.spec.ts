import { FeedbackModule } from 'src/app/Shared/feedback.module';
import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { emptyPrescription } from 'src/app/Models/prescription.model';
import { PrescriptionDocumentComponent } from './prescription-document.component';
import { buildPrescriptionDocument, PRESCRIPTION_FIELDS, prescriptionDateTime } from './prescription-document';
import { printPrescription } from './prescription-print';
import { PrescriptionPreviewComponent } from './prescription-preview.component';

describe('Prescription document and one-page print', () => {
  it('retains the existing fields, local date/time and medication timing without adding sample fields', () => {
    expect(PRESCRIPTION_FIELDS.map(field => field.key)).toEqual(['refId', 'date', 'time', 'visit', 'name', 'age', 'sex', 'weight', 'contact', 'allergies', 'findings', 'symptoms', 'diagnosis']);
    const local = new Date(2026, 10, 17, 13, 35).toISOString();
    expect(prescriptionDateTime(local, 'time')).toContain('1:35');
  });

  it('keeps patient text escaped and preview layout classes intact after Angular sanitization', async () => {
    await TestBed.configureTestingModule({imports: [FeedbackModule],  declarations: [PrescriptionDocumentComponent] }).compileComponents();
    const fixture = TestBed.createComponent(PrescriptionDocumentComponent);
    const record = emptyPrescription();
    record.patient.name = 'Ali <img src=x onerror=alert(1)> & Khan';
    record.medicines[0] = { name: 'Medicine <A>', morning: true, afternoon: false, evening: true };
    fixture.componentInstance.record = record;
    fixture.componentInstance.ngOnChanges();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[onerror]')).toBeNull();
    expect(element.textContent).toContain(record.patient.name);
    expect(element.querySelectorAll('.rx-span-3').length).toBe(1);
    expect(element.querySelectorAll('.rx-dose')[0].textContent).toBe('✓');
    expect(element.querySelector('.rx-logo')!.getAttribute('src')).toContain('urocare-logo.svg');
    expect(element.querySelectorAll('input,textarea').length).toBe(0);
    fixture.destroy();
  });

  it('opens a read-only modal with visible close/print controls on desktop and mobile', async () => {
    await TestBed.configureTestingModule({
      imports: [FeedbackModule, NoopAnimationsModule, MatDialogModule, MatButtonModule, MatIconModule],
      declarations: [PrescriptionDocumentComponent, PrescriptionPreviewComponent],
    }).compileComponents();
    const record = emptyPrescription();
    record.patient.name = 'Ali Khan';
    const dialog = TestBed.inject(MatDialog).open(PrescriptionPreviewComponent, {
      data: { record }, width: '950px', maxWidth: '96vw', maxHeight: '94dvh',
      panelClass: 'prescription-preview-panel', autoFocus: false,
    });
    TestBed.inject(ApplicationRef).tick();
    await new Promise(resolve => setTimeout(resolve, 30));
    try {
      const panel = document.querySelector<HTMLElement>('.prescription-preview-panel')!;
      const bounds = panel.getBoundingClientRect();
      const actions = panel.querySelector<HTMLElement>('.rx-preview-actions')!;
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(innerWidth + 1);
      expect(bounds.bottom).toBeLessThanOrEqual(innerHeight + 1);
      expect(actions.getBoundingClientRect().bottom).toBeLessThanOrEqual(bounds.bottom + 1);
      expect(panel.querySelectorAll('input,textarea').length).toBe(0);
      expect(panel.querySelector('.rx-sheet')!.textContent).toContain('Ali Khan');
      expect(panel.querySelector('button[aria-label="Close prescription preview"]')).not.toBeNull();
    } finally { dialog.close(); }
  });

  for (const long of [false, true]) {
    it(`fits the complete ${long ? 'long' : 'standard'} prescription on one A4 page before printing`, async () => {
      const frame = document.createElement('iframe');
      frame.style.width = '900px';
      document.body.appendChild(frame);
      const popup = frame.contentWindow!;
      spyOn(window, 'open').and.returnValue(popup);
      spyOn(popup, 'focus');
      spyOn(popup, 'close');
      const printed = new Promise<void>(resolve => spyOn(popup, 'print').and.callFake(resolve));
      const record = emptyPrescription();
      record.patient.name = 'Ali Khan';
      record.patient.findings = long ? 'Long clinical notes with all text retained. '.repeat(30) : 'Existing findings';
      record.medicines = Array.from({ length: long ? 30 : 5 }, (_, index) => ({
        name: `Medicine ${index + 1}` + (long ? ' with long patient-specific directions'.repeat(3) : ''),
        morning: true, afternoon: false, evening: true,
      }));
      try {
        expect(printPrescription(record)).toBeTrue();
        await printed;
        const page = popup.document.getElementById('prescription-print-page')!;
        const sheet = page.querySelector<HTMLElement>('.rx-sheet')!;
        expect(page.getBoundingClientRect().height).toBeLessThan(277 * 96 / 25.4);
        expect(sheet.getBoundingClientRect().bottom).toBeLessThanOrEqual(page.getBoundingClientRect().bottom + 1);
        expect(sheet.textContent).toContain(record.patient.findings);
        expect(sheet.textContent).toContain(record.medicines[record.medicines.length - 1].name);
        expect(popup.document.querySelectorAll('.rx-medicines tbody tr').length).toBe(long ? 30 : 8);
        expect(sheet.scrollWidth).toBeLessThanOrEqual(sheet.clientWidth + 1);
        expect(popup.close).not.toHaveBeenCalled();
        popup.dispatchEvent(new Event('afterprint'));
        expect(popup.close).toHaveBeenCalled();
      } finally { frame.remove(); }
    });
  }

  it('does not include editable inputs or scripts in the saved-record print markup', () => {
    const record = emptyPrescription();
    const html = buildPrescriptionDocument(record, document.baseURI);
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<script');
  });
});
