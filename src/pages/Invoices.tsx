import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, ChevronDown, Send, Download, Mail, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBranding } from '@/contexts/BrandingContext';
import { formatDisplayDate } from '@/lib/dates';
import { EmptyState } from '@/components/EmptyState';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'> & { clients?: { name: string; contact_email?: string; email?: string } | null };

const statusColors: Record<string, string> = {
  draft: 'secondary',
  sent: 'default',
  partially_paid: 'outline',
  paid: 'default',
  overdue: 'destructive',
  void: 'secondary',
  written_off: 'destructive',
};

const STATUS_FILTER_ORDER = ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void', 'written_off'];

function humanizeStatus(status: string) {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { formatCurrency } = useBranding();

  useEffect(() => {
    fetchInvoices();
  }, []);

  async function fetchInvoices() {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, clients(name, contact_email, email)')
      .order('issue_date', { ascending: false });
    
    if (error) {
      console.error('Error fetching invoices:', error);
    } else {
      setInvoices(data || []);
    }
    setLoading(false);
  }

  const statusCounts = STATUS_FILTER_ORDER.reduce<Record<string, number>>((acc, status) => {
    acc[status] = invoices.filter(inv => inv.status === status).length;
    return acc;
  }, {});

  const filteredInvoices = invoices.filter(inv =>
    (statusFilter === 'all' || inv.status === statusFilter) &&
    (inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    inv.clients?.name?.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map(inv => inv.id)));
    }
  };

  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
  }

  const selectedInvoices = filteredInvoices.filter(inv => selectedIds.has(inv.id));
  const selectedDrafts = selectedInvoices.filter(inv => inv.status === 'draft');
  const selectedNonDrafts = selectedInvoices.filter(inv => inv.status !== 'draft' && inv.status !== 'void' && inv.status !== 'written_off');

  async function handleBulkStatusUpdate(newStatus: string) {
    if (selectedDrafts.length === 0) {
      toast({ title: 'Info', description: 'Only draft invoices can have their status changed in bulk.' });
      return;
    }

    const draftIds = selectedDrafts.map(inv => inv.id);
    
    const { error } = await supabase
      .from('invoices')
      .update({ status: newStatus as any })
      .in('id', draftIds);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `${draftIds.length} invoice(s) updated to ${newStatus}` });
      setSelectedIds(new Set());
      fetchInvoices();
    }
  }

  async function handleBulkDownload() {
    if (selectedInvoices.length === 0) {
      toast({ title: 'Info', description: 'Select invoices to download.' });
      return;
    }

    toast({ title: 'Generating PDFs...', description: `Downloading ${selectedInvoices.length} invoice(s)` });

    for (const inv of selectedInvoices) {
      try {
        const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
          body: { invoiceId: inv.id }
        });
        
        if (error) throw error;
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(data.html);
          printWindow.document.close();
          printWindow.onload = () => {
            printWindow.print();
          };
        }
      } catch (error: any) {
        toast({ title: 'Error', description: `Failed to generate PDF for ${inv.invoice_number}: ${error.message}`, variant: 'destructive' });
      }
    }
  }

  async function handleBulkSend() {
    if (selectedNonDrafts.length === 0 && selectedDrafts.length > 0) {
      toast({ title: 'Info', description: 'Draft invoices must be marked as Sent first before emailing.' });
      return;
    }
    
    if (selectedInvoices.length === 0) {
      toast({ title: 'Info', description: 'Select invoices to send.' });
      return;
    }

    toast({ title: 'Sending emails...', description: `Sending ${selectedNonDrafts.length} invoice(s)` });

    let successCount = 0;
    let errorCount = 0;

    for (const inv of selectedNonDrafts) {
      try {
        // Get client contact email
        const clientEmail = inv.clients?.contact_email || inv.clients?.email;
        if (!clientEmail) {
          errorCount++;
          toast({ 
            title: 'Warning', 
            description: `No email for client on invoice ${inv.invoice_number}`, 
            variant: 'destructive' 
          });
          continue;
        }

        const response = await fetch(`${import.meta.env.VITE_API_URL}/mail/send-invoice`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({ 
            invoiceId: inv.id,
            recipientEmail: clientEmail
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to send');
        }

        successCount++;
      } catch (error: any) {
        errorCount++;
        toast({ 
          title: 'Error', 
          description: `Failed to send ${inv.invoice_number}: ${error.message}`, 
          variant: 'destructive' 
        });
      }
    }

    if (successCount > 0) {
      toast({ 
        title: 'Success', 
        description: `Sent ${successCount} invoice(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}` 
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">Create and manage invoices</p>
        </div>
        <Button asChild>
          <Link to="/invoices/new">
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search invoices..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Send className="h-4 w-4 mr-2" />
                  Update Status
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleBulkStatusUpdate('sent')}>
                  Mark as Sent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkStatusUpdate('void')}>
                  Mark as Void
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" onClick={handleBulkDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download PDFs
            </Button>

            <Button variant="outline" size="sm" onClick={handleBulkSend}>
              <Mail className="h-4 w-4 mr-2" />
              Send Emails
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
        >
          All ({invoices.length})
        </Button>
        {STATUS_FILTER_ORDER.filter(status => statusCounts[status] > 0).map(status => (
          <Button
            key={status}
            variant={statusFilter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(status)}
          >
            {humanizeStatus(status)} ({statusCounts[status]})
          </Button>
        ))}
      </div>

      {loading ? (
        <>
          {/* table (desktop) */}
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* cards (mobile) */}
          <div className="space-y-3 md:hidden">
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          </div>
        </>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Create your first invoice to start billing clients."
          action={
            <Button asChild>
              <Link to="/invoices/new">
                <Plus className="h-4 w-4 mr-2" />
                New Invoice
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* table (desktop) */}
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <p className="text-muted-foreground">
                        {search ? `No matches for "${search}"` : 'No matches for the current filters'}
                      </p>
                      <Button variant="ghost" size="sm" className="mt-2" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(invoice.id)}
                          onCheckedChange={() => toggleSelect(invoice.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/invoices/${invoice.id}`}
                          className="font-medium hover:underline"
                        >
                          {invoice.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>{invoice.clients?.name || '-'}</TableCell>
                      <TableCell>{formatDisplayDate(invoice.issue_date)}</TableCell>
                      <TableCell>{formatDisplayDate(invoice.due_date)}</TableCell>
                      <TableCell>{formatCurrency(invoice.total)}</TableCell>
                      <TableCell>{formatCurrency(invoice.amount_paid)}</TableCell>
                      <TableCell>
                        <Badge variant={statusColors[invoice.status] as any || 'secondary'}>
                          {invoice.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* cards (mobile) */}
          <div className="space-y-3 md:hidden">
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {search ? `No matches for "${search}"` : 'No matches for the current filters'}
                </p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            ) : (
              filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-start gap-3 rounded-lg border bg-card p-4">
                  <Checkbox
                    className="mt-1"
                    checked={selectedIds.has(invoice.id)}
                    onCheckedChange={() => toggleSelect(invoice.id)}
                  />
                  <Link
                    to={`/invoices/${invoice.id}`}
                    className="block flex-1 min-w-0 transition-colors active:opacity-70"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{invoice.invoice_number}</span>
                      <Badge variant={statusColors[invoice.status] as any || 'secondary'}>
                        {invoice.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{invoice.clients?.name || '-'}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {formatDisplayDate(invoice.issue_date)} – {formatDisplayDate(invoice.due_date)}
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Paid {formatCurrency(invoice.amount_paid)}</span>
                      <span className="font-semibold">{formatCurrency(invoice.total)}</span>
                    </div>
                  </Link>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
