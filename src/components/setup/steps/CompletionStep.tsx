import { Button } from '@/components/ui/button';
import { CheckCircle2, Users, Briefcase, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { WizardData } from '../SetupWizard';

interface CompletionStepProps {
  wizardData: WizardData;
  onComplete: () => void;
}

export function CompletionStep({ wizardData, onComplete }: CompletionStepProps) {
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    onComplete();
    navigate(path);
  };

  const completedItems = [
    { label: 'Company', value: wizardData.company.name, show: !!wizardData.company.name },
    { label: 'Trading as', value: wizardData.tradingName.name, show: !!wizardData.tradingName.name },
    { label: 'Tax rate', value: `${wizardData.taxRate.name} (${wizardData.taxRate.rate}%)`, show: !!wizardData.taxRate.name },
    { label: 'Bank account', value: wizardData.bankAccount.name, show: !!wizardData.bankAccount.name },
    { label: 'Invoice format', value: `${wizardData.invoice.prefix}-${String(wizardData.invoice.nextNumber).padStart(4, '0')}`, show: !!wizardData.invoice.prefix },
  ].filter(item => item.show);

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold text-foreground">You're all set!</h3>
        <p className="text-muted-foreground mt-1">Your business is configured and ready to go.</p>
      </div>

      {completedItems.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-4 text-left">
          <ul className="space-y-2">
            {completedItems.map((item, index) => (
              <li key={index} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-muted-foreground">{item.label}:</span>
                <span className="font-medium text-foreground">{item.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3 pt-4">
        <p className="text-sm text-muted-foreground">What would you like to do next?</p>
        
        <div className="flex flex-col gap-2">
          <Button
            variant="default"
            className="w-full justify-start"
            onClick={() => handleNavigate('/clients/new')}
          >
            <Users className="h-4 w-4 mr-2" />
            Add Your First Client
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleNavigate('/jobs/new')}
          >
            <Briefcase className="h-4 w-4 mr-2" />
            Create a Job
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => handleNavigate('/')}
          >
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
