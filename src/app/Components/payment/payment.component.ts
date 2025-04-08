import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

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

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    // Load payments from localStorage on component load
    this.loadPayments();

    // Initialize payment form
    this.paymentForm = this.fb.group({
      patientName: ['', Validators.required],
      patientId: [{ value: this.generatePatientId(), disabled: true }, Validators.required], // Auto-generated Patient ID
      amount: [null, [Validators.required, Validators.min(0)]],
      cashGiven: [null, [Validators.required, Validators.min(0)]],
      paymentMethod: ['', Validators.required],
      paymentStatus: ['', Validators.required]
    });

    // Refresh payment list whenever the form is reset
    this.paymentForm.valueChanges.subscribe(() => {
      this.refreshPaymentList();
    });
  }

  // Automatically generate a unique Patient ID
  generatePatientId(): string {
    const randomId = 'P-' + Math.random().toString(36).substr(2, 9); // Generate a random ID prefixed with 'P-'
    this.patientId = randomId;
    return this.patientId;
  }

  // Load payments from localStorage
  loadPayments(): void {
    const storedPayments = localStorage.getItem('payments');
    if (storedPayments) {
      this.payments = JSON.parse(storedPayments);
    }
  }

  // Calculate cash return when Cash Given changes
  calculateCashReturn(): void {
    const amount = this.paymentForm.get('amount')?.value || 0;
    const cashGiven = this.paymentForm.get('cashGiven')?.value || 0;

    if (cashGiven >= amount) {
      this.cashReturn = cashGiven - amount;
    } else {
      this.cashReturn = 0;
    }
  }

  // Process Payment
  processPayment(): void {
    if (this.paymentForm.valid) {
      const paymentData = this.paymentForm.value;

      // Create a unique ID for the payment
      const paymentId = 'pay-' + Math.random().toString(36).substr(2, 9);

      // Calculate the cash return
      paymentData.cashReturn = this.cashReturn;

      const newPayment = { ...paymentData, id: paymentId };

      // Add payment to the payments list
      this.payments.push(newPayment);

      // Save payments to localStorage
      localStorage.setItem('payments', JSON.stringify(this.payments));

      // Reset form
      this.paymentForm.reset();
      this.cashReturn = 0;

      // Refresh payment list
      this.refreshPaymentList();

      // Display receipt automatically (you can trigger this elsewhere too)
      this.showReceipt(newPayment);
    }
  }

  // Refresh the payment list after a new payment is processed
  refreshPaymentList(): void {
    // If you are using Angular's data-binding, it will automatically update the UI after changes.
    this.loadPayments(); // Ensure you reload the list of payments from localStorage
  }

  // Show Receipt
  showReceipt(payment: any): void {
    const receiptHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px; width: 300px; margin: 0 auto; border: 1px solid #ccc; text-align: center; background: #f9f9f9; border-radius: 8px;">
        <h2 style="color: #0066cc;">Haqq Medical Center</h2>
        <p><strong>Payment Receipt</strong></p>
        <p><strong>Patient Name:</strong> ${payment.patientName}</p>
        <p><strong>Amount Paid:</strong> Rs${payment.amount}</p>
        <p><strong>Payment Method:</strong> ${payment.paymentMethod}</p>
        <p><strong>Payment Status:</strong> ${payment.paymentStatus}</p>
        <p><strong>Payment Date:</strong> ${new Date().toLocaleString()}</p>
      </div>
    `;

    const newWindow = window.open('', '', 'width=600, height=600');
    if (newWindow) {
      newWindow.document.write(receiptHTML);
      newWindow.document.close();
      newWindow.print();
    }
  }

  updatePaymentStatus(paymentId: string, newStatus: string): void {
    const paymentIndex = this.payments.findIndex(payment => payment.id === paymentId);
    
    if (paymentIndex !== -1) {
      // Update the payment status
      this.payments[paymentIndex].paymentStatus = newStatus;
  
      // Save updated payments list to localStorage
      localStorage.setItem('payments', JSON.stringify(this.payments));
  
      // Refresh the payment list
      this.refreshPaymentList();
    }
  }

  // Reset Form
  resetForm(): void {
    this.paymentForm.reset();
    this.cashReturn = 0;
  }
}
