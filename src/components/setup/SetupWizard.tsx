import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CompanyStep } from './steps/CompanyStep';
import { TradingNameStep } from './steps/TradingNameStep';
import { TaxRateStep } from './steps/TaxRateStep';
import { BankAccountStep } from './steps/BankAccountStep';
import { InvoiceStep } from './steps/InvoiceStep';
import { CompletionStep } from './steps/CompletionStep';

interface SetupWizardProps {
  onComplete: () => void;
}

export interface WizardData {
  company: {
    name: string;
    abn: string;
    address: string;
    email: string;
    phone: string;
    currency: string;
    currencyLocale: string;
  };
  tradingName: {
    name: string;
    bankAccountName: string;
    bsb: string;
    accountNumber: string;
    paypalEmail: string;
  };
  taxRate: {
    name: string;
    rate: number;
  };
  bankAccount: {
    name: string;
    bankName: string;
    bsb: string;
    accountNumber: string;
    openingBalance: number;
    openingBalanceDate: string;
  };
  invoice: {
    prefix: string;
    nextNumber: number;
    paymentTerms: number;
  };
}

const STEPS = [
  { id: 1, title: 'Company Details', description: 'Tell us about your business' },
  { id: 2, title: 'Trading Name', description: 'How you appear on invoices' },
  { id: 3, title: 'Tax Setup', description: 'Configure your tax rates' },
  { id: 4, title: 'Bank Account', description: 'Where you receive payments' },
  { id: 5, title: 'Invoice Settings', description: 'Customize your invoices' },
];

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isOpen, setIsOpen] = useState(true);
  const [wizardData, setWizardData] = useState<WizardData>({
    company: { name: '', abn: '', address: '', email: '', phone: '', currency: 'AUD', currencyLocale: 'en-AU' },
    tradingName: { name: '', bankAccountName: '', bsb: '', accountNumber: '', paypalEmail: '' },
    taxRate: { name: 'GST', rate: 10 },
    bankAccount: { name: '', bankName: '', bsb: '', accountNumber: '', openingBalance: 0, openingBalanceDate: '' },
    invoice: { prefix: 'INV', nextNumber: 1, paymentTerms: 30 },
  });

  const progress = (currentStep / (STEPS.length + 1)) * 100;

  const handleNext = () => {
    if (currentStep <= STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsOpen(false);
    onComplete();
  };

  const updateData = <K extends keyof WizardData>(step: K, data: Partial<WizardData[K]>) => {
    setWizardData(prev => ({
      ...prev,
      [step]: { ...prev[step], ...data },
    }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <CompanyStep
            data={wizardData.company}
            onUpdate={(data) => updateData('company', data)}
            onNext={handleNext}
          />
        );
      case 2:
        return (
          <TradingNameStep
            data={wizardData.tradingName}
            onUpdate={(data) => updateData('tradingName', data)}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <TaxRateStep
            data={wizardData.taxRate}
            onUpdate={(data) => updateData('taxRate', data)}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <BankAccountStep
            data={wizardData.bankAccount}
            onUpdate={(data) => updateData('bankAccount', data)}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <InvoiceStep
            data={wizardData.invoice}
            onUpdate={(data) => updateData('invoice', data)}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 6:
        return (
          <CompletionStep
            wizardData={wizardData}
            onComplete={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-[600px] p-0 gap-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <h2 className="text-2xl font-bold text-foreground">
            {currentStep <= STEPS.length ? 'Welcome to WorkFlow!' : 'Setup Complete'}
          </h2>
          <p className="text-muted-foreground mt-1">
            {currentStep <= STEPS.length 
              ? "Let's set up your business in just a few steps"
              : "You're ready to start using the app"
            }
          </p>
          
          {/* Progress */}
          {currentStep <= STEPS.length && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Step {currentStep} of {STEPS.length}</span>
                <span>{STEPS[currentStep - 1]?.title}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>

        {/* Step Indicators */}
        {currentStep <= STEPS.length && (
          <div className="px-6 py-3 border-b bg-background">
            <div className="flex justify-between">
              {STEPS.map((step) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-2 ${
                    step.id === currentStep
                      ? 'text-primary'
                      : step.id < currentStep
                      ? 'text-primary/60'
                      : 'text-muted-foreground'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      step.id === currentStep
                        ? 'bg-primary text-primary-foreground'
                        : step.id < currentStep
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {step.id < currentStep ? '✓' : step.id}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-6 min-h-[300px]">
          {renderStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
