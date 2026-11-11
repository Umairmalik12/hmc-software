import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { UserLoginService } from 'src/app/Services/user-login.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-otlist',
  templateUrl: './otlist.component.html',
  styleUrls: ['./otlist.component.css']
})
export class OtlistComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = [];
  dataSource = new MatTableDataSource<any>();
  allRecords: any[] = [];
  total: number = 0;
  displayLimit: number = 20;
  readonly pageStep: number = 10;
  isSuperAdmin: boolean = false;
  private realtimeSubscription?: Subscription;

  constructor(private router: Router, private indexedDbService: SupabaseDataService, private userLogin: UserLoginService) {}

  async ngOnInit(): Promise<void> {

      this.userLogin.getLoginUser().then((loginUser) => {
    this.isSuperAdmin = loginUser === 'admin';

    this.displayedColumns =['patientName', 'operationDate', 'operationTime', 'doctorName'];

    if (this.isSuperAdmin) {
      this.displayedColumns.push('action');
    }

  });
    this.loadDataFromIndexedDB();
    this.realtimeSubscription = this.indexedDbService.changes.subscribe(collection => {
      if (collection === 'otFormData') {
        this.loadDataFromIndexedDB().catch(error => console.error('Unable to refresh OT records:', error));
      }
    });
  }

  ngOnDestroy(): void {
    this.realtimeSubscription?.unsubscribe();
  }

  onTableScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (!el) return;
    const threshold = 120;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
      if (this.displayLimit < this.allRecords.length) {
        this.displayLimit = Math.min(this.displayLimit + this.pageStep, this.allRecords.length);
        this.dataSource.data = this.allRecords.slice(0, this.displayLimit);
      }
    }
  }

  async loadDataFromIndexedDB(): Promise<void> {
    const data = await this.indexedDbService.getItem<any[]>('otFormData');
    if (data) {
      const records = (Array.isArray(data) ? data : [data]).sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA && timeB && timeA !== timeB) return timeB - timeA;
        return String(b.id || '').localeCompare(String(a.id || ''));
      });
      this.allRecords = records;
      this.total = records.length;
      this.dataSource.data = this.allRecords.slice(0, this.displayLimit);
    } else {
      this.allRecords = [];
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
    this.allRecords = updated;
    this.dataSource.data = this.allRecords.slice(0, this.displayLimit);
    this.total = updated.length;
  }
}
}
