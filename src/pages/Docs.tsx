import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, BookOpen, Rocket, HelpCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface DocSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  articles: { id: string; title: string; content: string }[];
}

const docSections: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: <Rocket className="h-4 w-4" />,
    articles: [
      {
        id: 'welcome',
        title: 'Welcome & Dashboard Overview',
        content: `Welcome to WorkFlow! Your dashboard provides a quick overview of your business at a glance.

**Key Dashboard Elements:**
- **Revenue metrics** - Track monthly income and outstanding invoices
- **Recent activity** - See latest jobs, invoices, and payments
- **Quick actions** - Create new clients, jobs, or invoices with one click

**Getting oriented:**
1. Use the sidebar to navigate between modules
2. Click on any card to drill down into details
3. Use the search bar to find specific records`,
      },
      {
        id: 'company-setup',
        title: 'Setting Up Your Company',
        content: `Before you start, configure your company details in Settings.

**Essential Settings:**
1. **Company Tab** - Enter your business name, ABN, address, and contact details
2. **Trading Names** - Add different trading names if you operate under multiple brands
3. **Tax Rates** - Configure GST and any other tax rates you use
4. **Invoicing** - Set your invoice prefix, numbering, and default payment terms
5. **Branding** - Upload your logo and customize the app name

**Pro tip:** Complete your company setup first - this information appears on all your invoices.`,
      },
      {
        id: 'first-client',
        title: 'Adding Your First Client',
        content: `Clients are the foundation of your workflow.

**To add a client:**
1. Go to **Clients** in the sidebar
2. Click **New Client**
3. Fill in the client details:
   - Business name (required)
   - Trading name (if different)
   - ABN/ACN
   - Contact information
   - Billing address
4. Click **Save**

**Client features:**
- Add contacts, or link an existing person if they've moved from another client or vendor
- Set custom payment terms
- View all jobs and invoices for each client
- Track client history and notes`,
      },
      {
        id: 'first-job',
        title: 'Creating Your First Job',
        content: `Jobs help you track work and billable time.

**To create a job:**
1. Go to **Jobs** in the sidebar
2. Click **New Job**
3. Select the client
4. Enter job details:
   - Job name and description
   - Start/end dates
   - Budget (optional)
   - Hourly rate
5. Click **Save**

**Job statuses:**
- **Prospect** - Potential work, not yet confirmed
- **Active** - Currently in progress
- **On Hold** - Temporarily paused
- **Completed** - Finished work
- **Cancelled** - Work cancelled`,
      },
      {
        id: 'first-invoice',
        title: 'Generating Your First Invoice',
        content: `Create professional invoices in seconds.

**To create an invoice:**
1. Go to **Invoices** in the sidebar
2. Click **New Invoice**
3. Select the client (and optionally a job)
4. Add line items:
   - Description
   - Quantity and unit price
   - Tax rate
5. Review totals and click **Save**

**Invoice actions:**
- **Download PDF** - Get a printable version
- **Record Payment** - Mark partial or full payment
- **Send** - Email to client (coming soon)

**Tip:** Use recurring jobs for regular billing.`,
      },
    ],
  },
  {
    id: 'features',
    title: 'Feature Guides',
    icon: <BookOpen className="h-4 w-4" />,
    articles: [
      {
        id: 'clients',
        title: 'Clients',
        content: `Manage all your client relationships in one place.

**Client Management:**
- View all clients in a searchable list
- Filter by active/inactive status
- Click any client to see full details

**Client Details Page:**
- **Overview** - Contact info, ABN, payment terms
- **Contacts** - People affiliated with this client. Contacts can move between clients and vendors over time, and ending an affiliation keeps their history — find everyone under **Contacts** in the sidebar.
- **Jobs** - All work for this client
- **Invoices** - Billing history
- **History** - Audit trail of changes

**Bulk Actions:**
- Export client list
- Mark clients as inactive`,
      },
      {
        id: 'jobs',
        title: 'Jobs & Time Tracking',
        content: `Track all your projects and billable work.

**Job Features:**
- Assign team members to jobs
- Set budgets and track spending
- Link expenses and timesheets
- Generate invoices from job data

**Recurring Jobs:**
For regular services, enable recurring billing:
1. Toggle "Recurring" on the job
2. Set the billing frequency and rate
3. The system will remind you when invoices are due

**Job Tags:**
Use tags to categorize and filter jobs (e.g., "Website", "Support", "Consulting").`,
      },
      {
        id: 'invoicing',
        title: 'Invoicing & Payments',
        content: `Professional invoicing with flexible payment tracking.

**Invoice Statuses:**
- **Draft** - Not yet sent, can be edited
- **Sent** - Delivered to client
- **Partial** - Some payment received
- **Paid** - Fully paid
- **Overdue** - Past due date
- **Cancelled** - Voided invoice

**Recording Payments:**
1. Open the invoice
2. Click "Record Payment"
3. Enter amount, date, and method
4. Payment is applied automatically

**Payment Methods:**
Track payments by method (Bank Transfer, Cash, Card, etc.) for reconciliation.`,
      },
      {
        id: 'banking',
        title: 'Banking & Reconciliation',
        content: `Connect and reconcile your bank accounts.

**Bank Account Setup:**
1. Go to **Banking** in the sidebar
2. Click **Add Account**
3. Enter account details (name, BSB, account number)
4. Set opening balance

**Importing Transactions:**
1. Download CSV/OFX from your bank
2. Click "Import" on the account
3. Review and confirm transactions

**Reconciliation:**
Match bank transactions to invoices and payments to ensure your records are accurate.`,
      },
      {
        id: 'inventory',
        title: 'Inventory Management',
        content: `Track stock levels and product pricing.

**Adding Items:**
1. Go to **Inventory** in the sidebar
2. Click **New Item**
3. Enter SKU, name, and pricing
4. Set stock levels and reorder points

**Stock Movements:**
- Purchases increase stock
- Sales/usage decreases stock
- View movement history per item

**Low Stock Alerts:**
Items below reorder level are highlighted for reordering.`,
      },
      {
        id: 'assets',
        title: 'Asset Tracking',
        content: `Manage equipment, tools, and rentable assets.

**Asset Features:**
- Track serial numbers and tags
- Record purchase cost and warranty
- Assign to clients or jobs
- Schedule maintenance
- Manage firmware versions

**Rental Assets:**
For equipment you rent out:
1. Mark asset as "Rental"
2. Set monthly rate
3. Assign to a job for billing
4. Track rental history`,
      },
      {
        id: 'issues',
        title: 'Issue Management',
        content: `Track problems, tickets, and support requests.

**Creating Issues:**
1. Go to **Issues** in the sidebar
2. Click **New Issue**
3. Enter title and description
4. Set severity (Low, Medium, High, Critical)
5. Link to client, job, or asset

**Issue Workflow:**
- **Open** - New issue, needs attention
- **In Progress** - Being worked on
- **Resolved** - Fixed, pending verification
- **Closed** - Completed

**Bookmarks & Resolutions:**
Save important solutions as bookmarks to reference across issues.`,
      },
      {
        id: 'knowledge-base',
        title: 'Knowledge Base',
        content: `Build your internal documentation library.

**Creating Articles:**
1. Go to **Knowledge Base** in the sidebar
2. Click **New Article**
3. Write content with rich formatting
4. Add tags and categories
5. Attach files (images, PDFs)

**Linking to Issues:**
Connect KB articles to issues at different stages:
- Diagnosis - What helped identify the problem
- Procedure - Steps taken to fix it
- Resolution - Final solution

Track which articles successfully resolve issues.`,
      },
      {
        id: 'reports',
        title: 'Reports',
        content: `Gain insights with built-in reports.

**Available Reports:**
- **Profit & Loss** - Income vs expenses
- **Revenue by Client** - Who pays the most
- **Aged Receivables** - Outstanding invoices
- **Job Profitability** - Margin per job
- **Time by Job** - Hours worked
- **GST Summary** - Tax collected/paid
- **Inventory Valuation** - Stock worth
- **Asset Register** - All assets

**Filtering:**
Most reports support date ranges and additional filters.`,
      },
      {
        id: 'team',
        title: 'Team & Permissions',
        content: `Manage users and access control.

**Adding Team Members:**
1. Go to **Team** in the sidebar
2. Click **Invite Member**
3. Enter their email
4. Assign a role

**Roles & Permissions:**
Define what each role can access:
- **View** - Read-only access
- **Edit** - Create and modify records
- **Admin** - Full access including settings

**Custom Roles:**
Create roles tailored to your workflow (e.g., "Accountant" with access only to invoices and banking).`,
      },
    ],
  },
  {
    id: 'faq',
    title: 'FAQ',
    icon: <HelpCircle className="h-4 w-4" />,
    articles: [
      {
        id: 'reset-password',
        title: 'How do I reset my password?',
        content: `If you've forgotten your password:

1. Go to the login page
2. Click "Forgot password?"
3. Enter your email address
4. Check your inbox for a reset link
5. Click the link and enter a new password

**Note:** The reset link expires after 1 hour. If it expires, request a new one.

If you're already logged in and want to change your password, this feature is coming soon to Settings.`,
      },
      {
        id: 'add-team',
        title: 'How do I add team members?',
        content: `To add team members:

1. Go to **Team** in the sidebar
2. Click **Invite Member**
3. Enter their email address
4. Select their role (determines permissions)
5. Click **Send Invite**

The new member will receive an email to set up their account.

**Permissions:**
Team members can only see what their role allows. Configure roles in **Roles** settings.`,
      },
      {
        id: 'export-data',
        title: 'How do I export data?',
        content: `You can export data from most list pages:

**Exporting:**
1. Go to the list (Clients, Jobs, Invoices, etc.)
2. Apply any filters you want
3. Click the **Export** button
4. Choose format (CSV or PDF)

**Available Exports:**
- Client list
- Job list
- Invoice list
- Payment history
- Inventory items
- Asset register

**Reports:**
Reports can also be exported to PDF for sharing.`,
      },
      {
        id: 'invoice-numbering',
        title: 'How do I change invoice numbering?',
        content: `To customize invoice numbers:

1. Go to **Settings**
2. Click the **Invoicing** tab
3. Update:
   - **Prefix** - Text before the number (e.g., "INV-")
   - **Next Number** - The next invoice number to use

**Example:**
With prefix "INV-" and next number 1001, your next invoice will be "INV-1001".

**Note:** You can only increase the next number, not decrease it, to prevent duplicate invoice numbers.`,
      },
      {
        id: 'trading-names',
        title: 'How do I set up multiple trading names?',
        content: `If your business operates under multiple names:

1. Go to **Settings**
2. Click the **Trading Names** tab
3. Click **Add Trading Name**
4. Enter the name and bank details
5. Set one as default

**Using Trading Names:**
- Assign trading names to jobs
- Invoices show the trading name's details
- Bank details appear on printed invoices

**Per-Name Banking:**
Each trading name can have its own BSB, account number, and PayPal address for receiving payments.`,
      },
      {
        id: 'locations',
        title: 'How do I manage multiple locations?',
        content: `For businesses with multiple sites:

1. Go to **Locations** in the sidebar
2. Click **New Location**
3. Enter address and contact details
4. Add location-specific contacts

**Using Locations:**
- Assign clients to locations
- Assign jobs to locations
- Assign assets to locations
- Filter lists by location

Locations help you organize work geographically.`,
      },
    ],
  },
];

