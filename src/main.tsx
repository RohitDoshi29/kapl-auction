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

    // Clean up any stale service workers and caches to prevent chunk mismatch
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (swErr) {
        console.warn('[SW Cleanup] Stale cache cleanup ignored:', swErr);
      }
    }
  } catch (error) {
    console.error('[Init] Initialization error:', error);
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
