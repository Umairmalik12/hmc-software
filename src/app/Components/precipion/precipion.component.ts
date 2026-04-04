import { Component, OnInit } from '@angular/core';

const COMMON_MEDICINES_ARRAY = [
  "MIXEL",
  "POLYMALT-F",
  "QSARTEN",
  "MEDITON",
  "CYCIN",
  "DAYFORT",
  "DYPIME",
  "VINZET",
  "MOLAM",
  "CEBECT",
  "MEVET",
  "MILITRIUM",
  "KINETON",
  "ECTAFIN ",
  "ABBACUS ",
  "AZITMA",
  "ONATO",
  "TPENTA IR ",
  "MONTIKA ",
  "PERIDONE",
  "MOFEST",
  "OXIDIL",
  "NIVADOR",
  "LACASIL",
  "TRIMETABOL",
  "SLATE",
  "CARICEF",
  "BRINO",
  "EMFLOX",
  "SOLPLUS",
  "CYNTOL",
  "PRUJEX",
  "DIRICIN",
  "MOLOX",
  "LEVOCIL ",
  "HELOWIC",
  "LACASIA ",
  "ACASIA",
  "REALOZA DR",
  "BACTCID ",
  "DEEBO",
  "XETOPLUS",
  "OVELCIN",
  "LAXCELL",
  "MOFLOTEN",
  "KETOCELL",
  "URISTAT ",
  "ZANTUM",
  "MIRABET ",
  "VTIG PLUS",
  "VEZITIC ",
  "KETORIDE",
  "MAXFLOW",
  "MAXFLOW-D",
  "EZUMAC ",
  "CYSTALGON",
  "CALAMOX",
  "PREGY",
  "EFFIFLOX",
  "NOVIDATE",
  "TONOFLEX-P",
  "2SUM",
  "ANTIAL",
  "ORGLU",
  "ONTIVE",
  "SILIDATE",
  "ITP",
  "DICLORAN",
  "KINZ",
  "SILDOSO",
  "VITIG PLUS",
  "VITIG",
  "C-ONE",
  "URIZAK",
  "BONE-CARE",
  "FERRO-ONE",
  "MEQUINE",
  "QUSPAR",
  "BONE-CARE-C",
  "BALATINE",
  "CARNEO",
  "ESOIN",
  "NUBREL-FORTE",
  "BRUFFEN",
  "SANGIBON",
  "GAVACISON",
  "PALMONIVE",
  "CITRALKA",
  "TORALAC",
  "PROVAS"
];

@Component({
  selector: 'app-preciption',
  templateUrl: './precipion.component.html',
  styleUrls: ['./precipion.component.css']
})
export class PreciptionComponent implements OnInit {
  isPrinting = false;
  readonly commonMedicines = COMMON_MEDICINES_ARRAY;

  today = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

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

  customMedicines: string[] = [];

  ngOnInit() {
    // Load prescription
    const stored = localStorage.getItem('prescription');
    if (stored) {
      const parsed = JSON.parse(stored);
      this.patient = { ...this.patient, ...parsed.patient };
      this.prescribedMedicines = parsed.medicines || this.prescribedMedicines;
    }
    
    // Load custom medicines
    const customStored = localStorage.getItem('customMedicines');
    if (customStored) {
      this.customMedicines = JSON.parse(customStored);
    }
  }

  onMedicineInput(event: Event, name: string) {
    // Trigger datalist on input for better UX
    const input = event.target as HTMLInputElement;
    if (input.value.length > 1) {
      // Datalist shows automatically on type
    }
  }

  addCustomMedicine(name: string) {
    const trimmed = name.trim().toUpperCase();
    if (trimmed && !this.commonMedicines.some(m => m.toUpperCase() === trimmed) && !this.customMedicines.some(m => m.toUpperCase() === trimmed)) {
      this.customMedicines.unshift(trimmed);
      localStorage.setItem('customMedicines', JSON.stringify(this.customMedicines));
    }
  }

  addMedicine() {
    this.prescribedMedicines.push({ name: '', morning: false, afternoon: false, evening: false });
    this.save();
  }

  removeMedicine(index: number) {
    if (this.prescribedMedicines.length > 1) {
      this.prescribedMedicines.splice(index, 1);
    }
    this.save();
  }

  save() {
    localStorage.setItem('prescription', JSON.stringify({
      patient: this.patient,
      medicines: this.prescribedMedicines
    }));
    
    // Auto-add new medicines as custom
    this.prescribedMedicines.forEach(med => {
      if (med.name) this.addCustomMedicine(med.name);
    });
  }

  print() {
    this.isPrinting = true;
    this.save(); // Ensure latest data saved
    this.save(); // Ensure latest data saved
    
    const originalContent = document.getElementById('prescription')!;
    const printClone = originalContent.cloneNode(true) as HTMLElement;
    
    // Replace all inputs with their values
    const inputs = printClone.querySelectorAll('input[type="text"], input[type="email"], input:not([type="checkbox"])');
    inputs.forEach((inputEl) => {
      const input = inputEl as HTMLInputElement;
      const value = input.value.trim() || '';
      const span = document.createElement('span');
      span.className = 'print-value ' + (input.className || '');
      span.textContent = value;
      span.style.minWidth = input.offsetWidth + 'px';
      span.style.minHeight = input.offsetHeight + 'px';
      input.parentNode!.replaceChild(span, input);
    });
    
    // Replace checkboxes with ✓
    const checkboxes = printClone.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkboxEl) => {
      const checkbox = checkboxEl as HTMLInputElement;
      if (checkbox.parentNode) {
        const span = document.createElement('span');
        span.className = 'print-checkbox ' + (checkbox.className || '');
        span.textContent = checkbox.checked ? '✓' : '';
        checkbox.parentNode.replaceChild(span, checkbox);
      }
    });
    
    const printContent = printClone;
    const printWindow = window.open('', '_blank', 'width=850,height=650');
    
    if (printWindow) {
      const css = `@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: white; line-height: 1.4; }
        .prescription { max-width: none !important; box-shadow: none !important; padding: 0 !important; }
        .header { background: linear-gradient(135deg, #1e40af20, #3b82f620) !important; border-bottom: 3px solid #1e40af !important; }
      `;
      
      printWindow.document.write(`
        <!DOCTYPE html><html><head><title>Prescription Print - Haq Medical Center</title><style>${css}</style></head>
        <body>${printContent.innerHTML}</body>
        <script>window.onload = () => { window.focus(); setTimeout(() => window.print(), 250); window.onafterprint = () => window.close(); };</script>
        </html>
      `);
      printWindow.document.close();
    }
    setTimeout(() => {
      this.isPrinting = false;
    }, 1000);
  }
}
