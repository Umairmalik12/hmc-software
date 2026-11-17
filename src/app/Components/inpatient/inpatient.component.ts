import { EventEmitter, Output } from '@angular/core';
import { Component } from '@angular/core';

@Component({
  selector: 'app-inpatient',
  templateUrl: './inpatient.component.html',
  styleUrls: ['./inpatient.component.css']
})
export class InpatientComponent {
  @Output() create = new EventEmitter<void>();


}
