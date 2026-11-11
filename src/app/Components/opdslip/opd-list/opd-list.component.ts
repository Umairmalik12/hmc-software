import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { OpdEditComponent } from '../opd-edit/opd-edit.component';
import { OpdService } from 'src/app/Services/opd.service';
import { OpdDataService } from 'src/app/Services/opd-data.service';
import { Opd } from 'src/app/Models/opd.model';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { UserLoginService } from 'src/app/Services/user-login.service';
import * as XLSX from 'xlsx';
import { OpdSlipComponent } from '../opd-slip/opd-slip.component';

@Component({
  selector: 'app-opd-list',
  templateUrl: './opd-list.component.html',
  styleUrls: ['./opd-list.component.css']
})
export class OpdListComponent implements OnInit, AfterViewInit {

  opd: Opd[] = [];
  filteredOpds: Opd[] = [];
  displayedOpds: Opd[] = [];
  dataSource: OpdDataService = new OpdDataService(this.opdService);
  displayedColumns: string[] = [];
  tempOpd!: Opd;
  displayLimit: number = 20;
  readonly pageStep: number = 10;
  // 🔍 Search fields
  searchPatientId: string = '';
  searchName: string = '';
  searchPhone: string = '';
  searchCity: string = '';
  dateFilter: string = 'all';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  total: number = 0;
  isSuperAdmin: boolean = false;

  constructor(
    private opdService: OpdService,
    private dialog: MatDialog,
    private intl: MatPaginatorIntl,
    private changeDetectorRef: ChangeDetectorRef,
    private notifyUpdate: NotifyUpdateService,
    private indexDb: SupabaseDataService,
    private userLogin: UserLoginService
  ) {
    this.notifyUpdate.notify.subscribe(() => {
      this.dataActions('', 'asc', 0, 5);
    });
  }

  async ngOnInit(): Promise<void> {
    this.userLogin.getLoginUser().then((loginUser) => {
      this.isSuperAdmin = loginUser === 'admin';
      this.displayedColumns = ['patientId', 'patientName', 'dateTime', 'sex', 'drName', 'followUp', 'createdAt'];
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

  onTableScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (!el) return;
    const threshold = 120;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
      if (this.displayLimit < this.filteredOpds.length) {
        this.displayLimit = Math.min(this.displayLimit + this.pageStep, this.filteredOpds.length);
        this.updateDisplayedOpds();
      }
    }
  }

  private updateDisplayedOpds(): void {
    this.displayedOpds = this.filteredOpds.slice(0, this.displayLimit);
    this.dataSource.updatePatients(this.displayedOpds);
  }

  dataActions(a: string, b: string, c: number, d: number): void {
    this.dataSource.loadPatient(a, b, c, d);
    if (this.paginator) {
      this.paginator.pageIndex = c;
      this.paginator.pageSize = d;
    }
    this.total = this.opdService.total;

    // keep local copy for filtering
    this.opdService.getAllOpds().subscribe((opds) => {
      this.opd = opds;
      this.filteredOpds = opds;
      this.onDateFilter();
    });
  }

  // 🔍 Search
  onDateFilter() {
    let tempList = this.opd;
    const now = new Date();

    switch (this.dateFilter) {
      case 'today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        tempList = tempList.filter(o => {
          const createdDate = new Date(o.createdAt);
          return createdDate >= today;
        });
        break;
      case 'yesterday':
        const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        tempList = tempList.filter(o => {
          const createdDate = new Date(o.createdAt);
          return createdDate >= yesterdayStart && createdDate < yesterdayEnd;
        });
        break;
      case 'seven':
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        tempList = tempList.filter(o => new Date(o.createdAt) >= sevenDaysAgo);
        break;
      case 'thirty':
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        tempList = tempList.filter(o => new Date(o.createdAt) >= thirtyDaysAgo);
        break;
    }

    // Apply search filters
    this.filteredOpds = tempList.filter(o => {
      const matchesId = this.searchPatientId ? o.patientId.toString().includes(this.searchPatientId) : true;
      const matchesName = this.searchName ? o.patientName.toLowerCase().includes(this.searchName.toLowerCase()) : true;
      const matchesPhone = this.searchPhone ? (o.phone || '').toString().includes(this.searchPhone) : true;
      const matchesCity = this.searchCity ? (o.address || '').toLowerCase().includes(this.searchCity.toLowerCase()) : true;
      return matchesId && matchesName && matchesPhone && matchesCity;
    });

