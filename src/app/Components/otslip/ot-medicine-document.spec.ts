import { emptyOtRecord } from 'src/app/Models/ot-medicine.model';
import { buildOtMedicineDocument, printOtMedicine } from './ot-medicine-document';

describe('One-page OT medicine print', () => {
  it('prints saved strength and units without duplicating a strength already included in the medicine name', () => {
    const record = { ...emptyOtRecord(), products: [{ name: 'Medicine A', strength: '500mg', unit: 'Vial', quantity: 2 }, { name: 'Medicine B 10 mg/ml', strength: '10mg/ml', unit: 'Ampoule', quantity: 3 }] };
    const host = document.createElement('div'); host.innerHTML = buildOtMedicineDocument(record);
    const cells = host.querySelectorAll('tbody tr');
    expect(cells[0].children[1].textContent).toBe('Medicine A · 500mg'); expect(cells[0].children[2].textContent).toBe('2 Vial');
    expect(cells[1].children[1].textContent).toBe('Medicine B 10 mg/ml'); expect(cells[1].children[2].textContent).toBe('3 Ampoule');
  });
  it('builds the requested compact columns and escapes patient/product text', () => {
    const record = { ...emptyOtRecord(), patientName: 'Ali <script>alert(1)</script>', products: [{ name: 'Medicine <A>', quantity: 2 }] };
    const html = buildOtMedicineDocument(record);
    expect(html).toContain('<th>S. No.</th><th>Name</th><th>Qty.</th><th>Amount</th>');
    expect(html).toContain('Medicine &lt;A&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('<td>&nbsp;</td>');
  });

  for (const count of [5, 80]) {
    it(`fits ${count} medicines, including the final item and footer, into one A4 page`, async () => {
      const frame = document.createElement('iframe');
      frame.style.width = '900px';
      document.body.appendChild(frame);
      const popup = frame.contentWindow!;
      spyOn(window, 'open').and.returnValue(popup);
      spyOn(popup, 'focus');
      spyOn(popup, 'close');
      const printed = new Promise<void>(resolve => spyOn(popup, 'print').and.callFake(resolve));
      const record = { ...emptyOtRecord(), patientName: 'Ali', procedure: 'Left nephrectomy',
        products: Array.from({ length: count }, (_, index) => ({ name: 'Medicine ' + (index + 1) + ' with a longer name', quantity: index + 1 })) };
      try {
        printOtMedicine(record);
        await printed;
        const page = popup.document.getElementById('a4-page')!;
        const content = popup.document.getElementById('a4-content')!;
        expect(page.getBoundingClientRect().height).toBeLessThan(277 * 96 / 25.4);
        expect(content.getBoundingClientRect().bottom).toBeLessThanOrEqual(page.getBoundingClientRect().bottom + 1);
        expect(popup.document.querySelectorAll('tbody tr').length).toBe(count);
        expect(content.textContent).toContain(record.products[count - 1].name);
        expect(content.textContent).toContain('Pharmacy signature');
        expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth + 1);
      } finally { frame.remove(); }
    });
  }
});
