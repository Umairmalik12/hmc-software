import { Component, Inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EXPENSE_HEADS, ExpenseRecord, validExpenseDate } from '../../Models/expense.model';
import { ExpenseService } from '../../Services/expense.service';
import { NotifyUpdateService } from '../../Services/notify-update.service';
import { requiredText } from '../../Services/validators.service';
import { validMoney } from '../payment/payment-record';

@Component({ selector: 'app-expense-edit', templateUrl: './expense-edit.component.html', styleUrls: ['./expense-edit.component.css'] })
export class ExpenseEditComponent {
  readonly heads = EXPENSE_HEADS;
  readonly headOptions = EXPENSE_HEADS.map(head => head.name);
  readonly form: FormGroup;
  saving = false;
  error = '';
  constructor(fb: FormBuilder, private ref: MatDialogRef<ExpenseEditComponent>, @Inject(MAT_DIALOG_DATA) public data: { record?: ExpenseRecord },
    private expenses: ExpenseService, private feedback: NotifyUpdateService) {
    const record = data.record;
    this.form = fb.group({
      date: [record?.date || '', [Validators.required, (control: AbstractControl) => validExpenseDate(control.value) ? null : { date: true }]],
      description: [record?.description || '', [Validators.required, requiredText, Validators.maxLength(1000)]],
      headId: [record?.headId || '', Validators.required],
      amount: [record?.amount ?? null, [Validators.required, Validators.min(0.01), validMoney]],
      remarks: [record?.remarks || '', Validators.maxLength(1000)], location: [record?.location || '', Validators.maxLength(250)],
    });
  }
  get headName(): string { return this.heads.find(head => head.id === this.form.get('headId')!.value)?.name || ''; }
  selectHead(name: string): void { this.form.get('headId')!.setValue(this.heads.find(head => head.name === name)?.id || ''); this.form.markAsDirty(); }
  async save(): Promise<void> {
    if (this.saving) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); this.feedback.warning('Complete the highlighted expense fields.'); return; }
    this.saving = true; this.error = ''; const draft = this.form.getRawValue(); this.form.disable({ emitEvent: false });
    try { const record = await this.expenses.save(draft, this.data.record?.id); this.feedback.success(this.data.record ? 'Expense updated successfully.' : 'Expense saved successfully.', { route: '/expenses' }); this.ref.close(record); }
    catch (error) { this.error = error instanceof Error ? error.message : 'Unable to save the expense.'; this.feedback.error(this.error); }
    finally { this.saving = false; this.form.enable({ emitEvent: false }); }
  }
  close(): void { if (!this.saving && (!this.form.dirty || window.confirm('Discard unsaved expense changes?'))) this.ref.close(); }
}
