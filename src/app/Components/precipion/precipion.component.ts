import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-preciption',
  templateUrl: './precipion.component.html',
  styleUrls: ['./precipion.component.css']
})
export class PreciptionComponent implements OnInit {

  constructor() { }
  prescribedMedicines = [
    { name: '', type: '', morning: false, afternoon: false, evening: false }
  ];
  
  medicines = ['Levosiz 5mg', 'Zimig 1%', 'Forcan 150mg'];
  
  ngOnInit() {
    const stored = localStorage.getItem('prescriptionData');
    if (stored) {
      this.prescribedMedicines = JSON.parse(stored);
    }
  }
  
  addMedicine() {
    this.prescribedMedicines.push({ name: '', type: '', morning: false, afternoon: false, evening: false });
    this.saveToLocalStorage();
  }
  
  removeMedicine(index: number) {
    this.prescribedMedicines.splice(index, 1);
    this.saveToLocalStorage();
  }
  
  saveToLocalStorage() {
    localStorage.setItem('prescriptionData', JSON.stringify(this.prescribedMedicines));
  }
  
  print() {
    const printContents = document.getElementById('prescription')!.innerHTML;
    const printWindow = window.open('', '', 'height=1000,width=800');
  
    const styles = `
      <style>
        body {
          background-color: #f9f9f9; /* Slight background for content */
          margin: 0;
          font-family: 'Arial', sans-serif;
          color: #333;
          padding: 20px;
          font-size: 14px;
        }
  
        /* Remove elements that shouldn't be printed */
        .no-print {
          display: none !important;
        }
  
        /* Heading Style */
        .heading {
          text-align: center;
          margin-bottom: 1.5rem;
          font-size: 2rem;
          font-weight: bold;
          color: #2c3e50;
        }
  
        /* Form Field Styling */
        mat-form-field {
          margin-bottom: 15px;
        }
  
        /* Medicine Row Styling */
        .medicine-row {
          background-color: rgba(255, 255, 255, 0.9);  /* Slight transparency for effect */
          padding: 10px;
          margin-bottom: 15px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
        }
  
        .full-field {
          flex: 2;
          min-width: 200px;
        }
  
        .small-field {
          flex: 1;
          min-width: 120px;
        }
  
        .time-checkboxes {
          display: flex;
          flex-direction: column;
          margin-right: 15px;
        }
  
        /* Buttons Section */
        .buttons {
          display: flex;
          justify-content: space-between;
          margin-top: 20px;
        }
  
        /* Adjustments for Print */
        @media print {
          body {
            background-color: #fff !important; /* Solid background for print */
            font-size: 12px;  /* Adjust font size for print */
            margin: 0;
            padding: 10px;
          }
  
          /* Prescription container print adjustments */
          .prescription-container {
            padding: 20px;
            width: 100%;
            max-width: 800px;
            margin: 0 auto; /* Center the content for printing */
          }
  
          /* Remove background and shadows for clean print */
          .medicine-row {
            background-color: #fff !important;  /* Solid white background for print */
            box-shadow: none !important;
            margin-bottom: 15px;
          }
  
          /* Heading adjustments */
          .heading {
            font-size: 20px;  /* Adjust heading size for print */
          }
  
          /* Hide buttons and non-printable elements */
          .buttons {
            display: none;
          }
  
          /* Prevent page break inside important form fields */
          mat-form-field, .time-checkboxes {
            page-break-inside: avoid;
          }
  
          /* Ensure no page break inside rows */
          .medicine-row {
            page-break-inside: avoid;
          }
  
          /* Hide non-essential elements */
          .no-print {
            display: none !important;
          }
        }
      </style>
    `;
  
    printWindow!.document.write(`
      <html>
        <head>
          <title>Prescription</title>
          ${styles}
        </head>
        <body>
          <div class="prescription-container">
            ${printContents}
          </div>
        </body>
      </html>
    `);
    printWindow!.document.close();
  
    setTimeout(() => printWindow!.print(), 500); // Print after the content is loaded
  }
  
  

}
