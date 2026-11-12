import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tournament, DEFAULT_TOURNAMENTS } from '@/lib/cricketTypes';

interface TournamentContextType {
  tournaments: Tournament[];
  activeTournamentId: string;
  activeTournament: Tournament & { gender?: 'men' | 'women' };
  currentTournament: Tournament & { gender: 'men' | 'women' };
  setActiveTournamentId: (id: string) => void;
  toggleTournament: () => void;
  isMens: boolean;
  isWomens: boolean;
  isLoading: boolean;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

const STORAGE_KEY = 'kapl_active_tournament_id';

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const [tournaments, setTournaments] = useState<Tournament[]>(DEFAULT_TOURNAMENTS);
  const [activeTournamentId, setActiveTournamentIdState] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'kapl-3-womens' || stored === 'kapl-3-mens') {
        return stored;
      }
    } catch (e) {}
    return 'kapl-3-mens';
  });
  const [isLoading, setIsLoading] = useState(false);

  // Load tournaments from database
  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const { data, error } = await supabase
          .from('tournaments')
          .select('*')
          .order('category');

        if (error) {
          console.warn('Error fetching tournaments, using defaults:', error);
          setTournaments(DEFAULT_TOURNAMENTS);
        } else if (data && data.length > 0) {
          setTournaments(data as unknown as Tournament[]);
        }
      } catch (err) {
        console.warn('Network error loading tournaments, using defaults:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTournaments();

    // Subscribe to changes in tournaments table
    const channel = supabase
      .channel('tournaments_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const updated = payload.new as unknown as Tournament;
          setTournaments(prev => prev.map(t => t.id === updated.id ? updated : t));
        } else if (payload.eventType === 'INSERT') {
          const inserted = payload.new as unknown as Tournament;
          setTournaments(prev => [...prev.filter(t => t.id !== inserted.id), inserted]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const setActiveTournamentId = useCallback((id: string) => {
    setActiveTournamentIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (e) {}
  }, []);

  const toggleTournament = useCallback(() => {
    setActiveTournamentId(activeTournamentId === 'kapl-3-mens' ? 'kapl-3-womens' : 'kapl-3-mens');
  }, [activeTournamentId, setActiveTournamentId]);

  const rawActiveTournament = tournaments.find(t => t.id === activeTournamentId) || tournaments[0] || DEFAULT_TOURNAMENTS[0];
  const activeTournament: Tournament & { gender: 'men' | 'women' } = {
    ...rawActiveTournament,
    gender: rawActiveTournament.category === 'womens' ? 'women' : 'men',
  };
  const isMens = rawActiveTournament.category === 'mens';
  const isWomens = rawActiveTournament.category === 'womens';

  return (
    <TournamentContext.Provider
      value={{
        tournaments,
        activeTournamentId,
        activeTournament,
        currentTournament: activeTournament,
        setActiveTournamentId,
        toggleTournament,
        isMens,
        isWomens,
        isLoading,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
}

