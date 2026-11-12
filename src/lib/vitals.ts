import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/react';

interface VitalMetrics {
  LCP?: number; // Largest Contentful Paint
  CLS?: number; // Cumulative Layout Shift
  FCP?: number; // First Contentful Paint
  TTFB?: number; // Time to First Byte
  INP?: number; // Interaction to Next Paint
  pageLoadTime?: number;
}

const metrics: VitalMetrics = {};
const pageStartTime = performance.now();

export function initWebVitals() {
  try {
    // Track page load time
    if (document.readyState === 'complete') {
      metrics.pageLoadTime = performance.now() - pageStartTime;
    } else {
      window.addEventListener('load', () => {
        metrics.pageLoadTime = performance.now() - pageStartTime;
        reportPageLoadMetric();
      });
    }

    // Track Core Web Vitals using PerformanceObserver API
    if ('PerformanceObserver' in window) {
      try {
        // Track LCP (Largest Contentful Paint)
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          metrics.LCP = lastEntry.startTime;
          checkThreshold('LCP', metrics.LCP);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Track CLS (Cumulative Layout Shift)
        const clsObserver = new PerformanceObserver((list) => {
          let cls = 0;
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              cls += (entry as any).value;
            }
          }
          metrics.CLS = cls;
          checkThreshold('CLS', metrics.CLS);
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        // Track FCP (First Contentful Paint)
        const fcpObserver = new PerformanceObserver((list) => {
          const fcpEntry = list.getEntries()[0];
          metrics.FCP = fcpEntry.startTime;
          checkThreshold('FCP', metrics.FCP);
        });
        fcpObserver.observe({ entryTypes: ['paint'] });

        // Track TTFB (Time to First Byte)
        const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigationTiming) {
          metrics.TTFB = navigationTiming.responseStart - navigationTiming.requestStart;
          checkThreshold('TTFB', metrics.TTFB);
        }
      } catch (error) {
        logger.debug('PerformanceObserver setup error', { error });
      }
    }

    logger.debug('Web Vitals tracking initialized');
  } catch (error) {
    logger.error('Failed to initialize web vitals', error);
  }
}

function checkThreshold(metric: string, value: number) {
  const thresholds: Record<string, { good: number; poor: number }> = {
    LCP: { good: 2500, poor: 4000 },
    CLS: { good: 0.1, poor: 0.25 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 600, poor: 1200 },
    INP: { good: 200, poor: 500 },
  };

  const threshold = thresholds[metric];
  if (!threshold) return;

  if (value > threshold.poor) {
    logger.warn(`Performance Alert: ${metric} exceeded poor threshold`, {
      metric,
      value,
      threshold: threshold.poor,
    });

    if (import.meta.env.PROD) {
      Sentry.captureMessage(`Web Vital Alert: ${metric}`, 'warning');
    }
  }
}

function reportPageLoadMetric() {
  if (!import.meta.env.PROD) return;

  if (metrics.pageLoadTime && metrics.pageLoadTime > 3000) {
    logger.warn('Page load time exceeds 3 seconds', { pageLoadTime: metrics.pageLoadTime });
    Sentry.captureMessage('Slow page load', 'warning');
  }
}

export function getMetrics(): VitalMetrics {
  return { ...metrics };
}

export function sendMetricsToAnalytics() {
  if (import.meta.env.PROD && Object.keys(metrics).length > 0) {
    Sentry.captureMessage('Web Vitals Summary', 'info');
  }
}