export default function Docs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<{
    sectionId: string;
    articleId: string;
  } | null>(null);

  const filteredSections = docSections
    .map((section) => ({
      ...section,
      articles: section.articles.filter(
        (article) =>
          article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          article.content.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((section) => section.articles.length > 0);

  const currentArticle = selectedArticle
    ? docSections
        .find((s) => s.id === selectedArticle.sectionId)
        ?.articles.find((a) => a.id === selectedArticle.articleId)
    : null;

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-8">
      {/* Sidebar */}
      <div className="w-72 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold mb-3">Help & Documentation</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            <Accordion type="multiple" defaultValue={['getting-started', 'features', 'faq']}>
              {filteredSections.map((section) => (
                <AccordionItem key={section.id} value={section.id} className="border-none">
                  <AccordionTrigger className="py-2 px-2 hover:bg-muted rounded-md hover:no-underline">
                    <div className="flex items-center gap-2">
                      {section.icon}
                      <span className="text-sm font-medium">{section.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                    <div className="ml-6 space-y-1">
                      {section.articles.map((article) => (
                        <button
                          key={article.id}
                          onClick={() =>
                            setSelectedArticle({
                              sectionId: section.id,
                              articleId: article.id,
                            })
                          }
                          className={cn(
                            'w-full text-left text-sm py-1.5 px-2 rounded-md transition-colors',
                            selectedArticle?.articleId === article.id
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          )}
                        >
                          {article.title}
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </ScrollArea>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {currentArticle ? (
          <div className="max-w-3xl mx-auto p-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <span>
                {docSections.find((s) => s.id === selectedArticle?.sectionId)?.title}
              </span>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground">{currentArticle.title}</span>
            </div>
            <h1 className="text-2xl font-bold mb-6">{currentArticle.title}</h1>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {currentArticle.content.split('\n\n').map((paragraph, idx) => {
                if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                  return (
                    <h3 key={idx} className="text-lg font-semibold mt-6 mb-3">
                      {paragraph.slice(2, -2)}
                    </h3>
                  );
                }
                if (paragraph.startsWith('- ')) {
                  const items = paragraph.split('\n').filter((l) => l.startsWith('- '));
                  return (
                    <ul key={idx} className="list-disc pl-5 space-y-1">
                      {items.map((item, i) => (
                        <li key={i} dangerouslySetInnerHTML={{ __html: formatText(item.slice(2)) }} />
                      ))}
                    </ul>
                  );
                }
                if (/^\d+\. /.test(paragraph)) {
                  const items = paragraph.split('\n').filter((l) => /^\d+\. /.test(l));
                  return (
                    <ol key={idx} className="list-decimal pl-5 space-y-1">
                      {items.map((item, i) => (
                        <li key={i} dangerouslySetInnerHTML={{ __html: formatText(item.replace(/^\d+\. /, '')) }} />
                      ))}
                    </ol>
                  );
                }
                return (
                  <p key={idx} className="mb-4" dangerouslySetInnerHTML={{ __html: formatText(paragraph) }} />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Welcome to the Help Center</h2>
            <p className="text-muted-foreground max-w-md">
              Select a topic from the sidebar to get started, or use the search bar to find
              what you're looking for.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>');
}
