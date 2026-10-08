export type Theme = 'light' | 'dark';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return (localStorage.getItem('zew_theme') as Theme) || 'light';
}

export function applyTheme(theme: Theme) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('zew_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    document.documentElement.classList.add('dark-theme');
    document.documentElement.classList.remove('light-theme');
    document.body.style.backgroundColor = '#0f172a';
    document.body.style.color = '#f8fafc';
  } else {
    document.documentElement.classList.add('light-theme');
    document.documentElement.classList.remove('dark-theme');
    document.body.style.backgroundColor = '#f8faf6';
    document.body.style.color = '#0f392b';
  }
}
