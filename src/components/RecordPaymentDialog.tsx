import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useBranding } from '@/contexts/BrandingContext';
import { todayLocal } from '@/lib/dates';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'> & { clients?: { name: string } | null };

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultInvoiceId?: string;
  onSuccess?: () => void;
}

const emptyPayment = () => ({
  invoice_id: '',
  amount: 0,
  date: todayLocal(),
  method: '',
  reference: '',
  notes: '',
  bank_account_id: '',
});

export default function RecordPaymentDialog({ open, onOpenChange, defaultInvoiceId, onSuccess }: RecordPaymentDialogProps) {
  const { toast } = useToast();
  const { formatCurrency } = useBranding();
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bankAccounts, setBankAccounts] = useState<{ id: string; name: string; current_balance: number }[]>([]);
  const [clientCredit, setClientCredit] = useState<number>(0);
  const [creditToApply, setCreditToApply] = useState<number>(0);
  const [overpaidInvoices, setOverpaidInvoices] = useState<{ id: string; overpayment: number }[]>([]);
  const [newPayment, setNewPayment] = useState(emptyPayment());

  useEffect(() => {
    if (open) {
      fetchData();
    } else {
      // Reset form state when the dialog closes
      setNewPayment(emptyPayment());
      setClientCredit(0);
      setCreditToApply(0);
      setOverpaidInvoices([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchData() {
    setLoading(true);
    const [invoicesRes, bankRes] = await Promise.all([
      supabase
        .from('invoices')
        .select('*, clients(name)')
        .in('status', ['sent', 'partially_paid', 'overdue'])
        .order('invoice_number'),
      supabase
        .from('bank_accounts')
        .select('id, name, current_balance')
        .eq('is_active', true)
        .order('name'),
    ]);

    const payableInvoices = invoicesRes.data || [];
    setInvoices(payableInvoices);
    setBankAccounts(bankRes.data || []);
    setLoading(false);

    if (defaultInvoiceId && payableInvoices.some((inv) => inv.id === defaultInvoiceId)) {
      handleInvoiceSelect(defaultInvoiceId, payableInvoices);
    }
  }

  async function fetchClientCredit(clientId: string) {
    // Calculate credit from overpaid invoices (amount_paid > total on paid invoices)
    const { data: clientInvoices } = await supabase
      .from('invoices')
      .select('id, total, amount_paid, status')
      .eq('client_id', clientId)
      .in('status', ['paid', 'partially_paid', 'sent', 'overdue']);

    if (!clientInvoices) {
      setClientCredit(0);
      return { credit: 0, overpaidInvoices: [] as { id: string; overpayment: number }[] };
    }

    // Find overpaid invoices and calculate total credit
    const overpaid = clientInvoices
      .filter((inv) => (inv.amount_paid || 0) > (inv.total || 0))
      .map((inv) => ({
        id: inv.id,
        overpayment: (inv.amount_paid || 0) - (inv.total || 0),
      }));

    const credit = overpaid.reduce((sum, inv) => sum + inv.overpayment, 0);

    setClientCredit(credit);
    return { credit, overpaidInvoices: overpaid };
  }

  async function handleInvoiceSelect(invoiceId: string, invoiceList: Invoice[] = invoices) {
    const invoice = invoiceList.find((i) => i.id === invoiceId);
    if (!invoice) return;

    const amountDue = invoice.total - invoice.amount_paid;

    // Fetch client credit and overpaid invoices
    const result = await fetchClientCredit(invoice.client_id);
    setOverpaidInvoices(result.overpaidInvoices);

    // Auto-apply credit (capped at amount due)
    const creditApplied = Math.min(result.credit, amountDue);
    setCreditToApply(creditApplied);

    // Set payment amount to remaining after credit
    const paymentAmount = amountDue - creditApplied;

    setNewPayment((prev) => ({
      ...prev,
      invoice_id: invoiceId,
      amount: paymentAmount,
    }));
  }

  async function handleAddPayment() {
    if (!newPayment.invoice_id) {
      toast({ title: 'Error', description: 'Invoice is required', variant: 'destructive' });
      return;
    }

    const totalApplied = newPayment.amount + creditToApply;
    if (totalApplied <= 0) {
      toast({ title: 'Error', description: 'Total payment (cash + credit) must be greater than 0', variant: 'destructive' });
      return;
    }

    const invoice = invoices.find((i) => i.id === newPayment.invoice_id);
    if (!invoice) return;

    // If credit is being applied, reduce the overpaid invoices' amount_paid
    if (creditToApply > 0) {
      let remainingCreditToDeduct = creditToApply;

      // Deduct credit from overpaid invoices (FIFO order)
      for (const overpaidInv of overpaidInvoices) {
        if (remainingCreditToDeduct <= 0) break;

        const deductFromThis = Math.min(overpaidInv.overpayment, remainingCreditToDeduct);

        // Get current amount_paid for this invoice
        const { data: currentInv } = await supabase
          .from('invoices')
          .select('amount_paid, total')
          .eq('id', overpaidInv.id)
          .single();

        if (currentInv) {
          const newAmountPaid = currentInv.amount_paid - deductFromThis;
          const newStatus = newAmountPaid >= currentInv.total ? 'paid' : 'partially_paid';

          await supabase
            .from('invoices')
            .update({ amount_paid: newAmountPaid, status: newStatus })
            .eq('id', overpaidInv.id);
        }

        remainingCreditToDeduct -= deductFromThis;
      }

      // Record the credit payment on the target invoice
      const { data: userData } = await supabase.auth.getUser();
      const { error: creditError } = await supabase.from('payments').insert({
        invoice_id: newPayment.invoice_id,
        amount: creditToApply,
        date: newPayment.date,
        method: 'credit',
        reference: 'Credit applied from overpayment',
        notes: 'Automatic credit application',
        created_by: userData.user?.id,
      });

      if (creditError) {
        toast({ title: 'Error', description: creditError.message, variant: 'destructive' });
        return;
      }
    }

    // If there's a cash payment component, record it
    if (newPayment.amount > 0) {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('payments').insert({
        invoice_id: newPayment.invoice_id,
        amount: newPayment.amount,
        date: newPayment.date,
        method: newPayment.method,
        reference: newPayment.reference,
        notes: newPayment.notes,
        created_by: userData.user?.id,
      });

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }

      // Update bank account balance if selected
      if (newPayment.bank_account_id) {
        const bankAccount = bankAccounts.find((b) => b.id === newPayment.bank_account_id);
        if (bankAccount) {
          await supabase
            .from('bank_accounts')
            .update({ current_balance: bankAccount.current_balance + newPayment.amount })
            .eq('id', newPayment.bank_account_id);
        }
      }
    }

    // Update invoice amount_paid and status
    const newAmountPaid = invoice.amount_paid + totalApplied;
    const newStatus = newAmountPaid >= invoice.total ? 'paid' : 'partially_paid';

    await supabase
      .from('invoices')
      .update({ amount_paid: newAmountPaid, status: newStatus })
      .eq('id', newPayment.invoice_id);

    toast({ title: 'Success', description: 'Payment recorded' });
    setNewPayment(emptyPayment());
    setClientCredit(0);
    setCreditToApply(0);
    setOverpaidInvoices([]);
    onOpenChange(false);
    onSuccess?.();
  }

  const defaultInvoiceInvalid = !loading && !!defaultInvoiceId && !invoices.some((inv) => inv.id === defaultInvoiceId);
  const noPayableInvoices = !loading && invoices.length === 0;
  const showEmptyState = !loading && (defaultInvoiceInvalid || noPayableInvoices);
  const emptyStateMessage = defaultInvoiceInvalid
    ? "This invoice isn't awaiting payment."
    : 'No invoices awaiting payment. Draft invoices must be marked as Sent before a payment can be recorded.';

  const selectedInvoice = invoices.find((i) => i.id === newPayment.invoice_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment Received</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {showEmptyState ? (
            <p className="text-sm text-muted-foreground p-3 border rounded-lg bg-muted">
              {emptyStateMessage}
            </p>
          ) : (
            <div className="space-y-2">
              <Label>Invoice *</Label>
              <Select
                value={newPayment.invoice_id}
                onValueChange={(value) => handleInvoiceSelect(value)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loading ? 'Loading invoices...' : 'Select invoice'} />
                </SelectTrigger>
                <SelectContent>
                  {invoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoice_number} - {inv.clients?.name} ({formatCurrency(inv.total - inv.amount_paid)} due)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Credit section - only show if there's credit available */}
          {newPayment.invoice_id && clientCredit > 0 && (
            <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  Available Credit
                </span>
                <span className="font-semibold text-green-700 dark:text-green-300">
                  {formatCurrency(clientCredit)}
                </span>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Credit to Apply</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={Math.min(clientCredit, (selectedInvoice?.total || 0) - (selectedInvoice?.amount_paid || 0))}
                  value={creditToApply}
                  onChange={(e) => {
                    if (!selectedInvoice) return;
                    const amountDue = selectedInvoice.total - selectedInvoice.amount_paid;
                    const newCredit = Math.min(parseFloat(e.target.value) || 0, clientCredit, amountDue);
                    setCreditToApply(newCredit);
                    // Adjust payment amount accordingly
                    setNewPayment((prev) => ({ ...prev, amount: amountDue - newCredit }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Set to 0 to pay the full amount without using credit
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cash/Bank Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={newPayment.amount}
                onChange={(e) => setNewPayment({ ...newPayment, amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={newPayment.date}
                onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })}
              />
            </div>
          </div>

          {/* Payment summary */}
          {newPayment.invoice_id && (
            <div className="p-3 bg-muted rounded-lg space-y-1">
              <div className="flex justify-between text-sm">
                <span>Amount Due:</span>
                <span>{formatCurrency((selectedInvoice?.total || 0) - (selectedInvoice?.amount_paid || 0))}</span>
              </div>
              {creditToApply > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Credit Applied:</span>
                  <span>-{formatCurrency(creditToApply)}</span>
                </div>
              )}
              <div className="flex justify-between font-medium pt-1 border-t">
                <span>Cash/Bank Payment:</span>
                <span>{formatCurrency(newPayment.amount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-primary pt-1">
                <span>Total Applied:</span>
                <span>{formatCurrency(newPayment.amount + creditToApply)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Method</Label>
              <Select
                value={newPayment.method}
                onValueChange={(value) => setNewPayment({ ...newPayment, method: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input
                value={newPayment.reference}
                onChange={(e) => setNewPayment({ ...newPayment, reference: e.target.value })}
              />
            </div>
          </div>

          {/* Bank Account Selection */}
          {bankAccounts.length > 0 && (
            <div className="space-y-2">
              <Label>Deposit To Bank Account</Label>
              <Select
                value={newPayment.bank_account_id}
                onValueChange={(v) => setNewPayment({ ...newPayment, bank_account_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select bank account (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} ({formatCurrency(Number(acc.current_balance))})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select to automatically update the bank balance
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={newPayment.notes}
              onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
            />
          </div>
          <Button className="w-full" onClick={handleAddPayment} disabled={showEmptyState}>
            Record Payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
