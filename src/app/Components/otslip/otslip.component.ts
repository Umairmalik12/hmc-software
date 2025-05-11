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

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private indexedDb: IndexedDbService
  ) {
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
    const saved = await this.indexedDb.getItem<any[]>('otFormData');
    this.otlist = saved || [];
  }

  async submitForm(): Promise<void> {
    const formValue = this.otForm.value;
    const selectedProducts = formValue.products.map((item: any, i: number) => ({
      name: this.products[i],
      selected: item.selected,
      quantity: item.quantity
    })).filter((p: { selected: any; quantity: any; }) => p.selected && p.quantity);

    const record = {
      ...formValue,
      products: selectedProducts,
      id: this.editingId || 'form-' + Math.random().toString(36).substr(2, 9)
    };

    if (this.isEditMode && this.editingId) {
      this.otlist = this.otlist.map(item => item.id === this.editingId ? record : item);
    } else {
      this.otlist.push(record);
    }

    await this.indexedDb.setItem('otFormData', this.otlist);

    this.printPage();
    this.otForm.reset();
    this.isEditMode = false;
    this.router.navigate(['/home']);
  }

  cancelForm(): void {
    this.otForm.reset();
    this.isEditMode = false;
    this.editingId = null;
    this.router.navigate(['/home']);
    this.isCancelForm.emit(true);
    console.log('Form cancelled.');
  }

  printPage(): void {
    const printContent = document.getElementById('ot-form');
    if (printContent) {
      const win = window.open('', '', 'width=1000,height=800');
      if (win) {
        win.document.write(`
          <html>
            <head>
              <title>Print OT Form</title>
              <style>
                /* same print styles */
              </style>
            </head>
            <body>${printContent.innerHTML}</body>
          </html>
        `);
        win.document.close();
        win.print();
      }
    }
  }
}
