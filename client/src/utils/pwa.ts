// PWA Service Worker Registration and Management

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let isInstalled = false;

// Register service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service workers not supported');
    return null;
  }

  try {
    // Check if service worker file exists before registering
    const swResponse = await fetch('/sw.js', { method: 'HEAD' }).catch(() => null);
    if (!swResponse || !swResponse.ok) {
      console.log('Service worker file not found, skipping registration');
      return null;
    }

    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    console.log('Service worker registered successfully:', registration);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            console.log('New service worker available');
            showUpdateNotification();
          }
        });
      }
    });

    return registration;
  } catch (error) {
    // Service worker is an enhancement, not critical functionality
    // Log minimal info in development, suppress in production unless explicitly debugging
    console.log('PWA features unavailable - service worker registration skipped');
    return null;
  }
}

// Handle PWA install prompt
export function setupPWAInstall() {
  // Check if already installed
  if (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone) {
    isInstalled = true;
    console.log('App is running in standalone mode');
  }

  // Listen for install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('PWA install prompt available');
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    showInstallButton();
  });

  // Listen for app installed
  window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    isInstalled = true;
    hideInstallButton();
    deferredPrompt = null;
  });
}

// Show install button/notification
function showInstallButton() {
  // Could integrate with your app's UI to show install prompt
  const event = new CustomEvent('pwa-install-available');
  window.dispatchEvent(event);
}

// Hide install button
function hideInstallButton() {
  const event = new CustomEvent('pwa-install-completed');
  window.dispatchEvent(event);
}

// Trigger PWA install
export async function installPWA(): Promise<boolean> {
  if (!deferredPrompt) {
    return false;
  }

  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`PWA install outcome: ${outcome}`);
    deferredPrompt = null;

    return outcome === 'accepted';
  } catch (error) {
    console.error('PWA install failed:', error);
    return false;
  }
}

// Show update notification
function showUpdateNotification() {
  const event = new CustomEvent('pwa-update-available');
  window.dispatchEvent(event);
}

// Update service worker
export async function updateServiceWorker(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  if (registration?.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }
}

// Check online status and sync when back online
export function setupOfflineSync() {
  window.addEventListener('online', () => {
    console.log('App is back online');
    const event = new CustomEvent('app-back-online');
    window.dispatchEvent(event);

    // Trigger background sync if supported
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration) => {
        return (registration as any).sync.register('background-sync');
      });
    }
  });

  window.addEventListener('offline', () => {
    console.log('App is offline');
    const event = new CustomEvent('app-offline');
    window.dispatchEvent(event);
  });
}

// Get current online status
export function isOnline(): boolean {
  return navigator.onLine;
}

// Check if PWA is installed
export function isPWAInstalled(): boolean {
  return isInstalled;
}

// Cache assessment data for offline access
export async function cacheAssessmentData(assessmentId: string, data: any): Promise<void> {
  if (!('caches' in window)) {
    return;
  }

  try {
    const cache = await caches.open('rur2-api-v1');
    const url = `/api/assessments/${assessmentId}`;

    const response = new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'X-Cached-At': new Date().toISOString()
      }
    });

    await cache.put(url, response);
    console.log(`Assessment ${assessmentId} cached for offline access`);
  } catch (error) {
    console.error('Failed to cache assessment data:', error);
  }
}

// Get cached assessment data
export async function getCachedAssessmentData(assessmentId: string): Promise<any | null> {
  if (!('caches' in window)) {
    return null;
  }

  try {
    const cache = await caches.open('rur2-api-v1');
    const url = `/api/assessments/${assessmentId}`;
    const response = await cache.match(url);

    if (response) {
      const data = await response.json();
      console.log(`Retrieved cached assessment ${assessmentId}`);
      return data;
    }

    return null;
  } catch (error) {
    console.error('Failed to get cached assessment data:', error);
    return null;
  }
}