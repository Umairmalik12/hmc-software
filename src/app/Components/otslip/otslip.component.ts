import { Component, Input } from '@angular/core';
import { FormBuilder, FormGroup, FormArray } from '@angular/forms';

@Component({
  selector: 'app-ot-form',
  templateUrl: './otslip.html',
  styleUrls: ['./otslip.component.css'],
})
export class OtFormComponent {
  isEditMode: boolean = false;

  @Input() set selectedPatientId (selectedPatientId : any){
    if(selectedPatientId){
      const otFormData = localStorage.getItem('otFormData');
    
      if (otFormData) {
        const parsedData = JSON.parse(otFormData);
        
        const patientData = parsedData.find((ot: any) => ot.id === selectedPatientId);
        
        if (patientData) {
          console.log('Patient data found:', patientData);
          
          this.otForm.patchValue({
            patientName: patientData.patientName,
            operationDate: patientData.operationDate,
            operationTime: patientData.operationTime,
            doctorName: patientData.doctorName,
            roomNumber: patientData.roomNumber,
            products: patientData.products // assuming products is an array
          });
          this.isEditMode = true; // Set edit mode to true
        } else {
          console.log('No matching patient data found');
        }
      }
    }
  };
  otForm: FormGroup;
  products = [
    'INJ. AVIL', 'INJ. DECADRON', 'INJ. DERMOCUIM', 'INJ. ATROPINE', 'INJ. TRAMADOL',
    'INJ. TORLAC', 'INJ. KINZ', 'INJ. OXYTOCIN', 'INJ. IBUPROFEN SP', 'INJ. TRANEXAMINE 500MG',
    'INSULIN CONTAF 250MG', 'INJ. GENTAMICANE 40MG', 'INJ. KETSOL 100MG', 'INJ. SODIUM BICARBA 25ML', 'INJ. FLUGEL 100ML',
    'INJ. PROVAS INFUSION 100ML', 'INJ. HAMILC 500ML', 'INJ. HAMICL 500ML', 'INJ. 5% D/W 1000ML', 'INJ. RLD 1000ML',
    '18G IV LINE', '20G IV LINE', '22G IV LINE', '24G IV LINE', 'B.T/SET',
    'D/SET', 'D/S 5CC', 'D/S 10CC', 'D/S 20CC', 'D/S 50CC',
    'O.T CAP', 'APREAN', 'S. GLOVES 7 1/2', 'S. GLOVES 6 1/2', 'XYLOCAINE GEL',
    'LIGNOCAINE GEL', 'NELTON TUBE/10', 'NELTON TUBE/12', 'FEEDING TUBE/6/8', 'FEEDING TUBE/8',
    'FEEDING TUBE/10', 'STOMACH TUBE/18', 'GAUZE PACKET', 'FOLEY\'S CATHETER/16', 'FOLEY\'S CATHETER/18',
    'FOLEY\'S CATHETER/20', 'FOLEY\'S CATHETER/22', 'URINE BAG', 'DRAINAGE BAG', 'SPONGES',
    'SILK NO.1', 'SILK NO.2/0', 'SILK NO.3/0', 'VICRYL NO.1', 'VICRYL NO.2',
    'VICRYL NO.3/0', 'VICRYL NO.4/0', 'CATGUT NO.1', 'CATGUT NO.2/0', 'CATGUT NO.3/0',
    'CATGUT NO.4/0', 'PROLINE 2/0', 'PROLINE 3/0', 'PROLINE 6/0', 'PROLINE 8/0',
    'BILD NO.11', 'BILD NO.15', 'BILD NO.19', 'BILD NO.24', 'LOCAL 100CC',
  ];

  

  constructor(private fb: FormBuilder) {
    this.otForm = this.fb.group({
      patientName: [''],
      doctorName: [''],
      operationDate: [''],
      operationTime: [''],
      roomNumber: [''],
      includeMedicineHeader: ['withMedicine'],
      products: this.fb.array(this.products.map(() => this.fb.group({
        selected: [false],
        quantity: ['']
      })))
    });

    
  }

  get productControls(): FormArray {
    return this.otForm.get('products') as FormArray;
  }

  submitForm(isEditMode = false): void {
    this.isEditMode =isEditMode
    const formValue = this.otForm.value;
  
    const randomId = 'form-' + Math.random().toString(36).substr(2, 9); // Generates a random ID
  
    const selectedProducts = formValue.products
      .map((item: any, index: number) => ({
        name: this.products[index],
        quantity: item.quantity,
        selected: item.selected 
      }))
      .filter((item: { quantity: number; selected: boolean }) => item.quantity && item.quantity > 0);
  
    // Add the random ID to the form value
    const formWithId = { ...formValue, id: randomId };
  let otlist = []

  if (this.isEditMode) {
    // Update the existing entry if in edit mode
    const existingData = JSON.parse(localStorage.getItem('otFormData') || '[]');
    const updatedData = existingData.map((data: any) => 
      data.id === formWithId.id ? formWithId : data
    );
    otlist = updatedData;
    this.otForm.reset();
  } else {
    // Add new entry if not in edit mode
    otlist.push(formWithId);
  }
    localStorage.setItem('otFormData', JSON.stringify(otlist));
    console.log('Selected Products:', selectedProducts);
    console.log('Form with Random ID:', formWithId);
    this.printPage();
    this.otForm.reset();
  }
  
