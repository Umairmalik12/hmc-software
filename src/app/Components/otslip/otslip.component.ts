import { Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-ot-form',
  templateUrl: './otslip.html',
  styleUrls: ['./otslip.component.css']
})
export class OtFormComponent {
  otForm: FormGroup;
  includeMedicineHeader = true;
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
    'BILD NO.11', 'BILD NO.15', 'BILD NO.19', 'BILD NO.24', 'LOCAL 100CC'
  ];

  constructor(private fb: FormBuilder) {
    this.otForm = this.fb.group({
      patientName: [''],
      doctorName: [''],
      products: this.fb.array(this.products.map(() => this.fb.group({ selected: false, quantity: '' })))
    });
  }

  toggleMedicineHeader(): void {
    this.includeMedicineHeader = !this.includeMedicineHeader;
  }
  submitForm(){
    this.printPage();

  }

  printPage(): void {
    const printContent = document.getElementById('ot-form');
    if (printContent) {
      const originalContent = document.body.innerHTML;
      document.body.innerHTML = printContent.innerHTML;
      window.print();
      document.body.innerHTML = originalContent;
      location.reload(); // Reload page to restore full content
    }
  }
}
