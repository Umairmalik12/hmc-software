import { Component, Input, OnChanges, ViewEncapsulation } from '@angular/core';
import { PrescriptionRecord } from 'src/app/Models/prescription.model';
import { buildPrescriptionDocument, PRESCRIPTION_DOCUMENT_CSS } from './prescription-document';

@Component({
  selector: 'app-prescription-document',
  template: '<div class="prescription-document" [innerHTML]="html"></div>',
  styles: [PRESCRIPTION_DOCUMENT_CSS],
  encapsulation: ViewEncapsulation.None,
})
export class PrescriptionDocumentComponent implements OnChanges {
  @Input() record!: PrescriptionRecord;
  html = '';

  ngOnChanges(): void {
    this.html = this.record ? buildPrescriptionDocument(this.record, document.baseURI) : '';
  }
}