    this.displayLimit = 20;
    this.updateDisplayedOpds();
  }

  onSearch() {
    this.onDateFilter();
  }

  onClearSearch() {
    this.searchPatientId = '';
    this.searchName = '';
    this.searchPhone = '';
    this.searchCity = '';
    this.dateFilter = 'all';
    this.filteredOpds = this.opd;
    this.displayLimit = 20;
    this.updateDisplayedOpds();
  }

  // 📤 Export
  exportToExcel() {
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(this.filteredOpds.length ? this.filteredOpds : this.opd);
    const workbook: XLSX.WorkBook = { Sheets: { 'OPDs': worksheet }, SheetNames: ['OPDs'] };
    XLSX.writeFile(workbook, 'opds.xlsx');
  }

  // 📥 Import
  async importFromExcel(event: any) {
    const target: DataTransfer = <DataTransfer>(event.target);
    if (target.files.length !== 1) return;

    const reader: FileReader = new FileReader();
    reader.onload = async (e: any) => {
      const bstr: string = e.target.result;
      const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });
      const wsname: string = wb.SheetNames[0];
      const ws: XLSX.WorkSheet = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      // get stored OPDs
      const storedOpds = await this.indexDb.getItem<any[]>('opdDetails') || [];
      let added = 0;

      for (const record of data) {
        const rec: any = record;
        const opdDetail: any = {
          patientId: Number(rec.patientId) || await this.indexDb.allocateId('opdDetails'),
          patientName: rec.patientName || rec.name || '',
          date: rec.date || '',
          time: rec.time || '',
          sex: rec.sex || '',
          phone: rec.phone || '',
          address: rec.address || '',
          drName: rec.drName || '',
          followUp: rec.followUp || ''
        };

        if (!storedOpds.some(o => o.patientId == opdDetail.patientId)) {
          storedOpds.push(opdDetail);
          added++;
        }
      }

      if (added > 0) {
        await this.indexDb.setItem('opdDetails', storedOpds);
        this.notifyUpdate.notify.next(true);
      }

      this.opd = storedOpds;
      this.filteredOpds = this.opd;
      this.dataSource.updatePatients(this.filteredOpds);
    };
    reader.readAsBinaryString(target.files[0]);
  }

  // ✏️ Edit
  editOpd(id: number): void {
    this.opdService.getOpdDetails(id).subscribe((data: Opd) => {
      if (data) {
        this.tempOpd = data;
        const dialogData = { ...data, oldPatientId: data.patientId } as any;
        const dialogConfig = new MatDialogConfig();
        dialogConfig.disableClose = true;
        dialogConfig.autoFocus = true;
        dialogConfig.data = dialogData;
        const dialogRef = this.dialog.open(OpdEditComponent, dialogConfig);

        dialogRef.afterClosed().subscribe(async (updatedOpd: any) => {
          if (updatedOpd) {
            const res = await this.opdService.updateOpd(updatedOpd);
            const msg = res ? "OPD Updated Successfully" : "Something went wrong";
            const type = res ? "success" : "error";
            this.notifyUpdate.notify.next(true);
            this.notifyUpdate.alertNotify.next({ msg, type });
          }
        });
      } else {
        this.notifyUpdate.alertNotify.next({ msg: "OPD not found", type: "error" });
      }
    });
  }

  // 🗑️ Delete
  async deleteOpd(id: number): Promise<void> {
    const confirmed = confirm('Are you sure you want to delete this OPD record?');
    if (!confirmed) return;

    const result = await this.opdService.deleteOpd(id);
    let msg = 'Failed to delete OPD.';
    let type = 'error';

    if (result) {
      msg = 'OPD deleted successfully.';
      type = 'success';
      this.notifyUpdate.notify.next(true);
    }

    this.notifyUpdate.alertNotify.next({ msg, type });
  }


  
// inside component class
// openPrintSlips() {
//   // use filtered list if user has searched, otherwise full current list
//   const opdsToPrint = this.filteredOpds && this.filteredOpds.length ? this.filteredOpds : this.opd;

//   if (!opdsToPrint || opdsToPrint.length === 0) {
//     this.notifyUpdate.alertNotify.next({ msg: 'No OPD records to print', type: 'error' });
//     return;
//   }

//   this.dialog.open(OpdSlipComponent, {
//     width: '950px',
//     maxHeight: '95vh',
//     data: { opds: opdsToPrint, centerName: 'Haq Medical Center' }
//   });
// }


// Print one slip
printSlip(opd: Opd) {
  const dialogConfig = new MatDialogConfig();
  dialogConfig.width = '800px';
  dialogConfig.data = { opds: [opd] };
  this.dialog.open(OpdSlipComponent, dialogConfig);
}

// Print all slips (filtered or all)
printAllSlips() {
  const dialogConfig = new MatDialogConfig();
  dialogConfig.width = '800px';
  dialogConfig.data = { opds: this.filteredOpds.length ? this.filteredOpds : this.opd };
  this.dialog.open(OpdSlipComponent, dialogConfig);
}
}
