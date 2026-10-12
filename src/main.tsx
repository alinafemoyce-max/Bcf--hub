import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './state/store';
import { RouterProvider } from './state/router';
import { NotifyProvider } from './components/notify';
import { ExportProvider } from './components/FileExport';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider>
      <NotifyProvider>
        <ExportProvider>
          <StoreProvider>
            <App />
          </StoreProvider>
        </ExportProvider>
      </NotifyProvider>
    </RouterProvider>
  </StrictMode>
);
