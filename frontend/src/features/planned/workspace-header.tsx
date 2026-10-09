import { Icon } from '@/components/icon';
import type { Account } from '@/lib/auth';
import type { Language, Theme } from '@/lib/i18n';
export function WorkspaceHeader({
  account,
  language,
  theme,
  setLanguage,
  toggleTheme,
  openAccount,
  signIn,
}: {
  account: Account | null;
  language: Language;
  theme: Theme;
  setLanguage: (language: Language) => void;
  toggleTheme: () => void;
  openAccount: () => void;
  signIn: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-slogan">
          <Icon name="sun" size={16} /> Wherever you’re going, <em>go together.</em>
        </span>
      </div>
      <div className="topbar-right planned-toolbar">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          aria-label="Select Language"
        >
          <option value="en">English</option>
          <option value="am">አማርኛ</option>
          <option value="om">Afaan Oromoo</option>
        </select>
        <button
          type="button"
          className="secondary"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? '☀ Light' : '☾ Dark'}
        </button>
        {account ? (
          <button className="secondary" onClick={openAccount} aria-label="Account details">
            {account.name}
          </button>
        ) : (
          <button className="primary" onClick={signIn}>
            Sign In / Sign Up
          </button>
        )}
      </div>
    </header>
  );
}
