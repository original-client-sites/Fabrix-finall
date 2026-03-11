import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import type { InsertPaymentDetail } from "@shared/schema";

interface PartialPaymentSelectorProps {
  totalAmount: number;
  onPaymentsChange: (payments: InsertPaymentDetail[]) => void;
  disabled?: boolean;
}

export function PartialPaymentSelector({ 
  totalAmount, 
  onPaymentsChange,
  disabled = false
}: PartialPaymentSelectorProps) {
  const [payments, setPayments] = useState<InsertPaymentDetail[]>([
    { orderId: "temp", paymentMethod: "cash", amount: "0", status: "completed" }
  ]);
  
  const [remainingAmount, setRemainingAmount] = useState(totalAmount);

  useEffect(() => {
    const totalPaid = payments.reduce((sum, payment) => sum + parseFloat(payment.amount || "0"), 0);
    setRemainingAmount(Math.max(0, totalAmount - totalPaid));
    onPaymentsChange(payments);
  }, [payments, totalAmount, onPaymentsChange]);

  const addPayment = () => {
    setPayments([
      ...payments,
      { orderId: "", paymentMethod: "cash", amount: "0", status: "completed" }
    ]);
  };

  const removePayment = (index: number) => {
    if (payments.length <= 1) return;
    const newPayments = [...payments];
    newPayments.splice(index, 1);
    setPayments(newPayments);
  };

  const updatePayment = (index: number, field: keyof InsertPaymentDetail, value: string) => {
    const newPayments = [...payments];
    (newPayments[index] as any)[field] = value;
    
    // If updating amount, ensure it doesn't exceed remaining amount
    if (field === 'amount') {
      const currentTotal = newPayments.reduce((sum, payment) => sum + parseFloat(payment.amount || "0"), 0);
      const remainingForThisPayment = totalAmount - (currentTotal - parseFloat(value || "0"));
      if (parseFloat(value || "0") > remainingForThisPayment) {
        (newPayments[index] as any)[field] = remainingForThisPayment.toString();
      }
    }
    
    setPayments(newPayments);
  };

  const handleAutoFillRemaining = (index: number) => {
    const currentAmount = payments.reduce((sum, payment, idx) => {
      if (idx !== index) {
        return sum + parseFloat(payment.amount || "0");
      }
      return sum;
    }, 0);
    
    const remaining = Math.max(0, totalAmount - currentAmount);
    updatePayment(index, 'amount', remaining.toString());
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Partial Payments</h3>
        <div className="text-sm">
          <span className="font-medium">Remaining:</span> ₹{remainingAmount.toFixed(2)}
        </div>
      </div>
      
      {payments.map((payment, index) => (
        <div key={index} className="flex items-end gap-3 p-3 border rounded-md">
          <div className="flex-1 space-y-2">
            <Label htmlFor={`payment-method-${index}`}>Payment Method</Label>
            <Select 
              value={payment.paymentMethod} 
              onValueChange={(value) => updatePayment(index, 'paymentMethod', value)}
              disabled={disabled}
            >
              <SelectTrigger id={`payment-method-${index}`}>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="debit_card">Debit Card</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="store_credit">Store Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1 space-y-2">
            <Label htmlFor={`payment-amount-${index}`}>Amount (₹)</Label>
            <div className="flex gap-2">
              <Input
                id={`payment-amount-${index}`}
                type="number"
                step="0.01"
                min="0"
                max={totalAmount}
                value={payment.amount}
                onChange={(e) => updatePayment(index, 'amount', e.target.value)}
                disabled={disabled}
              />
              {remainingAmount > 0 && index === payments.length - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAutoFillRemaining(index)}
                  disabled={disabled}
                >
                  Fill
                </Button>
              )}
            </div>
          </div>
          
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => removePayment(index)}
            disabled={payments.length <= 1 || disabled}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      
      <Button
        type="button"
        variant="outline"
        onClick={addPayment}
        disabled={remainingAmount <= 0 || disabled}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Payment Method
      </Button>
    </div>
  );
}