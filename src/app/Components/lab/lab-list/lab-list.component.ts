import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewChild
} from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';

import { LabEditComponent } from '../lab-edit/lab-edit.component';
import { LabPatientDataService } from 'src/app/Services/lab-data.service';
import { LabService } from 'src/app/Services/lab.service';
import { LabPatient } from 'src/app/Models/lab.model';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';

@Component({
  selector: 'app-lab-list',
  templateUrl: './lab-list.component.html',
  styleUrls: ['./lab-list.component.css']
})
export class LabListComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = [
    'patientId',
    'name',
    'testName',
    'price',
    'suggestedDr',
    'dateTime',
    'action'
  ];

  dataSource: LabPatientDataService;
  total = 0;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private labService: LabService,
    private dialog: MatDialog,
    private intl: MatPaginatorIntl,
    private cdr: ChangeDetectorRef,
    private notifyUpdate: NotifyUpdateService
  ) {
    this.dataSource = new LabPatientDataService(this.labService);

    this.notifyUpdate.notify.subscribe(() => {
      this.refreshData(0, 5);
    });
  }

  ngOnInit(): void {
    this.refreshData(0, 5);
  }

  ngAfterViewInit(): void {
    this.paginator.page.subscribe(() => {
      this.refreshData(this.paginator.pageIndex, this.paginator.pageSize);
    });

    this.cdr.detectChanges(); 
  }

  refreshData(pageIndex: number, pageSize: number): void {
    this.dataSource.loadLabPatient('', 'asc', pageIndex, pageSize);
    this.total = this.labService.total;
  }

  editLabPatient(id: number): void {
    this.labService.getLabPatientDetails(id).subscribe((patient: LabPatient) => {
      const dialogConfig = new MatDialogConfig();
      dialogConfig.disableClose = true;
      dialogConfig.autoFocus = true;
      dialogConfig.data = patient;

      const dialogRef = this.dialog.open(LabEditComponent, dialogConfig);

      dialogRef.afterClosed().subscribe((updated: LabPatient) => {
        if (updated) {
          const success = this.labService.updateLabPatient(updated);
          if (success) {
            this.notifyUpdate.notify.next(true);
            this.notifyUpdate.alertNotify.next({
              msg: 'Patient Data Updated Successfully',
              type: 'success'
            });
          } else {
            this.notifyUpdate.alertNotify.next({
              msg: 'Something went wrong',
              type: 'error'
            });
          }
        }
      });
    });
  }

  deleteLabPatient(id: number): void {
  if (confirm('Are you sure you want to delete this lab patient?')) {
    this.labService.deleteLabPatient(id).subscribe({
      next: (success:any) => {
        if (success) {
          this.notifyUpdate.notify.next(true);
          this.notifyUpdate.alertNotify.next({
            msg: 'Patient deleted successfully',
            type: 'success'
          });
        } else {
          this.notifyUpdate.alertNotify.next({
            msg: 'Failed to delete patient',
            type: 'error'
          });
        }
      },
      error: () => {
        this.notifyUpdate.alertNotify.next({
          msg: 'An error occurred during deletion',
          type: 'error'
        });
      }
    });
  }
}
}
