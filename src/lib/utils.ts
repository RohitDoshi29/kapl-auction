import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPlayerRole(role?: string | null): string {
  return String(role || 'all_rounder').replace(/_/g, ' ');
}

export function formatMoney(val?: number | null): string {
  const num = Number(val);
  return `₹${(Number.isFinite(num) ? num : 0).toLocaleString('en-IN')}`;
}

export function getTournamentPlayerId(
  rawId: string | null | undefined,
  tournamentId: string,
  fallbackName?: string | null,
): string {
  const baseId = String(rawId || fallbackName || '').trim();
  if (!baseId) return '';
  return tournamentId === 'kapl-3-womens'
    ? (baseId.endsWith('_w') ? baseId : `${baseId}_w`)
    : baseId.replace(/_w$/, '');
}
