import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, startOfYear } from 'date-fns';
import { Link } from 'react-router-dom';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface InvoiceGST {
  id: string;
  invoice_number: string;
  client_name: string;
  issue_date: string;
  subtotal: number;
  tax_total: number;
  total: number;
}

interface PurchaseGST {
  id: string;
  description: string;
  vendor_name: string;
  date: string;
  amount: number;
  tax_amount: number;
  total: number;
}

export default function GSTSummaryReport() {
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceGST[]>([]);
  const [purchases, setPurchases] = useState<PurchaseGST[]>([]);
  const [totals, setTotals] = useState({
    gstCollected: 0,
    gstPaid: 0,
    netGST: 0,
    salesExGST: 0,
    purchasesExGST: 0,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

  async function fetchReport() {
    setLoading(true);

    // Fetch invoices with GST (non-draft, non-voided)
    const { data: invoiceData } = await supabase
      .from('invoices')
      .select('id, invoice_number, issue_date, subtotal, tax_total, total, clients(name)')
      .not('status', 'in', '("draft","voided")')
      .gte('issue_date', startDate)
      .lte('issue_date', endDate)
      .order('issue_date', { ascending: false });

    // Fetch purchases with tax
    const { data: purchaseData } = await supabase
      .from('purchases')
      .select('id, description, vendor_name, date, amount, tax_amount, total, vendors(name)')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    const formattedInvoices: InvoiceGST[] = (invoiceData || []).map(inv => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      client_name: (inv.clients as any)?.name || 'Unknown',
      issue_date: inv.issue_date,
      subtotal: inv.subtotal || 0,
      tax_total: inv.tax_total || 0,
      total: inv.total || 0,
    }));

    const formattedPurchases: PurchaseGST[] = (purchaseData || []).map(p => ({
      id: p.id,
      description: p.description,
      vendor_name: (p.vendors as any)?.name || p.vendor_name || 'Unknown',
      date: p.date,
      amount: p.amount || 0,
      tax_amount: p.tax_amount || 0,
      total: p.total || 0,
    }));

    const gstCollected = formattedInvoices.reduce((sum, inv) => sum + inv.tax_total, 0);
    const gstPaid = formattedPurchases.reduce((sum, p) => sum + p.tax_amount, 0);
    const salesExGST = formattedInvoices.reduce((sum, inv) => sum + inv.subtotal, 0);
    const purchasesExGST = formattedPurchases.reduce((sum, p) => sum + p.amount, 0);

    setInvoices(formattedInvoices);
    setPurchases(formattedPurchases);
    setTotals({
      gstCollected,
      gstPaid,
      netGST: gstCollected - gstPaid,
      salesExGST,
      purchasesExGST,
    });
    setLoading(false);
  }

  useEffect(() => {
    fetchReport();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>BAS Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button onClick={fetchReport} disabled={loading}>
              {loading ? 'Loading...' : 'Run Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              GST Collected (1A)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.gstCollected)}</div>
            <p className="text-xs text-muted-foreground">on sales of {formatCurrency(totals.salesExGST)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              GST Paid (1B)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totals.gstPaid)}</div>
            <p className="text-xs text-muted-foreground">on purchases of {formatCurrency(totals.purchasesExGST)}</p>
          </CardContent>
        </Card>
        <Card className={totals.netGST >= 0 ? 'border-orange-200 bg-orange-50/50' : 'border-green-200 bg-green-50/50'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {totals.netGST >= 0 ? 'GST Payable' : 'GST Refundable'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.netGST >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {formatCurrency(Math.abs(totals.netGST))}
            </div>
            <p className="text-xs text-muted-foreground">
              {totals.netGST >= 0 ? 'Amount to pay to ATO' : 'Amount claimable from ATO'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* GST Collected Table */}
      <Card>
        <CardHeader>
          <CardTitle>GST Collected on Sales ({invoices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Ex GST</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No invoices in date range
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {invoices.slice(0, 20).map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link to={`/invoices/${inv.id}`} className="font-medium hover:underline">
                          {inv.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>{inv.client_name}</TableCell>
                      <TableCell>{format(new Date(inv.issue_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-right">{formatCurrency(inv.subtotal)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(inv.tax_total)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(inv.total)}</TableCell>
                    </TableRow>
                  ))}
                  {invoices.length > 20 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        ... and {invoices.length - 20} more invoices
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.salesExGST)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(totals.gstCollected)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.salesExGST + totals.gstCollected)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* GST Paid Table */}
      <Card>
        <CardHeader>
          <CardTitle>GST Paid on Purchases ({purchases.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Ex GST</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No purchases in date range
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {purchases.slice(0, 20).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="max-w-xs truncate">{p.description}</TableCell>
                      <TableCell>{p.vendor_name}</TableCell>
                      <TableCell>{format(new Date(p.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.amount)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(p.tax_amount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.total)}</TableCell>
                    </TableRow>
                  ))}
                  {purchases.length > 20 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        ... and {purchases.length - 20} more purchases
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.purchasesExGST)}</TableCell>
                    <TableCell className="text-right text-red-600">{formatCurrency(totals.gstPaid)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.purchasesExGST + totals.gstPaid)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
