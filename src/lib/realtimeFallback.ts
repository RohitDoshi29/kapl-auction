import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

type RealtimeListener = (data: any) => void;

interface PollingSubscription {
  key: string;
  interval: NodeJS.Timeout | null;
  table: string;
  filter?: (row: any) => boolean;
  listeners: RealtimeListener[];
}

const pollingSubscriptions = new Map<string, PollingSubscription>();
let realtimeHealthy = true;
let pollInterval = 5000; // 5 seconds default

export function initRealtimeFallback() {
  // Monitor real-time subscription health
  const healthCheck = setInterval(() => {
    checkRealtimeHealth();
  }, 30000); // Check every 30 seconds

  return () => clearInterval(healthCheck);
}

async function checkRealtimeHealth(): Promise<boolean> {
  try {
    // Try to subscribe to a test channel
    const channel = supabase.channel('health-check');

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        realtimeHealthy = true;
        logger.debug('Real-time connection healthy');
      } else if (status === 'CLOSED') {
        realtimeHealthy = false;
        logger.warn('Real-time connection closed, falling back to polling');
        resumeAllPolling();
      }
    });

    // Clean up after check
    setTimeout(() => {
      supabase.removeChannel(channel);
    }, 5000);

    return realtimeHealthy;
  } catch (error) {
    logger.error('Real-time health check failed', error);
    realtimeHealthy = false;
    resumeAllPolling();
    return false;
  }
}

export function subscribeWithFallback<T>(
  table: string,
  callback: (data: T[]) => void,
  filter?: (row: T) => boolean
): () => void {
  const key = `${table}_${Math.random().toString(36).substring(7)}`;

  if (realtimeHealthy) {
    // Use real-time subscription
    const channel = supabase
      .channel(`changes_${key}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
        },
        (payload) => {
          const rawRecord =
            payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old;
          const record = rawRecord as T | undefined;
          if (!filter || (record && filter(record))) {
            logger.debug(`Real-time update: ${table}`, { action: payload.eventType });
            fetchAndCallback(table, callback, filter);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CLOSED') {
          logger.warn(`Real-time subscription closed for ${table}, enabling polling fallback`);
          realtimeHealthy = false;
          startPolling(key, table, callback, filter);
        }
      });

    // Return unsubscribe function
    return () => {
      supabase.removeChannel(channel);
      stopPolling(key);
    };
  } else {
    // Use polling fallback
    startPolling(key, table, callback, filter);
    return () => stopPolling(key);
  }
}

function startPolling<T>(
  key: string,
  table: string,
  callback: (data: T[]) => void,
  filter?: (row: T) => boolean
) {
  if (pollingSubscriptions.has(key)) {
    return;
  }

  logger.info(`Starting polling fallback for ${table}`);

  const subscription: PollingSubscription = {
    key,
    interval: null,
    table,
    filter: filter as any,
    listeners: [callback],
  };

  const poll = async () => {
    try {
      await fetchAndCallback(table, callback, filter);
    } catch (error) {
      logger.error(`Polling error for ${table}`, error);
    }
  };

  // Initial fetch
  poll();

  // Set up recurring polls
  subscription.interval = setInterval(poll, pollInterval);
  pollingSubscriptions.set(key, subscription);
}

function stopPolling(key: string) {
  const subscription = pollingSubscriptions.get(key);
  if (subscription?.interval) {
    clearInterval(subscription.interval);
    logger.info(`Stopped polling for ${subscription.table}`);
  }
  pollingSubscriptions.delete(key);
}

function resumeAllPolling() {
  for (const [key, subscription] of pollingSubscriptions) {
    if (!subscription.interval) {
      logger.info(`Resuming polling for ${subscription.table}`);
      startPolling(key, subscription.table, (data: any) => {
        for (const listener of subscription.listeners) {
          listener(data);
        }
      }, subscription.filter);
    }
  }
}

async function fetchAndCallback<T>(
  table: string,
  callback: (data: T[]) => void,
  filter?: (row: T) => boolean
) {
  try {
    const cols =
      table === 'players'
        ? 'id, name, photo_url, role, batting_style, bowling_style, tournament_id, team_id, jersey_number, base_price, sold_price, auction_status'
        : '*';
    const dynamicClient = supabase as unknown as {
      from: (tableName: string) => {
        select: (columns: string) => Promise<{ data: T[] | null; error: { message?: string } | null }>;
      };
    };
    const { data, error } = await dynamicClient.from(table).select(cols);

    if (error) {
      logger.error(`Failed to fetch ${table}`, error);
      return;
    }

    let filtered = (data as T[]) || [];
    if (filter) {
      filtered = filtered.filter(filter);
    }

    callback(filtered);
  } catch (error) {
    logger.error(`Error fetching ${table}`, error);
  }
}

export function isRealtimeHealthy(): boolean {
  return realtimeHealthy;
}

export function getPollingStatus() {
  const subscriptions = Array.from(pollingSubscriptions.values()).map((sub) => ({
    table: sub.table,
    isPolling: sub.interval !== null,
  }));

  return {
    realtimeHealthy,
    activePolling: subscriptions.length > 0,
    subscriptions,
  };
}

export function setPollInterval(intervalMs: number) {
  pollInterval = intervalMs;
  logger.debug(`Polling interval updated to ${intervalMs}ms`);
}
