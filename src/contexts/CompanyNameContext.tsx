import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

type CompanyNameContextValue = {
  companyName: string;
  setCompanyName: (name: string) => void;
  refreshCompanyName: () => Promise<void>;
  titleWithCompany: (base: string) => string;
};

const CompanyNameContext = createContext<CompanyNameContextValue | null>(null);

export function titleWithCompanyStatic(companyName: string, base: string): string {
  const c = (companyName || '').trim();
  return c ? `${c}${base}` : base;
}

export function CompanyNameProvider({ children }: { children: ReactNode }) {
  const [companyName, setCompanyNameState] = useState('');

  const refreshCompanyName = useCallback(async () => {
    try {
      const api = window.electronAPI as any;
      if (api?.settings?.getCompanyName) {
        const res = await api.settings.getCompanyName();
        setCompanyNameState((res?.company_name ?? '').trim());
      }
    } catch {
      setCompanyNameState('');
    }
  }, []);

  useEffect(() => {
    refreshCompanyName();
  }, [refreshCompanyName]);

  const setCompanyName = useCallback((name: string) => {
    setCompanyNameState((name || '').trim());
  }, []);

  const titleWithCompany = useCallback(
    (base: string) => titleWithCompanyStatic(companyName, base),
    [companyName]
  );

  return (
    <CompanyNameContext.Provider
      value={{
        companyName,
        setCompanyName,
        refreshCompanyName,
        titleWithCompany,
      }}
    >
      {children}
    </CompanyNameContext.Provider>
  );
}

export function useCompanyName(): CompanyNameContextValue {
  const ctx = useContext(CompanyNameContext);
  if (!ctx) {
    return {
      companyName: '',
      setCompanyName: () => {},
      refreshCompanyName: async () => {},
      titleWithCompany: (base: string) => base,
    };
  }
  return ctx;
}
