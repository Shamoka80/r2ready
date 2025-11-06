import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { registerServiceWorker, setupPWAInstall, setupOfflineSync } from "./utils/pwa";

// Initialize PWA functionality with better error handling
// Run in background without blocking app initialization
function initializePWA() {
  // Use setTimeout to ensure this runs after app initialization
  setTimeout(async () => {
    try {
      await registerServiceWorker();
      setupPWAInstall();
      setupOfflineSync();
      console.log('PWA initialized successfully');
    } catch (error) {
      console.warn('PWA setup failed, continuing without PWA features:', error);
      // Don't let PWA failures crash the app or affect user flow
    }
  }, 2000); // Delay 2 seconds to avoid interfering with critical app initialization
}

// Initialize PWA in the background after app loads
initializePWA();

// Add global error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  // Filter out Vite HMR ping failures (non-critical health checks in Replit environment)
  const reason = event.reason;
  const isVitePingFailure = reason?.message === 'Failed to fetch' && 
    (reason?.stack?.includes('@vite/client') || reason?.stack?.includes('ping'));
  
  if (isVitePingFailure) {
    // Silently handle Vite HMR ping failures - these are expected in Replit
    event.preventDefault();
    return;
  }
  
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault(); // Prevent browser default handling
});

createRoot(document.getElementById("root")!).render(<App />);
