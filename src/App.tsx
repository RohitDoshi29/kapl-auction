import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TournamentProvider } from "@/contexts/TournamentContext";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

// Eagerly loaded Auction page
import Auction from "./pages/Auction";

// Lazy-loaded auth, settings & health routes
const Auth = lazy(() => import("./pages/Auth"));
const Settings = lazy(() => import("./pages/Settings"));
const HealthCheckRoute = lazy(() => import('./pages/Health'));
const OwnerTeamAnalysis = lazy(() => import("./pages/OwnerTeamAnalysis"));

// Optimized Query Client with aggressive edge caching for high concurrency
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

function PageLoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center animate-pulse">
          <span className="text-2xl">🔨</span>
        </div>
        <div className="absolute inset-0 rounded-2xl border-2 border-primary border-t-transparent animate-spin" />
      </div>
      <p className="text-sm font-semibold text-foreground tracking-tight">KAPL 3.0 Auction</p>
      <p className="text-xs text-muted-foreground mt-0.5">Loading auction stage...</p>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <TournamentProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <Suspense fallback={<PageLoadingFallback />}>
                <Routes>
                  {/* Health check endpoint */}
                  <Route path="/health" element={<HealthCheckRoute />} />

                  {/* Auction-only routes */}
                  <Route path="/" element={<Auction />} />
                  <Route path="/auction" element={<Auction />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/owner/team-analysis" element={<OwnerTeamAnalysis />} />

                  {/* Redirect all other paths to Auction */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </TournamentProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
