import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  environment: string;
  timestamp: string;
  database: 'connected' | 'error';
  realtimeAvailable: boolean;
  details?: Record<string, unknown>;
}

export default function Health() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        let dbStatus: 'connected' | 'error' = 'connected';
        let realtimeAvailable = false;

        try {
          const { error: queryError } = await supabase
            .from('players')
            .select('id', { count: 'exact', head: true });

          if (queryError) {
            dbStatus = 'error';
          }
        } catch (err) {
          dbStatus = 'error';
        }

        try {
          realtimeAvailable = supabase.realtime.isConnected();
        } catch {
          realtimeAvailable = false;
        }

        const status: HealthStatus = {
          status: dbStatus === 'connected' ? 'ok' : 'degraded',
          version: '3.0.0',
          environment: import.meta.env.VITE_ENVIRONMENT || 'production',
          timestamp: new Date().toISOString(),
          database: dbStatus,
          realtimeAvailable,
          details: {
            uptime: Math.floor(performance.now() / 1000),
            buildTime: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'unknown',
          },
        };

        setHealth(status);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Health check failed';
        setError(message);
        setHealth({
          status: 'error',
          version: '3.0.0',
          environment: import.meta.env.VITE_ENVIRONMENT || 'production',
          timestamp: new Date().toISOString(),
          database: 'error',
          realtimeAvailable: false,
        });
      }
    };

    checkHealth();
  }, []);

  if (!health) {
    return <div className="text-xs">Checking...</div>;
  }

  const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 503 : 500;

  return (
    <pre className="text-xs font-mono p-4">
      {JSON.stringify(health, null, 2)}
      {error && `\nError: ${error}`}
    </pre>
  );
}

declare const __BUILD_TIME__: string | undefined;
