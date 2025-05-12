import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IndexedDbService } from 'src/app/Services/indexed-db.service';

@Component({
  selector: 'app-payment',
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.css']
})
export class PaymentComponent implements OnInit {
  paymentForm!: FormGroup;
  payments: any[] = [];
  displayedColumns: string[] = ['patientName', 'amount', 'cashGiven', 'cashReturn', 'paymentMethod', 'paymentStatus', 'actions'];
  cashReturn: number = 0;
  patientId: string = '';

  constructor(
    private fb: FormBuilder,
    private indexedDbService: IndexedDbService
  ) {}

  async ngOnInit(): Promise<void> {
    this.paymentForm = this.fb.group({
      patientName: ['', Validators.required],
      patientId: [{ value: this.generatePatientId(), disabled: true }, Validators.required],
      amount: [null, [Validators.required, Validators.min(0)]],
      cashGiven: [null, [Validators.required, Validators.min(0)]],
      paymentMethod: ['', Validators.required],
      paymentStatus: ['', Validators.required]
    });

    // Load payments from IndexedDB
    await this.loadPayments();

    this.paymentForm.valueChanges.subscribe(() => {
      this.refreshPaymentList();
    });
  }

  generatePatientId(): string {
    const randomId = 'P-' + Math.random().toString(36).substr(2, 9);
    this.patientId = randomId;
    return this.patientId;
  }

  async loadPayments(): Promise<void> {
    const storedPayments = await this.indexedDbService.getItem<any[]>('payments');
    this.payments = storedPayments || [];
  }

  calculateCashReturn(): void {
    const amount = this.paymentForm.get('amount')?.value || 0;
    const cashGiven = this.paymentForm.get('cashGiven')?.value || 0;

    this.cashReturn = cashGiven >= amount ? cashGiven - amount : 0;
  }

  async processPayment(): Promise<void> {
    if (this.paymentForm.valid) {
      const paymentData = this.paymentForm.getRawValue(); // Includes disabled fields
      paymentData.cashReturn = this.cashReturn;
      paymentData.id = 'pay-' + Math.random().toString(36).substr(2, 9);

      this.payments.push(paymentData);
      await this.indexedDbService.setItem('payments', this.payments);

      this.paymentForm.reset();
      this.cashReturn = 0;

      await this.refreshPaymentList();

      this.showReceipt(paymentData);
    }
  }

  async refreshPaymentList(): Promise<void> {
    await this.loadPayments();
  }

  showReceipt(payment: any): void {
   const receiptHTML = `
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; width: 350px; margin: 0 auto; border: 2px dashed #0066cc; background: #ffffff; border-radius: 10px; text-align: center;">
    <h2 style="color: #0066cc; margin-bottom: 5px;">Haq Medical Center</h2>
    
    <hr style="margin: 20px 0; border: none; border-top: 1px solid #ccc;" />

    <h3 style="margin: 10px 0; color: #333;">Payment Receipt</h3>

    <table style="width: 100%; font-size: 14px; color: #333; margin-top: 10px; text-align: left;">
      <tr>
        <td><strong>Patient Name:</strong></td>
        <td>${payment.patientName}</td>
      </tr>
      <tr>
        <td><strong>Amount Paid:</strong></td>
        <td>Rs ${payment.amount}</td>
      </tr>
      <tr>
        <td><strong>Cash Given:</strong></td>
        <td>Rs ${payment.cashGiven}</td>
      </tr>
      <tr>
        <td><strong>Cash Return:</strong></td>
        <td>Rs ${payment.cashReturn}</td>
      </tr>
      <tr>
        <td><strong>Payment Method:</strong></td>
        <td>${payment.paymentMethod}</td>
      </tr>
      <tr>
        <td><strong>Payment Status:</strong></td>
        <td>${payment.paymentStatus}</td>
      </tr>
      <tr>
        <td><strong>Date:</strong></td>
        <td>${new Date().toLocaleString()}</td>
      </tr>
    </table>

    <hr style="margin: 20px 0; border: none; border-top: 1px solid #ccc;" />

    <p style="font-size: 13px; color: #888;">Providing quality healthcare with excellence</p>
  </div>
`;


    const newWindow = window.open('', '', 'width=600,height=600');
    if (newWindow) {
      newWindow.document.write(receiptHTML);
      newWindow.document.close();
      newWindow.print();
    }
  }

  async updatePaymentStatus(paymentId: string, newStatus: string): Promise<void> {
    const index = this.payments.findIndex(p => p.id === paymentId);
    if (index !== -1) {
      this.payments[index].paymentStatus = newStatus;
      await this.indexedDbService.setItem('payments', this.payments);
      await this.refreshPaymentList();
    }
  }

  resetForm(): void {
    this.paymentForm.reset();
    this.cashReturn = 0;
  }
}
