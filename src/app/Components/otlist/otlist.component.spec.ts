import { MatDialog } from '@angular/material/dialog';
import { OtlistComponent } from './otlist.component';
import { OtMedicineService } from 'src/app/Services/ot-medicine.service';
import { UserLoginService } from 'src/app/Services/user-login.service';
import { emptyOtRecord } from 'src/app/Models/ot-medicine.model';
import { memoryDb } from 'src/app/testing/memory-db';

describe('OT records list CRUD', () => {
  it('reads, searches and deletes the matching saved OT record', async () => {
    const { db } = memoryDb();
    const service = new OtMedicineService(db);
    const one = await service.save({ ...emptyOtRecord(), patientName: 'Ali', procedure: 'Cystoscopy', products: [{ name: 'Medicine A', quantity: 2 }] });
    await service.save({ ...emptyOtRecord(), patientName: 'Sara', procedure: 'Left nephrectomy', products: [{ name: 'Medicine B', quantity: 3 }] });
    const component = new OtlistComponent(service, db, {} as UserLoginService, {} as MatDialog);
    await component.load();
    component.query = 'cystoscopy';
    expect(component.visibleRecords.map(record => record.id)).toEqual([one.id]);
    spyOn(window, 'confirm').and.returnValue(true);
    await component.deleteOt(one);
    expect(await service.getById(one.id)).toBeUndefined();
    expect(component.allRecords.length).toBe(1);
    component.ngOnDestroy();
  });
});
