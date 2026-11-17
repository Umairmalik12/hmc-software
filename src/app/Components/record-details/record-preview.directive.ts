import { Directive, HostListener, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { RecordDetailsComponent } from './record-details.component';

/** Preview complete list records without entering an edit form. */
@Directive({ selector: 'button[appRecordPreview]' })
export class RecordPreviewDirective {
  @Input('appRecordPreview') record: object | null = null;
  @Input() previewTitle = 'Record preview';

  constructor(private dialog: MatDialog) {}

  @HostListener('click') open(): void {
    if (!this.record) return;
    this.dialog.open(RecordDetailsComponent, {
      data: { title: this.previewTitle, record: this.record },
      panelClass: 'hmc-dialog-panel',
    });
  }
}
