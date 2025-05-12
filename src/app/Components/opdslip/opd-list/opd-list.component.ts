import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { OpdEditComponent } from '../opd-edit/opd-edit.component';
import { OpdService } from 'src/app/Services/opd.service';
import { OpdDataService } from 'src/app/Services/opd-data.service';
import { Opd } from 'src/app/Models/opd.model';
import { IndexedDbService } from 'src/app/Services/indexed-db.service';

@Component({
  selector: 'app-opd-list',
  templateUrl: './opd-list.component.html',
  styleUrls: ['./opd-list.component.css']
})
export class OpdListComponent implements OnInit, AfterViewInit {

  dataSource: OpdDataService = new OpdDataService(this.opdService);
  displayedColumns: string[] = [];

  tempOpd: Opd = {
    patientId: 0, 
    dateTime: '', 
    patientName: '', 
    age: 0, 
    sex: '', 
    bp: '', 
    temp: '', 
    weight: '', 
    phone: '', 
    address: '', 
    history: '', 
    drName: '', 
    followUp: '', 
    patientCategory: '', 
    amount: 0
  };

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  total: number = 0;
  isSuperAdmin: boolean = false;

  constructor(
    private opdService: OpdService,
    private dialog: MatDialog,
    private intl: MatPaginatorIntl,
    private changeDetectorRef: ChangeDetectorRef,
    private notifyUpdate: NotifyUpdateService,
    private indexDb: IndexedDbService
  ) {
    this.notifyUpdate.notify.subscribe(() => {
      this.dataActions('', 'asc', 0, 5);
    });
  }

  async ngOnInit(): Promise<void> {
          this.indexDb.getItem<string>('loginUser').then((loginUser) => {
    this.isSuperAdmin = loginUser === 'admin';

    this.displayedColumns =  [
    'patientId', 'patientName', 'dateTime', 'sex', 'drName', 'followUp', 
  ];


    if (this.isSuperAdmin) {
      this.displayedColumns.push('action');
    }
        this.dataActions('', 'asc', 0, 5);

  });

    
  }

  ngAfterViewInit(): void {
    this.paginator?.page.subscribe(() => {
      this.dataActions('', 'asc', this.paginator.pageIndex, this.paginator.pageSize);
    });
  }

  dataActions(a: string, b: string, c: number, d: number): void {
    this.dataSource.loadPatient(a, b, c, d);
    this.paginator.pageIndex = c;
    this.paginator.pageSize = d;
    this.total = this.opdService.total;
  }

  editOpd(id: number): void {
    this.opdService.getOpdDetails(id).subscribe((data: Opd) => {
      this.tempOpd = data;

      const dialogConfig = new MatDialogConfig();
      dialogConfig.disableClose = true;
      dialogConfig.autoFocus = true;
      dialogConfig.data = this.tempOpd;

      const dialogRef = this.dialog.open(OpdEditComponent, dialogConfig);

      dialogRef.afterClosed().subscribe(async (updatedOpd: Opd) => {
        if (updatedOpd) {
          const res = await this.opdService.updateOpd(updatedOpd);
          let msg = 'Something went wrong';
          let type = 'error';
          if (res) {
            this.notifyUpdate.notify.next(true);
            msg = 'Patient Data Updated Successfully';
            type = 'success';
          }
          this.notifyUpdate.alertNotify.next({ msg, type });
        }
      });
    });
  }

  async deleteOpd(id: number): Promise<void> {
    const result = await this.opdService.deleteOpd(id);
    let msg = 'Something went wrong';
    let type = 'error';

    if (result) {
      this.notifyUpdate.notify.next(true);
      msg = 'Patient Data Deleted Successfully';
      type = 'success';
    }

    this.notifyUpdate.alertNotify.next({ msg, type });
    window.location.reload();
  }
}
