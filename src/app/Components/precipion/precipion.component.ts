import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-preciption',
  templateUrl: './precipion.component.html',
  styleUrls: ['./precipion.component.css']
})
export class PreciptionComponent implements OnInit {
  today = new Date().toLocaleDateString();

  patient = {
    refId: '',
    visit: '',
    name: '',
    relation: '',
    age: '',
    sex: '',
    weight: '',
    contact: '',
    allergies: '',
    symptoms: '',
    findings: '',
    diagnosis: ''
  };

  prescribedMedicines = [
    { name: '', morning: false, afternoon: false, evening: false }
  ];

  ngOnInit() {
    const stored = localStorage.getItem('prescription');
    if (stored) {
      const parsed = JSON.parse(stored);
      this.patient = parsed.patient || this.patient;
      this.prescribedMedicines = parsed.medicines || this.prescribedMedicines;
    }
  }

  addMedicine() {
    this.prescribedMedicines.push({ name: '', morning: false, afternoon: false, evening: false });
    this.save();
  }

  removeMedicine(index: number) {
    this.prescribedMedicines.splice(index, 1);
    this.save();
  }

  save() {
    localStorage.setItem('prescription', JSON.stringify({
      patient: this.patient,
      medicines: this.prescribedMedicines
    }));
  }

  print() {
    window.print();
  }
}
