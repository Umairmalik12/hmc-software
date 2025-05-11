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
  displayedColumns: string[] = ['patientName', 'operationDate', 'operationTime', 'doctorName', 'action'];
  dataSource = new MatTableDataSource<any>();
  total: number = 0;
  isSuperAdmin: boolean = false;

  constructor(private router: Router, private indexedDbService: IndexedDbService) {}

  async ngOnInit(): Promise<void> {
          const loginUser = await this.indexedDbService.getItem<string>('loginUser');
    if (loginUser == 'admin') {
      this.isSuperAdmin = true;

      console.log(loginUser, "loginUser")
    } else {
      this.isSuperAdmin = false;
    }
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

  async deleteOt(index: number): Promise<void> {
    const data = await this.indexedDbService.getItem<any[]>('otFormData');
    if (data) {
      const updated = data.filter((_, i) => i !== index);
      await this.indexedDbService.setItem('otFormData', updated);
      this.dataSource.data = updated;
      this.total = updated.length;
    }
  }
}
