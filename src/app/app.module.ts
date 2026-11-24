import { SearchableSelectComponent } from './Shared/searchable-select.component';
import { TeamAccountsComponent } from './Components/team-accounts/team-accounts.component';
import { DateTimeFieldComponent } from './Shared/date-time-field.component';
import { ClinicalCatalogComponent } from './Components/clinical-catalog/clinical-catalog.component';
import { ClinicalCatalogSelectComponent } from './Components/clinical-catalog/clinical-catalog-select.component';
import { ThermalReceiptPreviewComponent } from './Shared/thermal-receipt-preview.component';
import { PatientTokenPreviewComponent } from './Components/patient-token/patient-token-preview.component';
import { FeedbackModule } from './Shared/feedback.module';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { LayoutModule } from '@angular/cdk/layout';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { LoginComponent } from './Components/login/login.component';
import { HomeComponent } from './Components/home/home.component';
import { StaffListComponent } from './Components/staff/staff-list.component';
import { StaffEditComponent } from './Components/staff/staff-edit.component';
import { StaffDutyManagerComponent } from './Components/staff/staff-duty-manager.component';
import { AdminAssistantComponent } from './Components/admin-assistant/admin-assistant.component';
import { ExpensesComponent } from './Components/expenses/expenses.component';
import { ExpenseEditComponent } from './Components/expenses/expense-edit.component';
import { ExpenseMonthPreviewComponent } from './Components/expenses/expense-month-preview.component';
import { PatientComponent } from './Components/patient/patient.component';
import { PatientListComponent } from './Components/patient/patient-list/patient-list.component';
import { PatientEditComponent } from './Components/patient/patient-edit/patient-edit.component';
import { MatTableModule } from '@angular/material/table';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MedicineCatalogComponent } from './Components/precipion/medicine-catalog/medicine-catalog.component';
import { MedicineOptionDialogComponent } from './Components/precipion/medicine-catalog/medicine-option-dialog.component';
import { PrescriptionMedicineSelectComponent } from './Components/precipion/medicine-catalog/prescription-medicine-select.component';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialogModule } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MatOptionModule } from '@angular/material/core';
import { AuthGuardService } from './Services/Guard-Services/auth-guard.service';
import { AgePipePipe } from './Pipes/age-pipe.pipe';
import { OpdComponent } from './Components/opdslip/opd.component';
import { OpdListComponent } from './Components/opdslip/opd-list/opd-list.component';
import { OpdDeleteConfirmComponent } from './Components/opdslip/opd-list/opd-delete-confirm.component';
import { PermissionManagementComponent } from './Components/permissions/permission-management.component';
import { PermissionDirective } from './Shared/permission.directive';
import { OpdEditComponent } from './Components/opdslip/opd-edit/opd-edit.component';
import { LabComponent } from './Components/lab/lab.component';
import { LabListComponent } from './Components/lab/lab-list/lab-list.component';
import { LabSlipPreviewComponent } from './Components/lab/lab-slip-preview.component';
import { LabEditComponent } from './Components/lab/lab-edit/lab-edit.component';
import { OtMedicineCatalogComponent } from './Components/ot-medicine-catalog/ot-medicine-catalog.component';
import { OtMedicineEditComponent } from './Components/ot-medicine-catalog/ot-medicine-edit.component';
import { OtMedicineDeleteComponent } from './Components/ot-medicine-catalog/ot-medicine-delete.component';
import { OtFormComponent } from './Components/otslip/otslip.component';
import { OtlistComponent } from './Components/otlist/otlist.component';
import { PaymentComponent } from './Components/payment/payment.component';
import { PaymentSlipPreviewComponent } from './Components/payment/payment-slip-preview.component';
import { PreciptionComponent } from './Components/precipion/precipion.component';
import { PrescriptionListComponent } from './Components/precipion/prescription-list.component';
import { PrescriptionPreviewComponent } from './Components/precipion/prescription-preview.component';
import { PrescriptionDocumentComponent } from './Components/precipion/prescription-document.component';
import { ProcedureSelectComponent } from './Components/procedures/procedure-select.component';
import { ProceduresComponent } from './Components/procedures/procedures.component';
import { OtMedicinePreviewComponent } from './Components/otslip/ot-medicine-preview.component';
import { RecordDetailsComponent } from './Components/record-details/record-details.component';
import { RecordPreviewDirective } from './Components/record-details/record-preview.directive';
import { RoomSelectComponent } from './Components/rooms/room-select.component';
import { RoomsComponent } from './Components/rooms/rooms.component';
import { ScrollPaginationDirective } from './Shared/scroll-pagination.directive';
import { ScrollListFooterComponent } from './Shared/scroll-list-footer.component';
import { InpatientComponent } from './Components/inpatient/inpatient.component';
import { InpatientListComponent } from './Components/inpatient/inpatient-list/inpatient-list.component';
import { InpatientEditComponent } from './Components/inpatient/inpatient-edit/inpatient-edit.component';
import { SupabaseDataService } from './Services/supabase-data.service';
import { OpdSlipComponent } from './Components/opdslip/opd-slip/opd-slip.component';
import { MedicineComponent } from './Components/medicine/medicine.component';
import { MedicineListComponent } from './Components/medicine/medicine-list/medicine-list.component';
import { MedicineEditComponent } from './Components/medicine/medicine-edit/medicine-edit.component';
import { MedicineSlipComponent } from './Components/medicine/medicine-slip/medicine-slip.component';
import { MedicineService } from './Services/medicine.service';
import { MedicineDataService } from './Services/medicine-data.service';
import { PatientTokenComponent } from './Components/patient-token/patient-token.component';
import { TimeFormatPipe } from './Pipes/time-format.pipe';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    HomeComponent,
    StaffListComponent,
    StaffEditComponent,
    StaffDutyManagerComponent,
    AdminAssistantComponent,
    ExpensesComponent,
    ExpenseEditComponent,
    ExpenseMonthPreviewComponent,
    PatientComponent,
    PatientListComponent,
    PatientEditComponent,
    OpdComponent,
    OpdListComponent,
    OpdDeleteConfirmComponent,
    PermissionManagementComponent,
    PermissionDirective,
    OpdEditComponent,
    OpdSlipComponent,
    LabComponent,
    LabListComponent,
    LabSlipPreviewComponent,
    LabEditComponent,
    OtFormComponent,
    OtMedicineCatalogComponent,
    OtMedicineEditComponent,
    OtMedicineDeleteComponent,
    AgePipePipe,
    OtlistComponent,
    PaymentComponent,
    PaymentSlipPreviewComponent,
    PreciptionComponent,
    MedicineCatalogComponent,
    MedicineOptionDialogComponent,
    PrescriptionMedicineSelectComponent,
    PrescriptionListComponent,
    PrescriptionPreviewComponent,
    PrescriptionDocumentComponent,
    ProcedureSelectComponent,
    ProceduresComponent,
    ClinicalCatalogComponent,
    OtMedicinePreviewComponent,
    RecordDetailsComponent,
    RecordPreviewDirective,
    RoomSelectComponent,
    RoomsComponent,
    ScrollPaginationDirective,
    ScrollListFooterComponent,
    InpatientComponent,
    InpatientListComponent,
    InpatientEditComponent,
    MedicineComponent,
    MedicineListComponent,
    MedicineEditComponent,
    MedicineSlipComponent,
    PatientTokenComponent,
    PatientTokenPreviewComponent,
    ThermalReceiptPreviewComponent,
    TimeFormatPipe,
  ],
  imports: [
    TeamAccountsComponent,
    BrowserModule,
    ClinicalCatalogSelectComponent,
    SearchableSelectComponent,
    DateTimeFieldComponent,
    FeedbackModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    LayoutModule,
    MatToolbarModule,
    MatButtonModule,
    MatSidenavModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatTableModule,
    MatCardModule,
    MatFormFieldModule,
    HttpClientModule,
    MatPaginatorModule,
    ReactiveFormsModule,
    FormsModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatRadioModule,
    MatCheckboxModule,
    MatDialogModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatOptionModule,
  ],
  providers: [
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        width: 'min(820px, calc(100vw - 32px))',
        maxWidth: '94vw',
        maxHeight: '92vh',
        panelClass: 'hmc-dialog-panel',
        autoFocus: true,
      },
    },
    AuthGuardService,
    SupabaseDataService,
    MedicineService,
    MedicineDataService,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
