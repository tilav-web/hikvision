import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/providers/query-provider';
import { router } from '@/routes/router';
import { useThemeStore } from '@/stores/theme-store';

function App() {
  const applyTheme = useThemeStore((s) => s.applyTheme);

  useEffect(() => {
    applyTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [applyTheme]);

  return (
    <QueryProvider>
      <RouterProvider router={router} />
      <Toaster richColors closeButton position="top-right" />
    </QueryProvider>
  );
}

export default App;
