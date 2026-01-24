import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { 
  Link2, 
  Link2Off, 
  TrendingUp, 
  TrendingDown,
  CheckCircle2,
  Search
} from 'lucide-react';

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  reference: string | null;
  is_reconciled: boolean;
  matched_payment_id: string | null;
  matched_purchase_id: string | null;
}

interface Payment {
  id: string;
  date: string;
  amount: number;
  reference: string | null;
  method: string | null;
  invoice: {
    invoice_number: string;
    client: {
      name: string;
    };
  };
}

interface Purchase {
  id: string;
  date: string;
  description: string;
  total: number;
  reference: string | null;
  vendor_name: string | null;
  vendor: {
    name: string;
  } | null;
}

interface ReconciliationPanelProps {
  bankAccountId: string;
  onReconciled: () => void;
}

export function ReconciliationPanel({ bankAccountId, onReconciled }: ReconciliationPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    fetchData();
  }, [bankAccountId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [txRes, payRes, purchRes] = await Promise.all([
        supabase
          .from('bank_transactions')
          .select('*')
          .eq('bank_account_id', bankAccountId)
          .eq('is_reconciled', false)
          .order('date', { ascending: false }),
        supabase
          .from('payments')
          .select(`
            id, date, amount, reference, method,
            invoice:invoices(invoice_number, client:clients(name))
          `)
          .is('id', null) // Will be updated with proper filter
          .order('date', { ascending: false })
          .limit(100),
        supabase
          .from('purchases')
          .select(`
            id, date, description, total, reference, vendor_name,
            vendor:vendors(name)
          `)
          .order('date', { ascending: false })
          .limit(100),
      ]);

      // Fetch unmatched payments (not linked to any bank transaction)
      const { data: unmatchedPayments } = await supabase
        .from('payments')
        .select(`
          id, date, amount, reference, method,
          invoice:invoices(invoice_number, client:clients(name))
        `)
        .order('date', { ascending: false })
        .limit(100);

      // Filter payments not already matched
      const { data: matchedPaymentIds } = await supabase
        .from('bank_transactions')
        .select('matched_payment_id')
        .not('matched_payment_id', 'is', null);

      const matchedIds = new Set((matchedPaymentIds || []).map(r => r.matched_payment_id));
      const filteredPayments = (unmatchedPayments || []).filter(p => !matchedIds.has(p.id));

      // Fetch unmatched purchases
      const { data: matchedPurchaseIds } = await supabase
        .from('bank_transactions')
        .select('matched_purchase_id')
        .not('matched_purchase_id', 'is', null);

      const matchedPurchIds = new Set((matchedPurchaseIds || []).map(r => r.matched_purchase_id));
      const filteredPurchases = (purchRes.data || []).filter(p => !matchedPurchIds.has(p.id));

      setTransactions(txRes.data || []);
      setPayments(filteredPayments as Payment[]);
      setPurchases(filteredPurchases as Purchase[]);
    } catch (error: any) {
      toast({
        title: 'Error loading data',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openMatchDialog = (transaction: BankTransaction) => {
    setSelectedTransaction(transaction);
    setMatchDialogOpen(true);
  };

  const handleMatch = async (type: 'payment' | 'purchase', id: string) => {
    if (!selectedTransaction) return;
    setMatching(true);
    try {
      const updateData = type === 'payment' 
        ? { matched_payment_id: id, is_reconciled: true, reconciled_at: new Date().toISOString() }
        : { matched_purchase_id: id, is_reconciled: true, reconciled_at: new Date().toISOString() };

      const { error } = await supabase
        .from('bank_transactions')
        .update(updateData)
        .eq('id', selectedTransaction.id);

      if (error) throw error;

      toast({ title: 'Transaction matched' });
      setMatchDialogOpen(false);
      setSelectedTransaction(null);
      fetchData();
      onReconciled();
    } catch (error: any) {
      toast({
        title: 'Error matching transaction',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setMatching(false);
    }
  };

  const handleUnmatch = async (transaction: BankTransaction) => {
    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({
          matched_payment_id: null,
          matched_purchase_id: null,
          is_reconciled: false,
          reconciled_at: null,
        })
        .eq('id', transaction.id);

      if (error) throw error;
      toast({ title: 'Match removed' });
      fetchData();
      onReconciled();
    } catch (error: any) {
      toast({
        title: 'Error unmatching',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getSuggestions = (transaction: BankTransaction) => {
    const amount = Math.abs(transaction.amount);
    const date = new Date(transaction.date);
    const suggestions: { type: 'payment' | 'purchase'; item: Payment | Purchase; score: number }[] = [];

    // Check payments for deposits (positive amounts)
    if (transaction.amount > 0) {
      payments.forEach(payment => {
        let score = 0;
        if (Math.abs(payment.amount - amount) < 0.01) score += 50;
        else if (Math.abs(payment.amount - amount) < 1) score += 30;
        
        const paymentDate = new Date(payment.date);
        const daysDiff = Math.abs((date.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 1) score += 30;
        else if (daysDiff <= 3) score += 20;
        else if (daysDiff <= 7) score += 10;

        if (payment.reference && transaction.description.toLowerCase().includes(payment.reference.toLowerCase())) {
          score += 20;
        }

        if (score > 0) {
          suggestions.push({ type: 'payment', item: payment, score });
        }
      });
    }

    // Check purchases for withdrawals (negative amounts)
    if (transaction.amount < 0) {
      purchases.forEach(purchase => {
        let score = 0;
        if (Math.abs(purchase.total - amount) < 0.01) score += 50;
        else if (Math.abs(purchase.total - amount) < 1) score += 30;
        
        const purchaseDate = new Date(purchase.date);
        const daysDiff = Math.abs((date.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 1) score += 30;
        else if (daysDiff <= 3) score += 20;
        else if (daysDiff <= 7) score += 10;

        const vendorName = purchase.vendor?.name || purchase.vendor_name || '';
        if (vendorName && transaction.description.toLowerCase().includes(vendorName.toLowerCase())) {
          score += 20;
        }

        if (score > 0) {
          suggestions.push({ type: 'purchase', item: purchase, score });
        }
      });
    }

    return suggestions.sort((a, b) => b.score - a.score).slice(0, 5);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Unreconciled Transactions</h3>
          <p className="text-sm text-muted-foreground">
            Match bank transactions with payments received (invoices) and bills paid (purchases)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-green-600">
            <TrendingUp className="h-3 w-3 mr-1" />
            {payments.length} payments
          </Badge>
          <Badge variant="outline" className="text-red-600">
            <TrendingDown className="h-3 w-3 mr-1" />
            {purchases.length} bills
          </Badge>
          <Badge variant="secondary">{transactions.length} to reconcile</Badge>
        </div>
      </div>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-600" />
            <p className="font-medium">All transactions reconciled!</p>
            <p className="text-sm">Import more transactions to continue reconciling.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Suggestions</TableHead>
                  <TableHead className="w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => {
                  const suggestions = getSuggestions(transaction);
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>{format(new Date(transaction.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="max-w-xs truncate">{transaction.description}</TableCell>
                      <TableCell className="text-right">
                        <span className={`flex items-center justify-end gap-1 ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.amount >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          ${Math.abs(transaction.amount).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell>
                        {suggestions.length > 0 ? (
                          <Badge variant="secondary" className="text-xs">
                            {suggestions.length} match{suggestions.length > 1 ? 'es' : ''}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">No matches</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openMatchDialog(transaction)}
                        >
                          <Search className="h-3 w-3 mr-1" />
                          Match
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Match Dialog */}
      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Match Transaction</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardContent className="py-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{selectedTransaction.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(selectedTransaction.date), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <p className={`text-lg font-bold ${selectedTransaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${Math.abs(selectedTransaction.amount).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div>
                <h4 className="text-sm font-medium mb-2">Suggested Matches</h4>
                {getSuggestions(selectedTransaction).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No matching {selectedTransaction.amount >= 0 ? 'payments' : 'purchases'} found
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {getSuggestions(selectedTransaction).map((suggestion) => (
                      <Card 
                        key={`${suggestion.type}-${suggestion.item.id}`}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleMatch(suggestion.type, suggestion.item.id)}
                      >
                        <CardContent className="py-3">
                          <div className="flex justify-between items-center">
                            <div>
                              {suggestion.type === 'payment' ? (
                                <>
                                  <p className="font-medium">
                                    {(suggestion.item as Payment).invoice?.client?.name || 'Unknown Client'}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Invoice {(suggestion.item as Payment).invoice?.invoice_number} • {format(new Date(suggestion.item.date), 'dd/MM/yyyy')}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="font-medium">
                                    {(suggestion.item as Purchase).vendor?.name || (suggestion.item as Purchase).vendor_name || 'Unknown Vendor'}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {(suggestion.item as Purchase).description} • {format(new Date(suggestion.item.date), 'dd/MM/yyyy')}
                                  </p>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="font-medium">
                                ${(suggestion.type === 'payment' 
                                  ? (suggestion.item as Payment).amount 
                                  : (suggestion.item as Purchase).total
                                ).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                              </p>
                              <Badge variant={suggestion.score >= 70 ? 'default' : 'secondary'}>
                                {suggestion.score}%
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-2">
                  All {selectedTransaction.amount >= 0 ? 'Payments Received' : 'Bills Paid'}
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {selectedTransaction.amount >= 0 ? (
                    payments.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No unmatched payments</p>
                    ) : (
                      payments.map(payment => (
                        <div 
                          key={payment.id}
                          className="flex justify-between items-center p-2 rounded hover:bg-muted cursor-pointer"
                          onClick={() => handleMatch('payment', payment.id)}
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {payment.invoice?.client?.name || 'Unknown'} - {payment.invoice?.invoice_number}
                            </p>
                            <p className="text-xs text-muted-foreground">{format(new Date(payment.date), 'dd/MM/yyyy')}</p>
                          </div>
                          <p className="text-sm font-medium">${payment.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</p>
                        </div>
                      ))
                    )
                  ) : (
                    purchases.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No unmatched purchases</p>
                    ) : (
                      purchases.map(purchase => (
                        <div 
                          key={purchase.id}
                          className="flex justify-between items-center p-2 rounded hover:bg-muted cursor-pointer"
                          onClick={() => handleMatch('purchase', purchase.id)}
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {purchase.vendor?.name || purchase.vendor_name || 'Unknown'} - {purchase.description}
                            </p>
                            <p className="text-xs text-muted-foreground">{format(new Date(purchase.date), 'dd/MM/yyyy')}</p>
                          </div>
                          <p className="text-sm font-medium">${purchase.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</p>
                        </div>
                      ))
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
