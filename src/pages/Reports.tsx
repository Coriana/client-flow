import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DollarSign, 
  Briefcase, 
  Clock, 
  Users, 
  FileText, 
  Package, 
  HardDrive,
  TrendingUp,
  Boxes,
  Landmark,
  BarChart3,
  Building2,
  Receipt
} from 'lucide-react';
import ProfitLossReport from '@/components/reports/ProfitLossReport';
import JobProfitLossReport from '@/components/reports/JobProfitLossReport';
import AgedReceivablesReport from '@/components/reports/AgedReceivablesReport';
import RevenueByClientReport from '@/components/reports/RevenueByClientReport';
import InvoiceSummaryReport from '@/components/reports/InvoiceSummaryReport';
import TimeByJobReport from '@/components/reports/TimeByJobReport';
import InventoryValuationReport from '@/components/reports/InventoryValuationReport';
import AssetRegisterReport from '@/components/reports/AssetRegisterReport';
import BankReconciliationReport from '@/components/reports/BankReconciliationReport';
import VendorSpendReport from '@/components/reports/VendorSpendReport';
import GSTSummaryReport from '@/components/reports/GSTSummaryReport';

interface ReportCard {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}

const reports: ReportCard[] = [
  // Financial
  { id: 'pl', name: 'Profit & Loss', description: 'Income, expenses, purchases, and net profit for a date range', icon: <DollarSign className="h-5 w-5" />, category: 'financial' },
  { id: 'jobpl', name: 'Job Profitability', description: 'Revenue vs costs breakdown by job with drill-down', icon: <Briefcase className="h-5 w-5" />, category: 'financial' },
  { id: 'ar', name: 'Aged Receivables', description: 'Outstanding invoices grouped by age', icon: <Clock className="h-5 w-5" />, category: 'financial' },
  { id: 'vendor-spend', name: 'Spending by Vendor', description: 'Total purchases breakdown by vendor', icon: <Building2 className="h-5 w-5" />, category: 'financial' },
  { id: 'gst-summary', name: 'GST Summary', description: 'GST collected vs paid for BAS preparation', icon: <Receipt className="h-5 w-5" />, category: 'financial' },
  // Sales
  { id: 'revenue-client', name: 'Revenue by Client', description: 'Total revenue breakdown by client', icon: <Users className="h-5 w-5" />, category: 'sales' },
  { id: 'invoice-summary', name: 'Invoice Summary', description: 'All invoices with status and payment details', icon: <FileText className="h-5 w-5" />, category: 'sales' },
  // Operations
  { id: 'time-job', name: 'Time by Job', description: 'Billable and non-billable hours per job', icon: <BarChart3 className="h-5 w-5" />, category: 'operations' },
  // Inventory
  { id: 'inventory-valuation', name: 'Inventory Valuation', description: 'Current stock levels and total value', icon: <Boxes className="h-5 w-5" />, category: 'inventory' },
  // Assets
  { id: 'asset-register', name: 'Asset Register', description: 'Complete list of assets with depreciation', icon: <HardDrive className="h-5 w-5" />, category: 'assets' },
  // Banking
  { id: 'bank-reconciliation', name: 'Bank Reconciliation', description: 'Reconciled vs unreconciled transactions and cash flow', icon: <Landmark className="h-5 w-5" />, category: 'banking' },
];

const categories = [
  { id: 'financial', name: 'Financial', icon: <Landmark className="h-4 w-4" /> },
  { id: 'sales', name: 'Sales', icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'operations', name: 'Operations', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'inventory', name: 'Inventory', icon: <Package className="h-4 w-4" /> },
  { id: 'assets', name: 'Assets', icon: <HardDrive className="h-4 w-4" /> },
  { id: 'banking', name: 'Banking', icon: <Landmark className="h-4 w-4" /> },
];

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const renderReport = () => {
    switch (selectedReport) {
      case 'pl':
        return <ProfitLossReport />;
      case 'jobpl':
        return <JobProfitLossReport />;
      case 'ar':
        return <AgedReceivablesReport />;
      case 'revenue-client':
        return <RevenueByClientReport />;
      case 'invoice-summary':
        return <InvoiceSummaryReport />;
      case 'time-job':
        return <TimeByJobReport />;
      case 'inventory-valuation':
        return <InventoryValuationReport />;
      case 'asset-register':
        return <AssetRegisterReport />;
      case 'bank-reconciliation':
        return <BankReconciliationReport />;
      case 'vendor-spend':
        return <VendorSpendReport />;
      case 'gst-summary':
        return <GSTSummaryReport />;
      default:
        return null;
    }
  };

  if (selectedReport) {
    const report = reports.find(r => r.id === selectedReport);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSelectedReport(null)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Reports
          </button>
        </div>
        <div>
          <h1 className="text-3xl font-bold">{report?.name}</h1>
          <p className="text-muted-foreground">{report?.description}</p>
        </div>
        {renderReport()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Generate financial and operational reports</p>
      </div>

      {categories.map(category => {
        const categoryReports = reports.filter(r => r.category === category.id);
        if (categoryReports.length === 0) return null;
        
        return (
          <div key={category.id} className="space-y-4">
            <div className="flex items-center gap-2">
              {category.icon}
              <h2 className="text-xl font-semibold">{category.name}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryReports.map(report => (
                <Card 
                  key={report.id} 
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setSelectedReport(report.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-primary/10 text-primary">
                        {report.icon}
                      </div>
                      <CardTitle className="text-lg">{report.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{report.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
