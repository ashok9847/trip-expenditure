import { useEffect, useState } from 'react';

const query = () => window.matchMedia?.('(prefers-color-scheme: dark)');

/**
 * Applies the theme to <html>. `preference` null means follow the OS setting.
 * @param {'light'|'dark'|null} preference
 * @returns {boolean} whether dark mode is currently active
 */
export function useTheme(preference) {
  const [systemDark, setSystemDark] = useState(() => query()?.matches ?? false);

  useEffect(() => {
    const mq = query();
    if (!mq) return;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isDark = preference ? preference === 'dark' : systemDark;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#09090b' : '#fafafa');
  }, [isDark]);

  return isDark;
}
