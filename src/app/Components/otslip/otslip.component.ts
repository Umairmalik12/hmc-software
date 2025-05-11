import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, FormArray } from '@angular/forms';
import { Router } from '@angular/router';
import { IndexedDbService } from 'src/app/Services/indexed-db.service';

@Component({
  selector: 'app-ot-form',
  templateUrl: './otslip.html',
  styleUrls: ['./otslip.component.css'],
})
export class OtFormComponent implements OnInit {
  isEditMode = false;
  otlist: any[] = [];
  editingId: string | null = null;

  @Output() isCancelForm = new EventEmitter();

  @Input() set selectedPatientId(selectedPatientId: any) {
    if (selectedPatientId) {
      this.indexedDb.getItem<any[]>('otFormData').then(otFormData => {
        if (otFormData) {
          const patientData = otFormData.find((ot: any) => ot.id === selectedPatientId);
          if (patientData) {
            this.editingId = patientData.id;
            this.isEditMode = true;
            this.otForm.patchValue({
              patientName: patientData.patientName,
              operationDate: patientData.operationDate,
              operationTime: patientData.operationTime,
              doctorName: patientData.doctorName,
              roomNumber: patientData.roomNumber,
              includeMedicineHeader: patientData.includeMedicineHeader || 'withMedicine',
            });

            const productArray = this.otForm.get('products') as FormArray;
            patientData.products.forEach((product: any, index: number) => {
              if (productArray.at(index)) {
                productArray.at(index).patchValue({
                  selected: product.selected,
                  quantity: product.quantity,
                });
              }
            });
          }
        }
      });
    }
  }

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

  constructor(private fb: FormBuilder, private router: Router,private indexedDb: IndexedDbService) {
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

  async ngOnInit(): Promise<void> {
   const stored = await this.indexedDb.getItem<any[]>('otFormData');
  this.otlist = stored ?? [];
  }

async submitForm(): Promise<void> {
  const formValue = this.otForm.value;

  // Map selected products with names
  const selectedProducts = formValue.products.map((item: any, i: number) => ({
    name: this.products[i],
    selected: item.selected,
    quantity: item.quantity
  })).filter((p:any) => p.selected && p.quantity);

  // Use same ID if editing, otherwise generate new
  const id = this.isEditMode && this.editingId 
    ? this.editingId 
    : 'form-' + Math.random().toString(36).substr(2, 9);

  const record = {
    ...formValue,
    products: selectedProducts,
    id
  };

  // 🔁 Replace existing or push new
  const existingIndex = this.otlist.findIndex(item => item.id === id);
  if (existingIndex !== -1) {
    this.otlist[existingIndex] = record;
  } else {
    this.otlist.push(record);
  }

  // ✅ Save to IndexedDB
  await this.indexedDb.setItem('otFormData', this.otlist);

  this.printPage();
  this.otForm.reset();
  this.isEditMode = false;
  this.editingId = null;
  this.router.navigate(['/home']);
}


  cancelForm(): void {
    this.otForm.reset();
    this.isEditMode = false;
    this.editingId = null;
    this.router.navigate(['/home'])
    this.isCancelForm.emit(true);
    
    console.log('Form cancelled.');
  }

  printPage(): void {
    const printContent = document.getElementById('ot-form');
    if (printContent) {
      const win = window.open('', '', 'width=1000,height=800');
      if (win) {
        const styles = `
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 40px;
              background: #fdfdfd;
              color: #222;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h2 {
              margin: 0;
              font-size: 24px;
              color: #2c3e50;
            }
            .header h4 {
              margin: 5px 0 0;
              font-size: 18px;
              color: #16a085;
            }
            .section {
              border: 1px solid #ccc;
              border-radius: 10px;
              padding: 20px;
              margin-bottom: 20px;
              background-color: #f9f9f9;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .section h4 {
              margin-bottom: 15px;
              border-bottom: 1px solid #ddd;
              padding-bottom: 5px;
              color: #2980b9;
            }
            .info-row {
              margin: 10px 0;
              font-size: 15px;
            }
            .info-row .label {
              font-weight: bold;
              display: inline-block;
              width: 150px;
              color: #34495e;
            }
            ul {
              padding-left: 20px;
              margin: 0;
            }
            li {
              margin: 5px 0;
              font-size: 14px;
              display: flex;
              justify-content: space-between;
              padding: 10px;
              border-bottom: 1px solid #ddd;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              font-size: 13px;
              color: #999;
            }
            .products-list {
              display: flex;
              flex-wrap: wrap;
              gap: 20px;
            }
            .product-item {
              width: calc(50% - 10px);
              padding: 10px;
              border-radius: 8px;
              background: #fff;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              margin-bottom: 10px;
              display: flex;
              justify-content: space-between;
              font-size: 14px;
            }
            .product-name {
              font-weight: bold;
              color: #2980b9;
            }
            .product-quantity {
              font-size: 14px;
              color: #34495e;
            }
          </style>
        `;
  
        const externalStyles = `
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/primeng/resources/themes/saga-blue/theme.css">
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/primeng/resources/primeng.min.css">
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/primeicons/primeicons.css">
          <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">
          <link rel="stylesheet" href="assets/styles.css">
        `;
  
        win.document.write(`
          <html>
            <head>
              <title>OT Slip</title>
              ${externalStyles}
              ${styles}
            </head>
            <body>
              <div class="header">
                <h2>Ahmmad Pharmacy</h2>
                <h4>OT Medicine List</h4>
              </div>
  
              <div class="section">
                <h4>Operation Details</h4>
                <div class="info-row"><span class="label">Doctor:</span> ${this.otForm.value.doctorName}</div>
                <div class="info-row"><span class="label">Date:</span> ${this.otForm.value.operationDate}</div>
                <div class="info-row"><span class="label">Time:</span> ${this.otForm.value.operationTime}</div>
                <div class="info-row"><span class="label">Room:</span> ${this.otForm.value.roomNumber}</div>
                <div class="info-row"><span class="label">Medicine Header:</span> ${this.otForm.value.includeMedicineHeader }</div>
              </div>
  
              <div class="section">
                <h4>Selected Products</h4>
                <div class="products-list">
                  ${this.getSelectedProductsForPrint()}
                </div>
              </div>
  
              <div class="footer">
                Printed on: ${new Date().toLocaleString()}
              </div>
            </body>
          </html>
        `);
  
        win.document.close();
        setTimeout(() => {
          win.print();
          win.close();
        }, 500);
      }
    }
  }
  
  
  

  getSelectedProductsForPrint(): string {
    return this.productControls.controls
      .map((ctrl, i) => {
        const { selected, quantity } = ctrl.value;
        if (selected && quantity) {
          return `
            <div class="product-item">
              <span class="product-name">${this.products[i]}</span>
              <span class="product-quantity">Quantity: ${quantity}</span>
            </div>
          `;
        }
        return '';
      })
      .filter(item => item) 
      .join('');
  }
  
  
  
}
