import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { OtFormComponent } from './otslip.component';
import { OtMedicineService } from 'src/app/Services/ot-medicine.service';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { emptyOtRecord } from 'src/app/Models/ot-medicine.model';
import { memoryDb } from 'src/app/testing/memory-db';
import { OtMedicineCatalogService } from 'src/app/Services/ot-medicine-catalog.service';

describe('OT medicine editing and persistence', () => {
  it('restores sparse selections by name and preserves legacy medicines, amounts and quantities on update', async () => {
    const { db, collections } = memoryDb();
    const record = { ...emptyOtRecord(), id: '23', patientName: 'Ali', procedure: 'Left nephrectomy',
      products: [{ name: 'FOLEY\'S CATHETER/20', quantity: 2, selected: true, amount: 100 }, { name: 'Older catalog item', quantity: 3, selected: true }], createdAt: '2026-01-01T00:00:00Z' };
    collections.set('otFormData', new Map([['23', record], ['30', { ...record, id: '30', patientName: 'Other patient' }]]));
    const service = new OtMedicineService(db);
    const router = jasmine.createSpyObj<Router>('router', ['navigate']);
    router.navigate.and.resolveTo(true);
    const catalogue = new OtMedicineCatalogService(db);
    const component = new OtFormComponent(new FormBuilder(), router, service, new NotifyUpdateService(), {} as MatDialog, catalogue);
    component.selectedPatientId = '23';
    await component.load();
    const index = component.products.indexOf('FOLEY\'S CATHETER/20');
    expect(component.productControls.at(0).get('selected')!.value).toBeFalse();
    expect(component.productControls.at(index).get('quantity')!.value).toBe(2);
    expect(component.products).toContain('Older catalog item');
    component.productControls.at(index).get('quantity')!.setValue(4);
    spyOn(window, 'open').and.returnValue(null);
    await component.submitForm();
    const saved = collections.get('otFormData')!.get('23');
    expect(saved.products.map((product: any) => product.name)).toEqual(['FOLEY\'S CATHETER/20', 'Older catalog item']);
    expect(saved.products[0].quantity).toBe(4);
    expect(saved.products[0].amount).toBe(100);
    expect(saved.procedure).toBe('Left nephrectomy');
    expect(saved.createdAt).toBe(record.createdAt);
    expect(collections.get('otFormData')!.get('30').patientName).toBe('Other patient');
    expect(router.navigate).toHaveBeenCalledWith(['/ot-records']);
    component.ngOnDestroy();
    catalogue.ngOnDestroy();
  });

  it('creates, reads and deletes an independent OT record', async () => {
    const { db } = memoryDb();
    const service = new OtMedicineService(db);
    const saved = await service.save({ ...emptyOtRecord(), patientName: 'Ali', products: [{ name: 'Medicine A', quantity: 2 }] });
    expect((await service.getById(saved.id))!.patientName).toBe('Ali');
    await service.delete(saved.id);
    expect(await service.getById(saved.id)).toBeUndefined();
    expect(db.setItem).not.toHaveBeenCalled();
  });
});
