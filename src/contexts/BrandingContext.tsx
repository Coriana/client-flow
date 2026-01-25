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
        // Validate currency locale - must be a valid locale string like 'en-AU'
        let currencyLocale = data.currency_locale || 'en-AU';
        if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(currencyLocale)) {
          console.warn(`Invalid currency_locale "${currencyLocale}", using default "en-AU"`);
          currencyLocale = 'en-AU';
        }

        // Validate currency code - must be a 3-letter code
        let currency = data.currency || 'AUD';
        if (!/^[A-Z]{3}$/.test(currency)) {
          console.warn(`Invalid currency "${currency}", using default "AUD"`);
          currency = 'AUD';
        }

        setBranding({
          appName: data.app_name || 'WorkFlow',
          logoUrl: data.logo_url,
          faviconUrl: data.favicon_url,
          companyName: data.name || 'My Company',
          currency,
          currencyLocale,
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
    try {
      return new Intl.NumberFormat(branding.currencyLocale, {
        style: 'currency',
        currency: branding.currency,
      }).format(amount);
    } catch (error) {
      console.warn('Currency formatting error, using fallback:', error);
      return `$${amount.toFixed(2)}`;
    }
  };

  return (
    <BrandingContext.Provider value={{ branding, isLoading, refetch: fetchBranding, formatCurrency }}>
      {children}
    </BrandingContext.Provider>
  );
};