  cancelForm(): void {
    this.otForm.reset();
    // Optionally, reset any other variables here
    console.log('Form has been reset.');
  }



  printPage(): void {
    const printContent = document.getElementById('ot-form');
    if (printContent) {
      const WindowPrt = window.open('', '', 'width=1000,height=800');
      if (WindowPrt) {
        WindowPrt.document.write(`
          <html>
            <head>
              <title>OT Slip</title>
              <style>
                * {
                  font-family: Arial, sans-serif;
                  box-sizing: border-box;
                }
  
                body {
                  margin: 0;
                  padding: 0;
                  font-size: 10pt;
                  color: #333;
                  line-height: 1.5;
                }
  
                h3, .title {
                  text-align: center;
                  margin-bottom: 10px;
                  font-size: 14pt;
                  font-weight: bold;
                }
  
                .form-group, .product-item {
                  margin-bottom: 5px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                }
  
                .product-item {
                  border-bottom: 1px solid #ccc;
                  padding: 5px 0;
                  font-size: 10pt;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                }
  
                .product-name {
                  width: 50%;
                  text-align: left;
                }
  
                .checkbox-container {
                  width: 10%;
                  text-align: center;
                }
  
                .quantity {
                  width: 30%;
                  text-align: right;
                  font-weight: bold;
                }
  
                .checkbox-label {
                  margin-left: 5px;
                }
  
                .product-list {
                  display: block;
                  margin-top: 10px;
                }
  
                .product-item {
                  font-size: 9pt;
                  margin-bottom: 8px;
                  display: flex;
                  justify-content: space-between;
                }
  
                /* Print-specific styling */
                @media print {
                  body {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    font-size: 10pt;
                  }
  
                  html, body {
                    width: 100%;
                    height: 100%;
                    padding: 0;
                    margin: 0;
                    overflow: visible;
                  }
  
                  @page {
                    size: A4 portrait;
                    margin: 10mm;
                  }
  
                  #ot-form {
                    width: 100%;
                    padding: 15px;
                    box-sizing: border-box;
                    page-break-before: always;
                    page-break-after: always;
                    display: block;
                  }
  
                  .product-list {
                    display: block;
                    margin-top: 20px;
                  }
  
                  .product-item {
                    width: 100%;
                    font-size: 9pt;
                    margin-bottom: 5px;
                    display: flex;
                    justify-content: space-between;
                  }
  
                  .checkbox-container {
                    text-align: center;
                  }
  
                  /* Ensure checkbox appearance during print */
                  .checkbox-container input[type="checkbox"] {
                    pointer-events: none;
                  }
                }
              </style>
            </head>
          <body>
            <div id="ot-form">
              <!-- Header Section with Doctor, Date, Time, etc. -->
              <h3 class="title">Ahmmad Medicine List</h3>
              
              <div class="section">
                <div class="section-title">Doctor Name:</div>
                <div class="section-content">${this.otForm.value.doctorName}</div>
              </div>
              
              <div class="section">
                <div class="section-title">Date:</div>
                <div class="section-content">${this.otForm.value.operationDate}</div>
              </div>
              
              <div class="section">
                <div class="section-title">Time:</div>
                <div class="section-content">${this.otForm.value.operationTime}</div>
              </div>

              <div class="section">
                <div class="section-title">Room:</div>
                <div class="section-content">${this.otForm.value.roomNumber}</div>
              </div>

              <div class="section">
                <div class="section-title">Include Medicine Header:</div>
                <div class="section-content">${this.otForm.value.includeMedicineHeader}</div>
              </div>

              <!-- Products List Section -->
              <div class="section">
                <div class="section-title">Medicine List:</div>
                <div class="section-content">
                  <div class="product-list">
                    ${this.getSelectedProductsForPrint()}
                  </div>
                </div>
              </div>
            </div>
          </body>
          </html>
        `);
        WindowPrt.document.close();
        WindowPrt.focus();
        setTimeout(() => {
          WindowPrt.print();
          WindowPrt.close();
        }, 500);
      }
    }
  }
  
  getSelectedProductsForPrint(): string {
    const formValue = this.otForm.value;
    const selectedProducts = formValue.products
      .map((item: any, index: number) => ({
        name: this.products[index],
        quantity: item.quantity,
        selected: item.selected // Assuming 'selected' is the checkbox state
      }))
      .filter((item: { quantity: number; }) => item.quantity && item.quantity > 0);
  
    return `
      <div class="product-container">
        ${selectedProducts
          .map((product: any) => `
            <div class="product-item">
              <div class="product-name">${product.name}</div>
              <div class="quantity">${product.quantity}</div>
              <div class="checkbox-container">
                <input type="checkbox" ${product.selected ? 'checked' : ''} disabled />
                <label class="checkbox-label">${product.selected ? 'Selected' : 'Unselected'}</label>
              </div>
            </div>
          `)
          .join('')}
      </div>
    `;
  }
}
