import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReconciliationPanel } from '@/components/banking/ReconciliationPanel';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { useBranding } from '@/contexts/BrandingContext';
import { uuid } from '@/lib/utils';
import { PermissionGate } from '@/components/PermissionGate';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Upload, 
  Check, 
  X, 
  Trash2, 
  Edit2,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Circle,
  Plus,
  AlertTriangle
} from 'lucide-react';

interface BankAccount {
  id: string;
  name: string;
  bank_name: string | null;
  bsb: string | null;
  account_number: string | null;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  is_default: boolean;
}

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  reference: string | null;
  balance_after: number | null;
  is_reconciled: boolean;
  matched_payment_id: string | null;
  matched_purchase_id: string | null;
  matched_payment?: {
    invoice: {
      invoice_number: string;
      client: { name: string } | null;
    } | null;
  } | null;
  matched_purchase?: {
    description: string;
    vendor: { name: string } | null;
    vendor_name: string | null;
  } | null;
}

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  balance?: number;
  isDuplicate?: boolean;
}

export default function BankAccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { formatCurrency } = useBranding();

  const [account, setAccount] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [addTransactionDialogOpen, setAddTransactionDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'overwrite' | 'import'>('skip');

  // Manual transaction form
  const [manualTransaction, setManualTransaction] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    amount: '',
    reference: '',
    isDebit: false,
  });

  const [editForm, setEditForm] = useState({
    name: '',
    bank_name: '',
    bsb: '',
    account_number: '',
    is_active: true,
    is_default: false,
  });

  // Import state
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [amountType, setAmountType] = useState<'single' | 'split'>('single');
  const [columnMapping, setColumnMapping] = useState({
    date: '0',
    description: '1',
    amount: '2',
    debit: '__none__',
    credit: '__none__',
    balance: '__none__',
  });
  const [parsedTransactions, setParsedTransactions] = useState<ParsedRow[]>([]);
  const [importStep, setImportStep] = useState<'upload' | 'map' | 'preview'>('upload');

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [accountRes, transactionsRes] = await Promise.all([
        supabase.from('bank_accounts').select('*').eq('id', id).single(),
        supabase
          .from('bank_transactions')
          .select(`
            *,
            matched_payment:payments(invoice:invoices(invoice_number, client:clients(name))),
            matched_purchase:purchases(description, vendor_name, vendor:vendors(name))
          `)
          .eq('bank_account_id', id)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false }),
      ]);

      if (accountRes.error) throw accountRes.error;
      if (transactionsRes.error) throw transactionsRes.error;

      setAccount(accountRes.data);
      setTransactions(transactionsRes.data || []);
      setEditForm({
        name: accountRes.data.name,
        bank_name: accountRes.data.bank_name || '',
        bsb: accountRes.data.bsb || '',
        account_number: accountRes.data.account_number || '',
        is_active: accountRes.data.is_active,
        is_default: accountRes.data.is_default,
      });
    } catch (error: any) {
      toast({
        title: 'Error loading account',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAccount = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('bank_accounts')
        .update({
          name: editForm.name,
          bank_name: editForm.bank_name || null,
          bsb: editForm.bsb || null,
          account_number: editForm.account_number || null,
          is_active: editForm.is_active,
          is_default: editForm.is_default,
        })
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Account updated' });
      setEditDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error updating account',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!id) return;
    if (!(await confirm({
      title: 'Delete bank account?',
      description: 'This will permanently delete this bank account and all its transactions.',
      confirmLabel: 'Delete',
      destructive: true,
    }))) return;
    try {
      const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Account deleted' });
      navigate('/banking');
    } catch (error: any) {
      toast({
        title: 'Error deleting account',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const parsed = lines.map(line => {
        // Handle CSV with quoted fields
        const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g;
        const fields: string[] = [];
        let match;
        while ((match = regex.exec(line)) !== null) {
          fields.push((match[1] || match[2] || '').trim());
        }
        return fields;
      });
      setCsvData(parsed);
      setImportStep('map');
    };
    reader.readAsText(file);
  };

  const parseTransactions = () => {
    const dateIdx = parseInt(columnMapping.date);
    const descIdx = parseInt(columnMapping.description);
    const balanceIdx = columnMapping.balance && columnMapping.balance !== '__none__' ? parseInt(columnMapping.balance) : -1;

    // Create a set of existing transaction signatures for duplicate detection
    const existingSignatures = new Set(
      transactions.map(t => `${t.date}|${t.description.toLowerCase().trim()}|${t.amount}`)
    );

    const parsed: ParsedRow[] = [];
    // Skip header row
    for (let i = 1; i < csvData.length; i++) {
      const row = csvData[i];
      if (!row[dateIdx] || !row[descIdx]) continue;

      let amount = 0;
      
      if (amountType === 'single') {
        const amountIdx = parseInt(columnMapping.amount);
        amount = parseFloat(row[amountIdx]?.replace(/[^0-9.-]/g, '') || '0');
      } else {
        // Debit/Credit split columns
        const debitIdx = columnMapping.debit !== '__none__' ? parseInt(columnMapping.debit) : -1;
        const creditIdx = columnMapping.credit !== '__none__' ? parseInt(columnMapping.credit) : -1;
        
        const debitVal = debitIdx >= 0 ? parseFloat(row[debitIdx]?.replace(/[^0-9.-]/g, '') || '0') : 0;
        const creditVal = creditIdx >= 0 ? parseFloat(row[creditIdx]?.replace(/[^0-9.-]/g, '') || '0') : 0;
        
        // Credits are positive (money in), debits are negative (money out)
        amount = creditVal - debitVal;
      }

      const dateForDb = formatDateForDb(row[dateIdx]);
      const signature = `${dateForDb}|${row[descIdx].toLowerCase().trim()}|${amount}`;
      const isDuplicate = existingSignatures.has(signature);
      
      parsed.push({
        date: row[dateIdx],
        description: row[descIdx],
        amount,
        balance: balanceIdx >= 0 ? parseFloat(row[balanceIdx]?.replace(/[^0-9.-]/g, '') || '0') : undefined,
        isDuplicate,
      });
    }
    setParsedTransactions(parsed);
    setImportStep('preview');
  };

  const handleImport = async () => {
    if (!id || parsedTransactions.length === 0) return;
    setSaving(true);

    try {
      const batchId = uuid();
      
      // Handle duplicates based on selected action
      const duplicates = parsedTransactions.filter(t => t.isDuplicate);
      const nonDuplicates = parsedTransactions.filter(t => !t.isDuplicate);
      
      let transactionsToInsert: any[] = [];
      let deletedCount = 0;

      if (duplicateAction === 'skip') {
        // Only import non-duplicates
        transactionsToInsert = nonDuplicates;
      } else if (duplicateAction === 'overwrite') {
        // Delete existing duplicates first, then import all
        if (duplicates.length > 0) {
          for (const dup of duplicates) {
            const dateForDb = formatDateForDb(dup.date);
            const { error } = await supabase
              .from('bank_transactions')
              .delete()
              .eq('bank_account_id', id)
              .eq('date', dateForDb)
              .ilike('description', dup.description.trim())
              .eq('amount', dup.amount);
            
            if (error) throw error;
            deletedCount++;
          }
        }
        transactionsToInsert = parsedTransactions;
      } else {
        // Import all including duplicates (will create new entries)
        transactionsToInsert = parsedTransactions;
      }

      if (transactionsToInsert.length === 0) {
        toast({ title: 'No transactions to import', description: 'All transactions were skipped.', variant: 'destructive' });
        setSaving(false);
        return;
      }

      const insertData = transactionsToInsert.map((t) => ({
        bank_account_id: id,
        date: formatDateForDb(t.date),
        description: t.description,
        amount: t.amount,
        balance_after: t.balance,
        import_batch_id: batchId,
        imported_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('bank_transactions').insert(insertData);
      if (error) throw error;

      let message = `Imported ${transactionsToInsert.length} transactions`;
      if (duplicateAction === 'skip' && duplicates.length > 0) {
        message += ` (${duplicates.length} duplicates skipped)`;
      } else if (duplicateAction === 'overwrite' && deletedCount > 0) {
        message += ` (${deletedCount} duplicates replaced)`;
      }
      
      toast({ title: message });
      setImportDialogOpen(false);
      resetImportState();
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error importing transactions',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddManualTransaction = async () => {
    if (!id || !manualTransaction.description || !manualTransaction.amount) return;
    setSaving(true);

    try {
      const amount = parseFloat(manualTransaction.amount) * (manualTransaction.isDebit ? -1 : 1);
      
      const { error } = await supabase.from('bank_transactions').insert({
        bank_account_id: id,
        date: manualTransaction.date,
        description: manualTransaction.description,
        amount,
        reference: manualTransaction.reference || null,
      });

      if (error) throw error;

      toast({ title: 'Transaction added' });
      setAddTransactionDialogOpen(false);
      setManualTransaction({
        date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        amount: '',
        reference: '',
        isDebit: false,
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error adding transaction',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDateForDb = (dateStr: string): string => {
    // Try common date formats
    const formats = [
      /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
      /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
      /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
      /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/, // D/M/YY or D/M/YYYY
    ];

    for (const regex of formats) {
      const match = dateStr.match(regex);
      if (match) {
        if (regex === formats[2]) {
          // YYYY-MM-DD
          return dateStr;
        } else if (regex === formats[0] || regex === formats[1]) {
          // DD/MM/YYYY or DD-MM-YYYY
          return `${match[3]}-${match[2]}-${match[1]}`;
        } else {
          // D/M/YY or D/M/YYYY
          const day = match[1].padStart(2, '0');
          const month = match[2].padStart(2, '0');
          let year = match[3];
          if (year.length === 2) {
            year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
          }
          return `${year}-${month}-${day}`;
        }
      }
    }
    return dateStr; // Return as-is if no format matches
  };

  const resetImportState = () => {
    setCsvData([]);
    setAmountType('single');
    setColumnMapping({ date: '0', description: '1', amount: '2', debit: '__none__', credit: '__none__', balance: '__none__' });
    setParsedTransactions([]);
    setImportStep('upload');
    setDuplicateAction('skip');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!(await confirm({
      title: 'Delete transaction?',
      description: 'This will permanently delete this transaction.',
      confirmLabel: 'Delete',
      destructive: true,
    }))) return;
    try {
      const { error } = await supabase.from('bank_transactions').delete().eq('id', transactionId);
      if (error) throw error;
      toast({ title: 'Transaction deleted' });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error deleting transaction',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const toggleReconciled = async (transaction: BankTransaction) => {
    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({
          is_reconciled: !transaction.is_reconciled,
          reconciled_at: !transaction.is_reconciled ? new Date().toISOString() : null,
        })
        .eq('id', transaction.id);

      if (error) throw error;
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error updating transaction',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Account not found</h2>
        <Link to="/banking">
          <Button variant="outline">Back to Banking</Button>
        </Link>
      </div>
    );
  }

  const reconciledCount = transactions.filter(t => t.is_reconciled).length;
  const unreconciledCount = transactions.length - reconciledCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/banking">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{account.name}</h1>
            {account.is_default && <Badge variant="secondary">Default</Badge>}
            {!account.is_active && <Badge variant="outline">Inactive</Badge>}
          </div>
          {account.bank_name && (
            <p className="text-muted-foreground">{account.bank_name}</p>
          )}
        </div>
        <PermissionGate resource="banking" action="write">
          <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" onClick={() => setAddTransactionDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </Button>
          <Button onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
        </PermissionGate>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${Number(account.current_balance) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(Number(account.current_balance))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Opening Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(Number(account.opening_balance))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              Reconciled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{reconciledCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Circle className="h-4 w-4 text-muted-foreground" />
              Unreconciled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">{unreconciledCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Transactions and Reconciliation */}
      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">All Transactions</TabsTrigger>
          <TabsTrigger value="reconcile">
            Reconcile
            {unreconciledCount > 0 && (
              <Badge variant="secondary" className="ml-2">{unreconciledCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No transactions yet. Import a CSV file to get started.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id} className={transaction.is_reconciled ? 'bg-muted/30' : ''}>
                        <TableCell>
                          <button
                            onClick={() => toggleReconciled(transaction)}
                            className="hover:opacity-80"
                          >
                            {transaction.is_reconciled ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell>{format(new Date(transaction.date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="max-w-xs truncate">{transaction.description}</TableCell>
                        <TableCell>
                          {transaction.is_reconciled && transaction.matched_payment?.invoice ? (
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              {transaction.matched_payment.invoice.invoice_number}
                              {transaction.matched_payment.invoice.client && (
                                <span className="text-muted-foreground font-normal"> - {transaction.matched_payment.invoice.client.name}</span>
                              )}
                            </span>
                          ) : transaction.is_reconciled && transaction.matched_purchase ? (
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              {transaction.matched_purchase.vendor?.name || transaction.matched_purchase.vendor_name || transaction.matched_purchase.description}
                            </span>
                          ) : (
                            transaction.reference || '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`flex items-center justify-end gap-1 ${transaction.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {transaction.amount >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {formatCurrency(Math.abs(transaction.amount))}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {transaction.balance_after != null
                            ? formatCurrency(Number(transaction.balance_after))
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <PermissionGate resource="banking" action="write">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteTransaction(transaction.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconcile" className="mt-4">
          <ReconciliationPanel 
            bankAccountId={id!} 
            onReconciled={fetchData}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Bank Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Account Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-bank">Bank Name</Label>
                <Input
                  id="edit-bank"
                  value={editForm.bank_name}
                  onChange={(e) => setEditForm({ ...editForm, bank_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-bsb">BSB</Label>
                <Input
                  id="edit-bsb"
                  value={editForm.bsb}
                  onChange={(e) => setEditForm({ ...editForm, bsb: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-account">Account Number</Label>
              <Input
                id="edit-account"
                value={editForm.account_number}
                onChange={(e) => setEditForm({ ...editForm, account_number: e.target.value })}
              />
            </div>
            <div className="flex gap-4">
              <Button onClick={handleUpdateAccount} disabled={saving} className="flex-1">
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="destructive" onClick={handleDeleteAccount}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => { setImportDialogOpen(open); if (!open) resetImportState(); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import Transactions</DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 border-b pb-4">
            <div className={`flex items-center gap-2 ${importStep === 'upload' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${importStep === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>1</span>
              <span className="text-sm">Upload</span>
            </div>
            <div className="h-px flex-1 bg-border" />
            <div className={`flex items-center gap-2 ${importStep === 'map' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${importStep === 'map' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>2</span>
              <span className="text-sm">Map Columns</span>
            </div>
            <div className="h-px flex-1 bg-border" />
            <div className={`flex items-center gap-2 ${importStep === 'preview' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${importStep === 'preview' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>3</span>
              <span className="text-sm">Import</span>
            </div>
          </div>
          
          {importStep === 'upload' && (
            <div className="py-8">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Upload CSV file</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Export transactions from your bank and upload the CSV file
                </p>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="max-w-xs mx-auto"
                />
              </div>
            </div>
          )}

          {importStep === 'map' && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Map the columns from your CSV file to the transaction fields.
              </p>
              {csvData.length > 0 && (
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  <strong>Header row:</strong> {csvData[0].join(' | ')}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date Column</Label>
                  <Select value={columnMapping.date} onValueChange={(v) => setColumnMapping({ ...columnMapping, date: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {csvData[0]?.map((col, idx) => (
                        <SelectItem key={idx} value={String(idx)}>Column {idx + 1}: {col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description Column</Label>
                  <Select value={columnMapping.description} onValueChange={(v) => setColumnMapping({ ...columnMapping, description: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {csvData[0]?.map((col, idx) => (
                        <SelectItem key={idx} value={String(idx)}>Column {idx + 1}: {col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Amount Type Selection */}
              <div className="space-y-3 border rounded-lg p-4">
                <Label className="text-sm font-medium">Amount Format</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="amountType" 
                      checked={amountType === 'single'} 
                      onChange={() => setAmountType('single')}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Single Amount Column</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="amountType" 
                      checked={amountType === 'split'} 
                      onChange={() => setAmountType('split')}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Separate Debit/Credit Columns</span>
                  </label>
                </div>

                {amountType === 'single' ? (
                  <div className="space-y-2">
                    <Label>Amount Column</Label>
                    <Select value={columnMapping.amount} onValueChange={(v) => setColumnMapping({ ...columnMapping, amount: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {csvData[0]?.map((col, idx) => (
                          <SelectItem key={idx} value={String(idx)}>Column {idx + 1}: {col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Positive values = money in, Negative values = money out
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Debit Column (money out)</Label>
                      <Select value={columnMapping.debit} onValueChange={(v) => setColumnMapping({ ...columnMapping, debit: v })}>
                        <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Not mapped</SelectItem>
                          {csvData[0]?.map((col, idx) => (
                            <SelectItem key={idx} value={String(idx)}>Column {idx + 1}: {col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Credit Column (money in)</Label>
                      <Select value={columnMapping.credit} onValueChange={(v) => setColumnMapping({ ...columnMapping, credit: v })}>
                        <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Not mapped</SelectItem>
                          {csvData[0]?.map((col, idx) => (
                            <SelectItem key={idx} value={String(idx)}>Column {idx + 1}: {col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Balance Column (optional)</Label>
                <Select value={columnMapping.balance} onValueChange={(v) => setColumnMapping({ ...columnMapping, balance: v })}>
                  <SelectTrigger><SelectValue placeholder="Not mapped" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not mapped</SelectItem>
                    {csvData[0]?.map((col, idx) => (
                      <SelectItem key={idx} value={String(idx)}>Column {idx + 1}: {col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button variant="outline" onClick={resetImportState}>Back</Button>
                <Button onClick={parseTransactions}>
                  Continue to Preview
                </Button>
              </div>
            </div>
          )}

          {importStep === 'preview' && (
            <div className="space-y-4 py-4">
              {(() => {
                const duplicateCount = parsedTransactions.filter(t => t.isDuplicate).length;
                const newCount = parsedTransactions.length - duplicateCount;
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {parsedTransactions.length} transactions found
                        {duplicateCount > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 ml-1">
                            ({duplicateCount} potential duplicates)
                          </span>
                        )}
                      </p>
                    </div>
                    {duplicateCount > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                            {duplicateCount} duplicate transactions detected
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            These match existing transactions by date, description, and amount.
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="duplicateAction"
                              checked={duplicateAction === 'skip'}
                              onChange={() => setDuplicateAction('skip')}
                              className="h-4 w-4"
                            />
                            <span className="text-sm text-amber-900 dark:text-amber-200">Skip duplicates</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="duplicateAction"
                              checked={duplicateAction === 'overwrite'}
                              onChange={() => setDuplicateAction('overwrite')}
                              className="h-4 w-4"
                            />
                            <span className="text-sm text-amber-900 dark:text-amber-200">Overwrite duplicates</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="duplicateAction"
                              checked={duplicateAction === 'import'}
                              onChange={() => setDuplicateAction('import')}
                              className="h-4 w-4"
                            />
                            <span className="text-sm text-amber-900 dark:text-amber-200">Import all anyway</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="max-h-80 overflow-y-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedTransactions.slice(0, 50).map((t, idx) => (
                      <TableRow key={idx} className={t.isDuplicate ? 'bg-amber-50/50 dark:bg-amber-950/50' : ''}>
                        <TableCell>
                          {t.isDuplicate ? (
                            <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                          ) : (
                            <Check className="h-4 w-4 text-green-500 dark:text-green-400" />
                          )}
                        </TableCell>
                        <TableCell>{t.date}</TableCell>
                        <TableCell className="max-w-xs truncate">{t.description}</TableCell>
                        <TableCell className={`text-right ${t.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatCurrency(Math.abs(t.amount))}
                        </TableCell>
                        <TableCell className="text-right">{t.balance != null ? formatCurrency(t.balance) : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsedTransactions.length > 50 && (
                <p className="text-xs text-muted-foreground">Showing first 50 of {parsedTransactions.length} transactions</p>
              )}
              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setImportStep('map')}>Back</Button>
                <Button onClick={handleImport} disabled={saving || parsedTransactions.length === 0}>
                  {saving ? 'Importing...' : `Import ${duplicateAction === 'skip' ? parsedTransactions.filter(t => !t.isDuplicate).length : parsedTransactions.length} Transactions`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Transaction Dialog */}
      <Dialog open={addTransactionDialogOpen} onOpenChange={setAddTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tx-date">Date</Label>
              <Input
                id="tx-date"
                type="date"
                value={manualTransaction.date}
                onChange={(e) => setManualTransaction({ ...manualTransaction, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-description">Description</Label>
              <Input
                id="tx-description"
                value={manualTransaction.description}
                onChange={(e) => setManualTransaction({ ...manualTransaction, description: e.target.value })}
                placeholder="e.g. Direct deposit, Payment received"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-reference">Reference (optional)</Label>
              <Input
                id="tx-reference"
                value={manualTransaction.reference}
                onChange={(e) => setManualTransaction({ ...manualTransaction, reference: e.target.value })}
                placeholder="e.g. Invoice number, check number"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tx-amount">Amount</Label>
                <Input
                  id="tx-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={manualTransaction.amount}
                  onChange={(e) => setManualTransaction({ ...manualTransaction, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Transaction Type</Label>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant={!manualTransaction.isDebit ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setManualTransaction({ ...manualTransaction, isDebit: false })}
                  >
                    <TrendingUp className="h-4 w-4 mr-1" />
                    Money In
                  </Button>
                  <Button
                    type="button"
                    variant={manualTransaction.isDebit ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setManualTransaction({ ...manualTransaction, isDebit: true })}
                  >
                    <TrendingDown className="h-4 w-4 mr-1" />
                    Money Out
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setAddTransactionDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddManualTransaction} 
                disabled={saving || !manualTransaction.description || !manualTransaction.amount}
              >
                {saving ? 'Adding...' : 'Add Transaction'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
