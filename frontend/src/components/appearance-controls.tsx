'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { applyTheme, getStoredTheme } from '@/lib/theme';
import { getStoredLanguage, storeLanguage, type Language, type Theme } from '@/lib/i18n';

export function AppearanceControls({ always = false }: { always?: boolean }) {
  const path = usePathname();
  const [theme, setTheme] = useState<Theme>('light');
  const [language, setLanguage] = useState<Language>('en');
  useEffect(() => {
    const storedTheme = getStoredTheme();
    setTheme(storedTheme);
    applyTheme(storedTheme);
    const storedLanguage = getStoredLanguage();
    setLanguage(storedLanguage);
    document.documentElement.lang = storedLanguage;
  }, []);
  if (!always && (path === '/' || path === '/planned')) return null;
  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);
  }
  return (
    <div className="global-appearance" aria-label="Appearance and language settings">
      <select
        value={language}
        aria-label="Language"
        onChange={(event) => {
          const next = event.target.value as Language;
          setLanguage(next);
          storeLanguage(next);
          document.documentElement.lang = next;
        }}
      >
        <option value="en">English</option>
        <option value="am">አማርኛ</option>
        <option value="om">Afaan Oromoo</option>
      </select>
      <button type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>
        {theme === 'light' ? '☀ Light' : '☾ Dark'}
      </button>
    </div>
  );
}
