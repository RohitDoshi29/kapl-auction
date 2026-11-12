import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { repairAndSyncLocalPlayerState } from "@/lib/exportRegistrations";
import { initWebVitals } from "@/lib/vitals";
import { initRealtimeFallback } from "@/lib/realtimeFallback";
import { initIndexedDB } from "@/lib/indexedDB";

// Immediately self-heal any zombie clear flags and synchronize players before render
repairAndSyncLocalPlayerState();

// Initialize production features
(async () => {
  try {
    // Initialize performance tracking
    initWebVitals();

    // Initialize real-time subscription fallback
    initRealtimeFallback();

    // Initialize IndexedDB for offline support
    await initIndexedDB();

    // Register service worker for caching and offline support
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('[SW] Service Worker registered:', registration);
      } catch (error) {
        console.error('[SW] Failed to register Service Worker:', error);
      }
    }
  } catch (error) {
    console.error('[Init] Initialization error:', error);
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
