import { Component, OnInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';

@Component({
  selector: 'app-otlist',
  templateUrl: './otlist.component.html',
  styleUrls: ['./otlist.component.css']
})
export class OtlistComponent implements OnInit {
  displayedColumns: string[] = ['patientName', 'operationDate', 'operationTime', 'doctorName', 'action'];
  dataSource = new MatTableDataSource<any>();
  total: number = 0; 

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadDataFromLocalStorage();
  }

  loadDataFromLocalStorage(): void {
    const otFormData = localStorage.getItem('otFormData');
    if (otFormData) {
      const parsedData = JSON.parse(otFormData);
      this.dataSource.data = Array.isArray(parsedData) ? parsedData : [parsedData]; // Ensure it's an array
      this.total = this.dataSource.data.length; 
    }
  }

  editOt(patientId: string): void {
    this.router.navigate(['/home'], { queryParams: { patientId } });
  }
}
