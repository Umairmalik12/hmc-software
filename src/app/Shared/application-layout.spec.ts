import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Subject } from 'rxjs';
import { HomeComponent } from '../Components/home/home.component';
import { PatientService } from '../Services/patient.service';
import { OpdService } from '../Services/opd.service';
import { LabService } from '../Services/lab.service';
import { InpatientService } from '../Services/inpatient.service';
import { MedicineService } from '../Services/medicine.service';
import { SupabaseDataService } from '../Services/supabase-data.service';
import { UserLoginService } from '../Services/user-login.service';
import { SearchableSelectComponent } from './searchable-select.component';
import { FeedbackModule } from './feedback.module';

@Component({ selector: 'app-patient', template: `<section class="body"><header class="list-header"><div class="list-intro"><span class="list-icon"><mat-icon>people_outline</mat-icon></span><div><h1>Operation patients</h1><p>Registration, contact details and planned procedures.</p></div></div><span class="record-count"><strong>1</strong> records</span><button mat-flat-button color="primary"><mat-icon>add</mat-icon>New patient</button></header><div class="search-bar"><mat-form-field appearance="outline"><mat-label>MR Number</mat-label><input matInput></mat-form-field><app-searchable-select class="catalog-filter" label="Doctor name" [options]="doctors" [(value)]="doctor"></app-searchable-select><app-searchable-select class="catalog-filter" label="Procedure" [options]="procedures" [(value)]="procedure"></app-searchable-select><div class="search-actions"><button mat-raised-button color="primary"><mat-icon>search</mat-icon>Search</button><button mat-raised-button color="accent"><mat-icon>filter_alt_off</mat-icon>Clear</button><button class="search-export" mat-stroked-button><mat-icon>file_download</mat-icon>Export</button></div></div><div class="action-buttons"><button mat-icon-button class="table-btn" aria-label="Preview"><mat-icon>visibility</mat-icon></button><button mat-icon-button class="table-btn" aria-label="Edit"><mat-icon>edit_note</mat-icon></button><button mat-icon-button class="table-btn mat-warn" aria-label="Delete"><mat-icon>delete_outline</mat-icon></button></div></section>` })
class LayoutPatient {
  doctor = 'Dr Roman'; procedure = ''; doctors = ['Dr Roman', 'Dr Sara']; procedures = ['Left nephrectomy', 'Cystoscopy'];
}

describe('Application icons and responsive shell alignment', () => {
  const center = (element: Element) => { const rect = element.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; };
  const aligned = (icon: Element, container: Element): void => {
    expect(Math.abs(center(icon).x - center(container).x)).withContext(container.className + ' horizontal').toBeLessThanOrEqual(1);
    expect(Math.abs(center(icon).y - center(container).y)).withContext(container.className + ' vertical').toBeLessThanOrEqual(1);
  };
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, NoopAnimationsModule, RouterTestingModule, MatSidenavModule, MatToolbarModule, MatListModule, MatMenuModule, MatDialogModule, MatButtonModule, MatIconModule, MatInputModule, SearchableSelectComponent, FeedbackModule],
      declarations: [HomeComponent, LayoutPatient], schemas: [NO_ERRORS_SCHEMA],
      providers: [...[PatientService, OpdService, LabService, InpatientService, MedicineService].map(provide => ({ provide, useValue: {} })),
        { provide: SupabaseDataService, useValue: { changes: new Subject<string>() } }, { provide: UserLoginService, useValue: { getLoginUser: async () => 'admin' } }],
    }).compileComponents();
  });
  const open = async () => {
    const fixture = TestBed.createComponent(HomeComponent); fixture.detectChanges();
    await document.fonts.ready; await new Promise(resolve => setTimeout(resolve, 80)); fixture.detectChanges(); return fixture;
  };
  it('centers list, avatar, notification, navigation and table action icons at their intended sizes', async () => {
    const fixture = await open();
    try {
      const root: HTMLElement = fixture.nativeElement;
      for (const selector of ['.list-icon', '.user-avatar', '.notification-bell', '.table-btn', '.nav-toolbar > button', '.brand-mark']) {
        for (const container of Array.from(root.querySelectorAll<HTMLElement>(selector))) {
          if (!container.getBoundingClientRect().width) continue;
          const icon = container.querySelector('mat-icon')!; aligned(icon, container);
          expect(parseFloat(getComputedStyle(icon).fontSize)).toBeGreaterThanOrEqual(selector === '.table-btn' ? 18 : 20);
        }
      }
    } finally { fixture.destroy(); }
  });
  it('keeps dropdown search and suffix controls vertically centered without inherited filter-button margins', async () => {
    const fixture = await open();
    try {
      const root: HTMLElement = fixture.nativeElement;
      for (const field of Array.from(root.querySelectorAll<HTMLElement>('.hmc-searchable-field'))) {
        const wrapper = field.querySelector('.mat-mdc-text-field-wrapper')!;
        const search = field.querySelector('.hmc-picker-search')!;
        expect(Math.abs(center(search).y - center(wrapper).y)).toBeLessThanOrEqual(1);
        for (const button of Array.from(field.querySelectorAll<HTMLElement>('.hmc-picker-button'))) {
          aligned(button.querySelector('mat-icon')!, button);
          expect(Math.abs(center(button).y - center(wrapper).y)).toBeLessThanOrEqual(1);
          expect(getComputedStyle(button).marginTop).toBe('0px'); expect(getComputedStyle(button).marginBottom).toBe('0px');
        }
      }
    } finally { fixture.destroy(); }
  });
  it('keeps the account and header controls inside the content area with the sidebar both open and closed', async () => {
    const fixture = await open();
    try {
      const root: HTMLElement = fixture.nativeElement;
      for (let state = 0; state < 2; state++) {
        fixture.detectChanges(); await new Promise(resolve => setTimeout(resolve, 40));
        const toolbar = root.querySelector('.nav-toolbar')!.getBoundingClientRect();
        const account = root.querySelector('.user-info')!.getBoundingClientRect();
        expect(account.right).toBeLessThanOrEqual(toolbar.right + 1); expect(account.left).toBeGreaterThanOrEqual(toolbar.left);
        expect(root.querySelector<HTMLElement>('.nav-toolbar')!.scrollWidth).toBeLessThanOrEqual(toolbar.width + 1);
        root.querySelector<HTMLButtonElement>('.nav-toolbar > button')!.click();
      }
    } finally { fixture.destroy(); }
  });
});
