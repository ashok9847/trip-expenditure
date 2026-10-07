import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './index.css';
import App from './components/App.jsx';
import { AppStateProvider } from './hooks/useAppState.jsx';
import { ToastProvider } from './hooks/useToast.jsx';
import { CloudProvider } from './cloud/CloudProvider.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppStateProvider>
      <ToastProvider>
        <CloudProvider>
          <App />
        </CloudProvider>
      </ToastProvider>
    </AppStateProvider>
  </StrictMode>,
);
