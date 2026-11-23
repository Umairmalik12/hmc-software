import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { emptyOtCatalogMedicine } from '../../Models/ot-medicine-catalog.model';
import { emptyOtRecord } from '../../Models/ot-medicine.model';
import { OtMedicineCatalogService } from '../../Services/ot-medicine-catalog.service';
import { OtMedicineService } from '../../Services/ot-medicine.service';
import { NotifyUpdateService } from '../../Services/notify-update.service';
import { memoryDb } from '../../testing/memory-db';
import { OtFormComponent } from './otslip.component';
import { buildOtMedicineDocument } from './ot-medicine-document';

describe('Dynamic OT catalogue and patient slip integration', () => {
  const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  const setup = () => {
    const memory = memoryDb(); const catalog = new OtMedicineCatalogService(memory.db); const records = new OtMedicineService(memory.db);
    const router = jasmine.createSpyObj<Router>('router', ['navigate']); router.navigate.and.resolveTo(true);
    const component = new OtFormComponent(new FormBuilder(), router, records, new NotifyUpdateService(), {} as MatDialog, catalog);
    return { ...memory, catalog, component, router };
  };
  it('matches legacy patient items by name and strength and keeps same-name variant quantities separate', async () => {
    const { catalog, component, collections } = setup(); spyOn(window, 'open').and.returnValue(null);
    try {
      const one = await catalog.save({ ...emptyOtCatalogMedicine(), name: '2SUM', strength: '1g' });
      const two = await catalog.save({ ...emptyOtCatalogMedicine(), name: '2SUM', strength: '2g' });
      collections.set('otFormData', new Map([['41', { ...emptyOtRecord(), id: '41', patientName: 'Existing patient', products: [{ name: '2SUM', strength: '2g', quantity: 3, amount: 40 }] }]]));
      component.selectedPatientId = '41'; component.ngOnInit(); await settle();
      const oneRow = component.visibleProducts.find(item => item.name === one.name && item.strength === one.strength)!, twoRow = component.visibleProducts.find(item => item.name === two.name && item.strength === two.strength)!;
      expect(component.productControls.at(twoRow.index).get('quantity')!.value).toBe(3); expect(component.productControls.at(oneRow.index).get('selected')!.value).toBeFalse();
      component.onProductSelectionChange(oneRow.index, true); component.productControls.at(oneRow.index).get('quantity')!.setValue(2);
      await component.submitForm(); const saved = collections.get('otFormData')!.get('41');
      expect(saved.products.length).toBe(2); expect(saved.products.find((item: any) => item.catalogueId === two.id)).toEqual(jasmine.objectContaining({ strength: '2g', quantity: 3, amount: 40 }));
      expect(saved.products.find((item: any) => item.catalogueId === one.id)).toEqual(jasmine.objectContaining({ strength: '1g', quantity: 2 }));
      const printed = buildOtMedicineDocument(saved); expect(printed).toContain('1g'); expect(printed).toContain('2g');
    } finally { component.ngOnDestroy(); catalog.ngOnDestroy(); }
  });
  it('loads new active medicines live, preserves draft patient values and quantities, and saves catalogue snapshots to the database', async () => {
    const { catalog, component, collections, router } = setup();
    spyOn(window, 'open').and.returnValue(null);
    try {
      component.ngOnInit(); await settle();
      component.otForm.patchValue({ patientName: 'Draft patient', roomNumber: 'Room 2' });
      const first = await catalog.save({ ...emptyOtCatalogMedicine(), name: 'Live medicine', genericName: 'Generic', strength: '10mg/ml', unit: 'Vial', category: 'OT' }); await settle();
      const index = component.products.indexOf(first.name); expect(index).toBeGreaterThanOrEqual(0);
      component.onProductSelectionChange(index, true); component.productControls.at(index).get('quantity')!.setValue(3);
      component.productControls.at(index).get('quantity')!.markAsDirty();
      await catalog.save({ ...emptyOtCatalogMedicine(), name: 'Another active medicine' }); await settle();
      await catalog.save({ ...emptyOtCatalogMedicine(), name: 'Inactive medicine', active: false }); await settle();
      expect(component.visibleProducts.some(row => row.name === 'Inactive medicine')).toBeFalse();
      expect(component.otForm.get('patientName')!.value).toBe('Draft patient');
      expect(component.productControls.at(index).get('quantity')!.value).toBe(3);
      expect(component.productControls.at(index).get('quantity')!.dirty).toBeTrue();
      component.productSearch = '10mg/ml'; component.updateVisibleProducts(); expect(component.visibleProducts.length).toBe(1);
      await component.submitForm();
      const saved = Array.from(collections.get('otFormData')!.values())[0];
      expect(saved.products).toEqual([jasmine.objectContaining({ name: 'Live medicine', catalogueId: first.id, quantity: 3, strength: '10mg/ml', unit: 'Vial', genericName: 'Generic' })]);
      expect(saved.roomNumber).toBe('Room 2'); expect(router.navigate).toHaveBeenCalledWith(['/ot-records']);
    } finally { component.ngOnDestroy(); catalog.ngOnDestroy(); }
  });

  it('preserves original saved medicine details and amounts after a master rename, inactivation and deletion', async () => {
    const { catalog, component, collections } = setup(); spyOn(window, 'open').and.returnValue(null);
    try {
      const medicine = await catalog.save({ ...emptyOtCatalogMedicine(), name: 'Original medicine', strength: '500mg', unit: 'Vial' });
      const product = { name: medicine.name, catalogueId: medicine.id, strength: '500mg', unit: 'Vial', quantity: 4, amount: 500 };
      collections.set('otFormData', new Map([['41', { ...emptyOtRecord(), id: '41', patientName: 'Saved patient', products: [product] }]]));
      component.selectedPatientId = '41'; component.ngOnInit(); await settle();
      await catalog.save({ ...medicine, name: 'New medicine name', strength: '1g', active: false }); await settle();
      expect(component.visibleProducts.find(row => row.name === medicine.name)!.note).toContain('Saved item');
      await catalog.delete(medicine.id); await settle();
      expect(component.selectedProductCount).toBe(1);
      await component.submitForm();
      const saved = collections.get('otFormData')!.get('41');
      expect(saved.products[0]).toEqual(jasmine.objectContaining(product));
      expect(buildOtMedicineDocument(saved)).toContain('Original medicine');
      expect(buildOtMedicineDocument(saved)).not.toContain('New medicine name');
    } finally { component.ngOnDestroy(); catalog.ngOnDestroy(); }
  });

  it('retains a newly selected item visibly when deactivated and blocks save until removed', async () => {
    const { catalog, component, collections } = setup(); spyOn(window, 'open').and.returnValue(null);
    try {
      const medicine = await catalog.save({ ...emptyOtCatalogMedicine(), name: 'Medicine to deactivate' });
      component.ngOnInit(); await settle(); component.otForm.patchValue({ patientName: 'Draft' });
      const index = component.products.indexOf(medicine.name); component.onProductSelectionChange(index, true);
      await catalog.save({ ...medicine, active: false }); await settle();
      expect(component.visibleProducts.find(row => row.index === index)!.unavailable).toBeTrue();
      expect(component.productControls.at(index).get('quantity')!.value).toBe(1);
      await component.submitForm(); expect(component.validationMessage).toContain('unavailable'); expect(collections.get('otFormData')?.size || 0).toBe(0);
      component.onProductSelectionChange(index, false); expect(component.visibleProducts.some(row => row.index === index)).toBeFalse();
    } finally { component.ngOnDestroy(); catalog.ngOnDestroy(); }
  });

  it('recovers a catalogue failure without overwriting a patient draft', async () => {
    const { catalog, component } = setup();
    const getAll = spyOn(catalog, 'getAll').and.rejectWith(new Error('Offline'));
    try {
      await component.load(); expect(component.catalogueError).toBeTruthy(); expect(component.loadFailed).toBeFalse();
      component.otForm.patchValue({ patientName: 'Keep draft' });
      getAll.and.callThrough(); await component.refreshCatalogue();
      expect(component.catalogueError).toBe(''); expect(component.visibleProducts.length).toBeGreaterThan(0);
      expect(component.otForm.get('patientName')!.value).toBe('Keep draft');
    } finally { component.ngOnDestroy(); catalog.ngOnDestroy(); }
  });
});
