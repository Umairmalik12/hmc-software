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
    this.save();
    
    const originalContent = document.getElementById('prescription')!;
    const printClone = originalContent.cloneNode(true) as HTMLElement;
    printClone.querySelectorAll('.no-print, .actions, button, datalist').forEach(element => element.remove());
    
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
    
    const printWindow = window.open('', '_blank', 'width=850,height=650');
    
    if (printWindow) {
      const css = `
        @page { size: A4 portrait; margin: 12mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        html, body { margin: 0; padding: 0; background: #fff; color: #23383b; font: 10pt/1.4 Arial, sans-serif; }
        .prescription { width: 100%; max-width: none; margin: 0; padding: 0; border: 0; border-radius: 0; background: #fff; box-shadow: none; font-size: 10pt; line-height: 1.4; }
        .header { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 2mm 8mm; margin: 0 0 5mm; padding: 5mm; text-align: left; background: #edf6f5; border: 1px solid #d5e8e5; border-bottom: 2mm solid #0c7c72; border-radius: 2mm; }
        .urdu-title { grid-column: 1 / -1; margin: 0; color: #0c625b; font: bold 15pt Arial, sans-serif; text-shadow: none; letter-spacing: 0; }
        .clinic-title { margin: 0; color: #173a3d; font-size: 19pt; text-shadow: none; }
        .doc-info { grid-column: 1 / -1; }
        .doc-info h2 { margin: 0 0 1mm; color: #0c625b; font-size: 13pt; }
        .doc-info p { margin: 1mm 0; color: #475b5e; font-size: 8.5pt; }
        .patient-section, .rx-section, .footer-section { margin: 0 0 4mm; padding: 4mm; border: 1px solid #e0e8e9; border-radius: 2mm; background: #fff; box-shadow: none; }
        .patient-section h3, .rx-section h3 { margin: 0 0 3mm; padding: 0 0 2mm; border-bottom: .5mm solid #dceae8; color: #126d64; font-size: 12pt; }
        .info-table { border-spacing: 0; margin: 0 0 2mm; }
        .info-table td { padding: 1.5mm 2mm; border-bottom: .2mm solid #edf1f2; border-radius: 0; background: #fff; }
        .info-table td:first-child { width: 24mm; color: #52666a; }
        .print-value { display: inline-block; min-height: 5mm; padding: 0 .5mm; border: 0 !important; border-bottom: .3mm solid #aebfbe !important; border-radius: 0 !important; background: #fff !important; color: #20383b; }
        .complaints, .diagnosis { margin: 2mm 0; padding: 2mm 3mm; border: 0; border-left: 1mm solid #0c7c72; border-radius: 0; background: #f3f8f7; box-shadow: none; }
        .complaints label, .diagnosis label { min-width: 29mm; color: #34575a; }
        .medicine-table { margin: 2mm 0 0; border: .3mm solid #dce6e6; border-collapse: collapse; border-radius: 0; box-shadow: none; }
        .medicine-table th { padding: 2.5mm 2mm; background: #0c7c72; color: #fff; font-size: 9pt; }
        .medicine-table td { padding: 2mm; border-bottom: .2mm solid #e3ebeb; }
        .medicine-row input[type='text'] { width: 100%; padding: 1mm; border: 0; border-bottom: .3mm solid #b9c9c8; border-radius: 0; background: #fff; font: inherit; }
        .print-checkbox { display: inline-block; width: auto; height: auto; margin: 0; border: 0; background: transparent; color: #0c7c72; font-size: 12pt; font-weight: bold; }
        .footer-section { margin-top: 0; }
        .instructions { margin: 0 0 4mm; padding: 3mm; border: .3mm solid #d7e8e4; border-radius: 2mm; background: #f1f7f5; font-size: 9pt; }
        .signature-area { gap: 8mm; }
        .signature-box, .stamp-box { min-height: 22mm; padding: 3mm; border: .3mm dashed #91a5a3; border-radius: 2mm; background: #fff; font-size: 9pt; }
        .stamp-box { border-style: solid; color: #34575a; }
        .no-print, .actions, button { display: none !important; }
        tr, .patient-section, .rx-section, .footer-section { page-break-inside: avoid; }
      `;
      
      printWindow.document.write(`
        <!DOCTYPE html><html><head><title>Prescription Print - Haq Medical Center</title><style>${css}</style></head>
        <body>${printClone.outerHTML}</body>
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
