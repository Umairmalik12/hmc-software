import { FeedbackModule } from 'src/app/Shared/feedback.module';
import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { PatientEditComponent } from './patient/patient-edit/patient-edit.component';
import { OpdEditComponent } from './opdslip/opd-edit/opd-edit.component';
import { LabEditComponent } from './lab/lab-edit/lab-edit.component';
import { InpatientEditComponent } from './inpatient/inpatient-edit/inpatient-edit.component';
import { MedicineEditComponent } from './medicine/medicine-edit/medicine-edit.component';
import { MedicineService } from '../Services/medicine.service';
import { ProcedureSelectComponent } from './procedures/procedure-select.component';
import { ProcedureService, DEFAULT_PROCEDURES } from '../Services/procedure.service';
import { SupabaseDataService } from '../Services/supabase-data.service';
import { Subject } from 'rxjs';
import { RoomSelectComponent } from './rooms/room-select.component';
import { RoomService, DEFAULT_ROOMS } from '../Services/room.service';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { PrescriptionMedicineSelectComponent } from './precipion/medicine-catalog/prescription-medicine-select.component';
import { DEFAULT_PRESCRIPTION_MEDICINES, PrescriptionMedicineCatalogService } from '../Services/prescription-medicine-catalog.service';

describe('Responsive form dialogs', () => {
  const components = [PatientEditComponent, OpdEditComponent, LabEditComponent, InpatientEditComponent, MedicineEditComponent];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeedbackModule, NoopAnimationsModule, ReactiveFormsModule, MatDialogModule, MatInputModule,
        MatSelectModule, MatAutocompleteModule, MatIconModule, MatButtonModule, MatDatepickerModule, MatNativeDateModule],
      declarations: [...components, ProcedureSelectComponent, RoomSelectComponent, PrescriptionMedicineSelectComponent],
      providers: [{ provide: MedicineService, useValue: {} },
        { provide: RoomService, useValue: { getAll: async () => DEFAULT_ROOMS } },
        { provide: PrescriptionMedicineCatalogService, useValue: { getAll: async () => DEFAULT_PRESCRIPTION_MEDICINES, changes: new Subject<void>() } },
        { provide: ProcedureService, useValue: { getAll: () => Promise.resolve(DEFAULT_PROCEDURES) } },
        { provide: SupabaseDataService, useValue: { changes: new Subject<string>() } }],
    }).compileComponents();
  });

  afterEach(() => TestBed.inject(MatDialog).closeAll());

  for (const component of components) {
    it(`keeps ${component.name} within the viewport with a single content scroll area`, async () => {
      const dialog = TestBed.inject(MatDialog).open(component as any, {
        data: {}, width: 'min(820px, calc(100vw - 28px))', maxWidth: '94vw', panelClass: 'hmc-dialog-panel',
      });
      TestBed.inject(ApplicationRef).tick();
      await new Promise(resolve => setTimeout(resolve, 30));

      const panel = document.querySelector<HTMLElement>('.hmc-dialog-panel')!;
      const surface = panel.querySelector<HTMLElement>('.mat-mdc-dialog-surface')!;
      const content = panel.querySelector<HTMLElement>('mat-dialog-content')!;
      const form = panel.querySelector<HTMLElement>('form')!;
      const actions = panel.querySelector<HTMLElement>('mat-dialog-actions')!;
      const bounds = surface.getBoundingClientRect();

      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(window.innerWidth + 1);
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.bottom).withContext(JSON.stringify({ viewport: [innerWidth, innerHeight],
        surface: bounds.toJSON(), pane: panel.getBoundingClientRect().toJSON(),
        overlay: panel.closest('.cdk-overlay-container')!.getBoundingClientRect().toJSON(),
        host: surface.firstElementChild!.getBoundingClientRect().toJSON(),
      })).toBeLessThanOrEqual(window.innerHeight + 1);
      expect(content.clientHeight).toBeGreaterThan(80);
      expect(form.scrollHeight).toBeLessThanOrEqual(form.clientHeight + 1);
      expect(actions.getBoundingClientRect().bottom).toBeLessThanOrEqual(bounds.bottom + 1);
      expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth + 1);
      expect(panel.textContent).not.toContain('Marital');
      if (window.innerWidth <= 520) {
        const grid = panel.querySelector<HTMLElement>('.form-grid')!;
        expect(getComputedStyle(grid).gridTemplateColumns.split(' ').length).toBe(1);
      }
    });
  }
});
