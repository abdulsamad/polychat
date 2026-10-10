import { useEffect } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes';

// Matches --background so the status bar blends into the nav.
const THEME_COLORS = { light: '#f4f6fb', dark: '#080d16' } as const;

// The theme is class-based, so the per-scheme theme-color metas follow the OS until we sync them.
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (resolvedTheme !== 'light' && resolvedTheme !== 'dark') return;

    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute('content', THEME_COLORS[resolvedTheme]));
  }, [resolvedTheme]);

  return null;
}

function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}

export default ThemeProvider;
