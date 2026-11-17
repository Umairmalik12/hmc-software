import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-ot-medicine-delete',
  template: `<h2 mat-dialog-title>Remove OT medicine?</h2><mat-dialog-content><p><strong>{{ data.name }}</strong> will be removed from future OT medicine selections.</p><p class="form-note">Existing patient OT records and printouts keep their saved medicine details. You can use Inactive status instead if you may need this medicine again.</p></mat-dialog-content><mat-dialog-actions><button mat-stroked-button type="button" [mat-dialog-close]="false" cdkFocusInitial>Cancel</button><button mat-flat-button color="warn" type="button" [mat-dialog-close]="true">Remove medicine</button></mat-dialog-actions>`,
})
export class OtMedicineDeleteComponent { constructor(@Inject(MAT_DIALOG_DATA) public data: { name: string }) {} }
