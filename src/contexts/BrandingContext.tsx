import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BrandingSettings {
  appName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  companyName: string;
  currency: string;
  currencyLocale: string;
}

interface BrandingContextType {
  branding: BrandingSettings;
  isLoading: boolean;
  refetch: () => Promise<void>;
  formatCurrency: (amount: number) => string;
}

const defaultBranding: BrandingSettings = {
  appName: 'WorkFlow',
  logoUrl: null,
  faviconUrl: null,
  companyName: 'My Company',
  currency: 'AUD',
  currencyLocale: 'en-AU',
};

const BrandingContext = createContext<BrandingContextType>({
  branding: defaultBranding,
  isLoading: true,
  refetch: async () => {},
  formatCurrency: (amount: number) => amount.toFixed(2),
});

export const useBranding = () => useContext(BrandingContext);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBranding = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('app_name, logo_url, favicon_url, name, currency, currency_locale')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setBranding({
          appName: data.app_name || 'WorkFlow',
          logoUrl: data.logo_url,
          faviconUrl: data.favicon_url,
          companyName: data.name || 'My Company',
          currency: data.currency || 'AUD',
          currencyLocale: data.currency_locale || 'en-AU',
        });
      }
    } catch (error) {
      console.error('Error fetching branding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  // Update favicon dynamically
  useEffect(() => {
    if (branding.faviconUrl) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = branding.faviconUrl;
      }
    }
  }, [branding.faviconUrl]);

  // Update document title
  useEffect(() => {
    document.title = branding.appName;
  }, [branding.appName]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(branding.currencyLocale, {
      style: 'currency',
      currency: branding.currency,
    }).format(amount);
  };

  return (
    <BrandingContext.Provider value={{ branding, isLoading, refetch: fetchBranding, formatCurrency }}>
      {children}
    </BrandingContext.Provider>
  );
};