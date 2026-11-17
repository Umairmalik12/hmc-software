import { EventEmitter, Output } from '@angular/core';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-opd',
  templateUrl: './opd.component.html',
  styleUrls: ['./opd.component.css']
})
export class OpdComponent implements OnInit {
  @Output() create = new EventEmitter<void>();

 
  constructor() { }

  ngOnInit(): void {
  }
  
}
