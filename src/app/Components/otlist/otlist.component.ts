import { Component, OnInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import { IndexedDbService } from 'src/app/Services/indexed-db.service';

@Component({
  selector: 'app-otlist',
  templateUrl: './otlist.component.html',
  styleUrls: ['./otlist.component.css']
})
export class OtlistComponent implements OnInit {
  displayedColumns: string[] = [];
  dataSource = new MatTableDataSource<any>();
  total: number = 0;
  isSuperAdmin: boolean = false;

  constructor(private router: Router, private indexedDbService: IndexedDbService) {}

  async ngOnInit(): Promise<void> {

      this.indexedDbService.getItem<string>('loginUser').then((loginUser) => {
    this.isSuperAdmin = loginUser === 'admin';

    this.displayedColumns =['patientName', 'operationDate', 'operationTime', 'doctorName'];

    if (this.isSuperAdmin) {
      this.displayedColumns.push('action');
    }

  });
    this.loadDataFromIndexedDB();
  }

  async loadDataFromIndexedDB(): Promise<void> {
    const data = await this.indexedDbService.getItem<any[]>('otFormData');
    if (data) {
      const records = Array.isArray(data) ? data : [data];
      this.dataSource.data = records;
      this.total = records.length;
    } else {
      this.dataSource.data = [];
      this.total = 0;
    }
  }

  editOt(patientId: string): void {
    this.router.navigate(['/home'], { queryParams: { patientId } });
  }

async deleteOt(id: string): Promise<void> {
  const data = await this.indexedDbService.getItem<any[]>('otFormData');
  if (data) {
    const updated = data.filter(ot => ot.id !== id);
    await this.indexedDbService.setItem('otFormData', updated);
    this.dataSource.data = [...updated]; // triggers Angular change detection
    this.total = updated.length;
  }
}
}
