import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { useTournament } from '@/contexts/TournamentContext';
import { useSunlightMode } from '@/hooks/useSunlightMode';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_TEAMS, DEFAULT_WOMENS_TEAMS, Team } from '@/lib/cricketTypes';
import { isSoundEnabled, setSoundEnabled, playBoundaryFour } from '@/lib/soundEffects';
import { Header } from '@/components/cricket/Header';
import { TeamBadge } from '@/components/cricket/TeamBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Settings as SettingsIcon,
  ShieldCheck,
  Crown,
  UserPlus,
  Trash2,
  ArrowLeft,
  Lock,
  Building2,
  User,
  KeyRound,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Save,
  RefreshCw,
  Sliders,
} from 'lucide-react';

interface CoAdminEntry {
  id: string;
  email: string;
  name: string;
  title: string;
  userId?: string;
  addedAt: string;
}

interface RoleAssignmentRecord {
  email: string;
  role: UserRole;
  title?: string;
  teamName?: string;
  teamId?: string;
  userId?: string;
  assignedBy?: string;
  assignedAt?: string;
}

type TeamMetaCache = Partial<Omit<Team, 'ownerName'>> & {
  ownerName?: string | null;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readJsonMap<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function Settings() {
  const {
    user,
    profile,
    userRole,
    isLoading,
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    updateProfile,
    changePassword,
    assignUserRole,
    revokeUserRole,
    assignRoleByEmail,
    revokeRoleByEmail,
  } = useAuth();
  const { activeTournamentId, setActiveTournamentId } = useTournament();
  const { isSunlightMode, toggleSunlightMode } = useSunlightMode();

  const [activeTab, setActiveTab] = useState<'roles' | 'owners' | 'basic'>('roles');

  // Co-Admin & role directory state
  const [coAdmins, setCoAdmins] = useState<CoAdminEntry[]>(() =>
    readJsonMap<CoAdminEntry[]>('kapl_co_admins', [])
  );
  const [roleAssignments, setRoleAssignments] = useState<Record<string, RoleAssignmentRecord>>(() =>
    readJsonMap<Record<string, RoleAssignmentRecord>>('kapl_role_assignments', {})
  );
  const [coAdminEmail, setCoAdminEmail] = useState('');
  const [coAdminName, setCoAdminName] = useState('');
  const [coAdminTitle, setCoAdminTitle] = useState('');
  const [coAdminUuid, setCoAdminUuid] = useState('');
  const [isSavingCoAdmin, setIsSavingCoAdmin] = useState(false);

  // Teams & owners state (loads all 12 teams across Men's & Women's)
  const [teams, setTeams] = useState<Team[]>([...DEFAULT_TEAMS, ...DEFAULT_WOMENS_TEAMS]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [ownerDivisionFilter, setOwnerDivisionFilter] = useState<string>(activeTournamentId || 'kapl-3-mens');
  const [selectedOwnerTeamId, setSelectedOwnerTeamId] = useState<string>('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerUuid, setOwnerUuid] = useState('');
  const [isSavingOwner, setIsSavingOwner] = useState(false);

  // Basic user settings state
  const [displayName, setDisplayName] = useState(profile?.name || '');
  const [photoUrl, setPhotoUrl] = useState(profile?.photoUrl || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());

  // Basic franchise settings state
  const [selectedConfigTeamId, setSelectedConfigTeamId] = useState<string>('');
  const [configTeamName, setConfigTeamName] = useState('');
  const [configInitialPurse, setConfigInitialPurse] = useState<number>(10000);
  const [configMaxSquadSize, setConfigMaxSquadSize] = useState<number>(10);
  const [isSavingTeamConfig, setIsSavingTeamConfig] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.name || '');
    setPhotoUrl(profile?.photoUrl || '');
  }, [profile]);

  useEffect(() => {
    const syncSound = () => setSoundOn(isSoundEnabled());
    window.addEventListener('kapl-sound-toggle', syncSound);
    return () => window.removeEventListener('kapl-sound-toggle', syncSound);
  }, []);

  const fetchAllTeams = useCallback(async () => {
    setLoadingTeams(true);
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, tournament_id, name, group, logo, primary_color, players, player_count, initial_purse, remaining_purse, max_squad_size, owner_name, owner_email, owner_user_id')
        .order('id');

      const metaMap = readJsonMap<Record<string, TeamMetaCache>>('kapl_team_metadata', {});
      const defaults = [...DEFAULT_TEAMS, ...DEFAULT_WOMENS_TEAMS];

      if (!error && data && data.length > 0) {
        const syncedMeta: Record<string, TeamMetaCache> = { ...metaMap };
        const mapped: Team[] = data.map((t) => {
          const fallbackTeam = defaults.find((d) => d.id === t.id);
          syncedMeta[t.id] = {
            ...(syncedMeta[t.id] || {}),
            ownerName: t.owner_name ?? null,
            ownerEmail: t.owner_email ?? null,
            ownerUserId: t.owner_user_id ?? null,
          };
          return {
            id: t.id,
            tournamentId: t.tournament_id || fallbackTeam?.tournamentId || 'kapl-3-mens',
            name: t.name,
            group: (t.group as 'A' | 'B') || 'A',
            logo: t.logo,
            primaryColor: t.primary_color,
            players: Array.isArray(t.players) ? (t.players as unknown as Team['players']) : [],
            playerCount: t.player_count || 0,
            initialPurse: Number(t.initial_purse || 10000),
            remainingPurse: Number(t.remaining_purse ?? t.initial_purse ?? 10000),
            maxSquadSize: t.max_squad_size || 10,
            ownerName: t.owner_name ?? undefined,
            ownerEmail: t.owner_email ?? null,
            ownerUserId: t.owner_user_id ?? null,
          };
        });
        try {
          localStorage.setItem('kapl_team_metadata', JSON.stringify(syncedMeta));
        } catch {
          // Ignore storage quota issues
        }
        setTeams(mapped);
      }
    } catch {
      toast.error('Could not refresh teams from database');
    } finally {
      setLoadingTeams(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchAllTeams();
    }
  }, [isAuthenticated, isAdmin, fetchAllTeams]);

  const persistCoAdmins = (next: CoAdminEntry[]) => {
    setCoAdmins(next);
    try {
      localStorage.setItem('kapl_co_admins', JSON.stringify(next));
    } catch {
      // Ignore storage quota issues
    }
  };

  const refreshRoleDirectory = () => {
    setRoleAssignments(readJsonMap<Record<string, RoleAssignmentRecord>>('kapl_role_assignments', {}));
  };

  const updateTeamMetadataCache = (teamId: string, patch: TeamMetaCache) => {
    const metaMap = readJsonMap<Record<string, TeamMetaCache>>('kapl_team_metadata', {});
    metaMap[teamId] = { ...(metaMap[teamId] || {}), ...patch };
    try {
      localStorage.setItem('kapl_team_metadata', JSON.stringify(metaMap));
    } catch {
      // Ignore storage quota issues
    }
  };

  // Keep Owner form synced with selected team
  useEffect(() => {
    if (!selectedOwnerTeamId) {
      setOwnerName('');
      setOwnerEmail('');
      setOwnerUuid('');
      return;
    }
    const team = teams.find((t) => t.id === selectedOwnerTeamId);
    if (team) {
      setOwnerName(team.ownerName || '');
      setOwnerEmail(team.ownerEmail || '');
      setOwnerUuid(team.ownerUserId || '');
    }
  }, [selectedOwnerTeamId, teams]);

  // Keep Team Config form synced with selected team
  useEffect(() => {
    if (!selectedConfigTeamId) {
      setConfigTeamName('');
      setConfigInitialPurse(10000);
      setConfigMaxSquadSize(10);
      return;
    }
    const team = teams.find((t) => t.id === selectedConfigTeamId);
    if (team) {
      setConfigTeamName(team.name);
      setConfigInitialPurse(team.initialPurse || 10000);
      setConfigMaxSquadSize(team.maxSquadSize || 10);
    }
  }, [selectedConfigTeamId, teams]);

  const handleAppointCoAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      toast.error('Only Main Admin or Admin can appoint Co-Admins');
      return;
    }

    const cleanEmail = coAdminEmail.trim().toLowerCase();
    const cleanUuid = coAdminUuid.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (cleanUuid && !UUID_REGEX.test(cleanUuid)) {
      toast.error('Optional User UUID must be a valid UUID format');
      return;
    }
    if (coAdmins.some((c) => c.email.toLowerCase() === cleanEmail)) {
      toast.error('This email is already appointed as Co-Admin');
      return;
    }

    setIsSavingCoAdmin(true);
    try {
      const assignedBy = profile?.name || user?.email || 'Admin';
      const title = coAdminTitle.trim() || 'Co-Admin Official';

      const emailRes = await assignRoleByEmail(cleanEmail, 'co_admin', {
        title,
        assignedBy,
        userId: cleanUuid || undefined,
      });
      if (emailRes.error) throw emailRes.error;

      if (cleanUuid) {
        const dbRes = await assignUserRole(cleanUuid, 'co_admin');
        if (dbRes.error) {
          toast.warning(`Email role saved locally, but DB role update failed: ${dbRes.error.message}`);
        }
      }

      const newEntry: CoAdminEntry = {
        id: `coadmin_${Date.now()}`,
        email: cleanEmail,
        name: coAdminName.trim() || cleanEmail.split('@')[0],
        title,
        userId: cleanUuid || undefined,
        addedAt: new Date().toISOString().split('T')[0],
      };

      persistCoAdmins([newEntry, ...coAdmins]);
      refreshRoleDirectory();
      setCoAdminEmail('');
      setCoAdminName('');
      setCoAdminTitle('');
      setCoAdminUuid('');
      toast.success(`Granted Co-Admin role to ${cleanEmail}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to appoint Co-Admin';
      toast.error(message);
    } finally {
      setIsSavingCoAdmin(false);
    }
  };

  const handleRevokeCoAdmin = async (entry: CoAdminEntry) => {
    if (!isSuperAdmin) {
      toast.error('Only Main Admin or Admin can revoke Co-Admins');
      return;
    }
    try {
      await revokeRoleByEmail(entry.email, 'co_admin');
      if (entry.userId && UUID_REGEX.test(entry.userId)) {
        const dbRes = await revokeUserRole(entry.userId, 'co_admin');
        if (dbRes.error) {
          toast.warning(`Revoked locally; DB user_roles deletion returned: ${dbRes.error.message}`);
        }
      }
      persistCoAdmins(coAdmins.filter((c) => c.id !== entry.id));
      refreshRoleDirectory();
      toast.info(`Deleted Co-Admin role for ${entry.email}`);
    } catch {
      toast.error('Failed to revoke Co-Admin');
    }
  };

  const handleSaveTeamOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOwnerTeamId) {
      toast.error('Please select a team');
      return;
    }
    if (!ownerName.trim()) {
      toast.error('Please enter the Team Owner name');
      return;
    }
    const cleanEmail = ownerEmail.trim().toLowerCase();
    const cleanUuid = ownerUuid.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      toast.error('Please enter a valid Team Owner email address');
      return;
    }
    if (cleanUuid && !UUID_REGEX.test(cleanUuid)) {
      toast.error('Optional Owner User UUID must be a valid UUID format');
      return;
    }

    const team = teams.find((t) => t.id === selectedOwnerTeamId);
    if (!team) return;

    setIsSavingOwner(true);
    try {
      const cleanName = ownerName.trim();
      const now = new Date().toISOString();

      const { error: dbErr } = await supabase
        .from('teams')
        .update({
          owner_name: cleanName,
          owner_email: cleanEmail,
          owner_user_id: cleanUuid || null,
          updated_at: now,
        })
        .eq('id', team.id);

      if (dbErr) {
        throw new Error(dbErr.message);
      }

      updateTeamMetadataCache(team.id, {
        ownerName: cleanName,
        ownerEmail: cleanEmail,
        ownerUserId: cleanUuid || null,
      });

      await assignRoleByEmail(cleanEmail, 'owner', {
        teamName: team.name,
        teamId: team.id,
        title: 'Team Owner',
        assignedBy: profile?.name || user?.email || 'Admin',
        userId: cleanUuid || undefined,
      });

      if (cleanUuid) {
        const dbRoleRes = await assignUserRole(cleanUuid, 'owner');
        if (dbRoleRes.error) {
          toast.warning(`Team owner saved, but DB user_roles returned: ${dbRoleRes.error.message}`);
        }
      }

      refreshRoleDirectory();
      await fetchAllTeams();
      toast.success(`Assigned ${cleanName} (${cleanEmail}) as Owner of ${team.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign team owner';
      toast.error(message);
    } finally {
      setIsSavingOwner(false);
    }
  };

  const handleRemoveTeamOwner = async (team: Team) => {
    setIsSavingOwner(true);
    try {
      const now = new Date().toISOString();
      const { error: dbErr } = await supabase
        .from('teams')
        .update({
          owner_name: null,
          owner_email: null,
          owner_user_id: null,
          updated_at: now,
        })
        .eq('id', team.id);

      if (dbErr) {
        throw new Error(dbErr.message);
      }

      updateTeamMetadataCache(team.id, {
        ownerName: null,
        ownerEmail: null,
        ownerUserId: null,
      });
      try {
        localStorage.removeItem(`kapl_team_meta_${team.id}`);
      } catch {
        // Ignore storage quota issues
      }

      const currentAssignments = readJsonMap<Record<string, RoleAssignmentRecord>>('kapl_role_assignments', {});
      const emailsToRevoke = new Set<string>();
      const uuidsToRevoke = new Set<string>();

      if (team.ownerEmail) {
        emailsToRevoke.add(team.ownerEmail.toLowerCase().trim());
      }
      if (team.ownerUserId && UUID_REGEX.test(team.ownerUserId)) {
        uuidsToRevoke.add(team.ownerUserId);
      }
      if (selectedOwnerTeamId === team.id && ownerUuid.trim() && UUID_REGEX.test(ownerUuid.trim())) {
        uuidsToRevoke.add(ownerUuid.trim());
      }

      Object.values(currentAssignments).forEach((rec) => {
        if (
          rec.role === 'owner' &&
          (rec.teamId === team.id || (team.ownerEmail && rec.email.toLowerCase().trim() === team.ownerEmail.toLowerCase().trim()))
        ) {
          emailsToRevoke.add(rec.email.toLowerCase().trim());
          if (rec.userId && UUID_REGEX.test(rec.userId)) {
            uuidsToRevoke.add(rec.userId);
          }
        }
      });

      for (const email of emailsToRevoke) {
        await revokeRoleByEmail(email, 'owner');
      }
      for (const uid of uuidsToRevoke) {
        const dbRes = await revokeUserRole(uid, 'owner');
        if (dbRes.error) {
          toast.warning(`Team owner removed, but DB user_roles deletion returned: ${dbRes.error.message}`);
        }
      }

      setTeams((prev) =>
        prev.map((t) =>
          t.id === team.id
            ? { ...t, ownerName: undefined, ownerEmail: null, ownerUserId: null }
            : t
        )
      );

      if (selectedOwnerTeamId === team.id) {
        setOwnerName('');
        setOwnerEmail('');
        setOwnerUuid('');
      }
      refreshRoleDirectory();
      await fetchAllTeams();
      toast.info(`Deleted Team Owner role for ${team.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove team owner';
      toast.error(message);
    } finally {
      setIsSavingOwner(false);
    }
  };

  const handleDeleteRoleAssignment = async (rec: RoleAssignmentRecord) => {
    const cleanEmail = rec.email.toLowerCase().trim();
    if (rec.role === 'co_admin' && !isSuperAdmin) {
      toast.error('Only Main Admin or Admin can revoke Co-Admins');
      return;
    }

    setIsSavingOwner(true);
    try {
      if (rec.role === 'owner') {
        const matchingTeams = teams.filter(
          (t) =>
            (rec.teamId && t.id === rec.teamId) ||
            (t.ownerEmail || '').toLowerCase().trim() === cleanEmail
        );
        for (const team of matchingTeams) {
          await supabase
            .from('teams')
            .update({
              owner_name: null,
              owner_email: null,
              owner_user_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', team.id);
          updateTeamMetadataCache(team.id, {
            ownerName: null,
            ownerEmail: null,
            ownerUserId: null,
          });
          try {
            localStorage.removeItem(`kapl_team_meta_${team.id}`);
          } catch {
            // Ignore storage quota issues
          }
          if (team.ownerUserId && UUID_REGEX.test(team.ownerUserId)) {
            await revokeUserRole(team.ownerUserId, 'owner');
          }
        }
      }

      if (rec.role === 'co_admin') {
        persistCoAdmins(coAdmins.filter((c) => c.email.toLowerCase().trim() !== cleanEmail));
      }

      await revokeRoleByEmail(cleanEmail, rec.role);
      const matchingCoAdmin = coAdmins.find((c) => c.email.toLowerCase().trim() === cleanEmail);
      const uid = rec.userId || matchingCoAdmin?.userId;
      if (uid && UUID_REGEX.test(uid)) {
        const dbRes = await revokeUserRole(uid, rec.role);
        if (dbRes.error) {
          toast.warning(`Role deleted locally, but DB user_roles deletion returned: ${dbRes.error.message}`);
        }
      }

      refreshRoleDirectory();
      await fetchAllTeams();
      toast.info(`Deleted ${rec.role} role for ${cleanEmail}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete role assignment');
    } finally {
      setIsSavingOwner(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error('Display name cannot be empty');
      return;
    }
    setIsSavingProfile(true);
    try {
      const { error } = await updateProfile({
        name: displayName.trim(),
        photoUrl: photoUrl.trim() || '',
      });
      if (error) throw error;
      toast.success('Profile details updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setIsSavingPassword(true);
    try {
      const { error } = await changePassword(newPassword);
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
    if (next) {
      playBoundaryFour();
      toast.success('Auction sound effects enabled');
    } else {
      toast.info('Auction sound effects muted');
    }
  };

  const handleSaveTeamConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConfigTeamId) {
      toast.error('Please select a team to configure');
      return;
    }
    if (!configTeamName.trim()) {
      toast.error('Team name cannot be empty');
      return;
    }
    if (configInitialPurse < 100 || configInitialPurse > 1000000) {
      toast.error('Initial purse must be between ₹100 and ₹10,00,000');
      return;
    }
    if (configMaxSquadSize < 1 || configMaxSquadSize > 25) {
      toast.error('Max squad size must be between 1 and 25');
      return;
    }

    const team = teams.find((t) => t.id === selectedConfigTeamId);
    if (!team) return;

    setIsSavingTeamConfig(true);
    try {
      const totalSpent = (team.players || []).reduce(
        (sum, p) => sum + (Number(p.soldPrice) || 0),
        0
      );
      const nextRemaining = Math.max(0, configInitialPurse - totalSpent);

      const { error: dbErr } = await supabase
        .from('teams')
        .update({
          name: configTeamName.trim(),
          initial_purse: configInitialPurse,
          remaining_purse: nextRemaining,
          max_squad_size: configMaxSquadSize,
          updated_at: new Date().toISOString(),
        })
        .eq('id', team.id);

      if (dbErr) {
        throw new Error(dbErr.message);
      }

      await fetchAllTeams();
      toast.success(`Updated basic settings for ${configTeamName.trim()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save team settings');
    } finally {
      setIsSavingTeamConfig(false);
    }
  };

  const filteredOwnerTeams = teams.filter(
    (t) => (t.tournamentId || 'kapl-3-mens') === ownerDivisionFilter
  );
  const selectedOwnerTeam = teams.find((t) => t.id === selectedOwnerTeamId) || null;
  const assignedTeamOwnerEmails = new Set(
    teams
      .map((t) => (t.ownerEmail || '').toLowerCase().trim())
      .filter(Boolean)
  );
  const unlinkedOwnerRoles = Object.values(roleAssignments).filter(
    (rec) => rec.role === 'owner' && !assignedTeamOwnerEmails.has(rec.email.toLowerCase().trim())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 max-w-lg">
          <Card className="border-amber-500/30 bg-card/90 backdrop-blur-xl shadow-2xl">
            <CardHeader className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <Lock className="w-6 h-6 text-amber-400" />
              </div>
              <CardTitle className="text-xl font-black">Admin Access Required</CardTitle>
              <CardDescription>
                Settings, Co-Admin role assignment, and Team Owner configuration are restricted to authenticated Auction Admins.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-2.5 justify-center">
              {!isAuthenticated && (
                <Link to="/auth">
                  <Button className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold">
                    Sign In as Admin
                  </Button>
                </Link>
              )}
              <Link to="/">
                <Button variant="outline" className="w-full sm:w-auto gap-1.5">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Auction
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 md:py-6 max-w-5xl space-y-5">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-white/[0.08] bg-card/85 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl shadow-black/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <SettingsIcon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-foreground">
                  Admin Settings
                </h1>
                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                  {userRole === 'admin' ? 'Admin' : 'Co-Admin'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Assign Co-Admin & Team Owner roles, plus manage personal and global auction settings.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAllTeams}
              disabled={loadingTeams}
              className="gap-1.5 text-xs min-h-[44px] sm:min-h-0 sm:h-9 flex-1 sm:flex-none justify-center"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTeams ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link to="/" className="flex-1 sm:flex-none">
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs min-h-[44px] sm:min-h-0 sm:h-9 justify-center">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Auction
              </Button>
            </Link>
          </div>
        </div>

        {/* Settings Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'roles' | 'owners' | 'basic')}
          className="space-y-4"
        >
          <TabsList className="flex w-full items-center justify-start sm:grid sm:grid-cols-3 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-white/[0.04] border border-white/10 rounded-2xl p-1">
            <TabsTrigger value="roles" className="shrink-0 sm:shrink gap-1.5 text-xs sm:text-sm font-bold rounded-xl min-h-[44px] px-3 sm:px-2">
              <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Co-Admin Roles</span>
            </TabsTrigger>
            <TabsTrigger value="owners" className="shrink-0 sm:shrink gap-1.5 text-xs sm:text-sm font-bold rounded-xl min-h-[44px] px-3 sm:px-2">
              <Crown className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Team Owners</span>
            </TabsTrigger>
            <TabsTrigger value="basic" className="shrink-0 sm:shrink gap-1.5 text-xs sm:text-sm font-bold rounded-xl min-h-[44px] px-3 sm:px-2">
              <Sliders className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Basic Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: CO-ADMIN & ACCESS ROLES */}
          <TabsContent value="roles" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-white/10 bg-card/85">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-purple-400" />
                    Grant Co-Admin Role
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Co-Admins gain access to the Admin Auction Desk, Add/Clear Players, and Team Owner controls.
                    Email-based roles apply locally; add the user&apos;s Supabase User UUID to also persist to <code className="text-[11px]">user_roles</code> in Postgres.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!isSuperAdmin ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
                      Only Main Admin or Admin accounts can appoint or revoke Co-Admin privileges.
                    </div>
                  ) : (
                    <form onSubmit={handleAppointCoAdmin} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="coadmin-email">Co-Admin Email *</Label>
                        <Input
                          id="coadmin-email"
                          type="email"
                          placeholder="coadmin@example.com"
                          value={coAdminEmail}
                          onChange={(e) => setCoAdminEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="coadmin-name">Full Name</Label>
                          <Input
                            id="coadmin-name"
                            placeholder="Optional name"
                            value={coAdminName}
                            onChange={(e) => setCoAdminName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="coadmin-title">Role Title</Label>
                          <Input
                            id="coadmin-title"
                            placeholder="Auction Co-Admin"
                            value={coAdminTitle}
                            onChange={(e) => setCoAdminTitle(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="coadmin-uuid">Supabase User UUID (Optional)</Label>
                        <Input
                          id="coadmin-uuid"
                          placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                          value={coAdminUuid}
                          onChange={(e) => setCoAdminUuid(e.target.value)}
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={isSavingCoAdmin}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold gap-2"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        {isSavingCoAdmin ? 'Granting Role...' : 'Appoint Co-Admin'}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-card/85">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Appointed Co-Admins ({coAdmins.length})</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Manage active Co-Admins and view recent role assignments.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {coAdmins.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center border border-dashed border-white/10 rounded-xl">
                      No Co-Admins appointed yet.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {coAdmins.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm truncate">{entry.name}</span>
                              <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/30 text-[10px] shrink-0">
                                {entry.title}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{entry.email}</p>
                            {entry.userId && (
                              <p className="text-[10px] font-mono text-emerald-400/90 truncate">
                                DB UUID: {entry.userId}
                              </p>
                            )}
                          </div>
                          {isSuperAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRevokeCoAdmin(entry)}
                              className="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 shrink-0"
                              title={`Revoke Co-Admin for ${entry.email}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {Object.keys(roleAssignments).length > 0 && (
                    <div className="pt-2 border-t border-white/10 space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Active Role Registry
                      </p>
                      <div className="space-y-1 max-h-36 overflow-y-auto">
                        {Object.values(roleAssignments).map((rec) => (
                          <div
                            key={rec.email}
                            className="flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.02]"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="truncate block text-foreground">{rec.email}</span>
                              {rec.teamName && (
                                <span className="text-[10px] text-muted-foreground truncate block">
                                  {rec.teamName}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {rec.role}
                              </Badge>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={isSavingOwner}
                                onClick={() => handleDeleteRoleAssignment(rec)}
                                className="h-9 w-9 sm:h-7 sm:w-7 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                title={`Delete ${rec.role} role for ${rec.email}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: TEAM OWNER ROLE */}
          <TabsContent value="owners" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-white/10 bg-card/85">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    Assign Team Owner Role
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Assign a Team Owner to any Men&apos;s or Women&apos;s franchise. Updates the team record in Supabase and binds their Owner Hub automatically on sign-in.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveTeamOwner} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Division</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={ownerDivisionFilter === 'kapl-3-mens' ? 'default' : 'outline'}
                          onClick={() => {
                            setOwnerDivisionFilter('kapl-3-mens');
                            setSelectedOwnerTeamId('');
                          }}
                          className={
                            ownerDivisionFilter === 'kapl-3-mens'
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                              : ''
                          }
                        >
                          Men&apos;s ({teams.filter((t) => (t.tournamentId || 'kapl-3-mens') === 'kapl-3-mens').length})
                        </Button>
                        <Button
                          type="button"
                          variant={ownerDivisionFilter === 'kapl-3-womens' ? 'default' : 'outline'}
                          onClick={() => {
                            setOwnerDivisionFilter('kapl-3-womens');
                            setSelectedOwnerTeamId('');
                          }}
                          className={
                            ownerDivisionFilter === 'kapl-3-womens'
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                              : ''
                          }
                        >
                          Women&apos;s ({teams.filter((t) => t.tournamentId === 'kapl-3-womens').length})
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="owner-team-select">Select Franchise *</Label>
                      <Select value={selectedOwnerTeamId} onValueChange={setSelectedOwnerTeamId}>
                        <SelectTrigger id="owner-team-select">
                          <SelectValue placeholder="Choose a team..." />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredOwnerTeams.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name} {t.ownerName ? `— Owner: ${t.ownerName}` : '(Unassigned)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="owner-name">Owner Name *</Label>
                      <Input
                        id="owner-name"
                        placeholder="Owner full name"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="owner-email">Owner Email *</Label>
                      <Input
                        id="owner-email"
                        type="email"
                        placeholder="owner@example.com"
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="owner-uuid">Owner Supabase User UUID (Optional)</Label>
                      <Input
                        id="owner-uuid"
                        placeholder="Optional UUID for Postgres user_roles & owner_user_id"
                        value={ownerUuid}
                        onChange={(e) => setOwnerUuid(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        type="submit"
                        disabled={isSavingOwner || !selectedOwnerTeamId}
                        className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold gap-2"
                      >
                        <Crown className="w-4 h-4" />
                        {isSavingOwner ? 'Saving Team Owner...' : 'Save Team Owner'}
                      </Button>
                      {selectedOwnerTeam && (selectedOwnerTeam.ownerEmail || selectedOwnerTeam.ownerName || selectedOwnerTeam.ownerUserId) && (
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={isSavingOwner}
                          onClick={() => handleRemoveTeamOwner(selectedOwnerTeam)}
                          className="gap-1.5 font-bold"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Owner Role
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-card/85">
                <CardHeader>
                  <CardTitle className="text-base">
                    Franchise Owners ({filteredOwnerTeams.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Click a franchise to edit its owner or remove the current owner assignment.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[430px] overflow-y-auto pr-1">
                  {filteredOwnerTeams.map((team) => (
                    <div
                      key={team.id}
                      className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedOwnerTeamId(team.id)}
                        className="flex items-center gap-2.5 min-w-0 text-left flex-1"
                      >
                        <TeamBadge team={team} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm truncate">{team.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {team.ownerName
                              ? `${team.ownerName}${team.ownerEmail ? ` • ${team.ownerEmail}` : ''}`
                              : team.ownerEmail || 'No owner assigned'}
                          </p>
                        </div>
                      </button>
                      {team.ownerEmail || team.ownerName || team.ownerUserId ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isSavingOwner}
                          onClick={() => handleRemoveTeamOwner(team)}
                          className="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 shrink-0"
                          title={`Delete owner role for ${team.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedOwnerTeamId(team.id)}
                          className="min-h-[40px] sm:min-h-0 text-xs shrink-0"
                        >
                          Assign
                        </Button>
                      )}
                    </div>
                  ))}
                  {unlinkedOwnerRoles.length > 0 && (
                    <div className="pt-3 mt-2 border-t border-white/10 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Active Owner Role Entries ({unlinkedOwnerRoles.length})
                      </p>
                      {unlinkedOwnerRoles.map((rec) => (
                        <div
                          key={rec.email}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-xs truncate text-foreground">{rec.email}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {rec.teamName ? `${rec.teamName} • ` : ''}Owner Role
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isSavingOwner}
                            onClick={() => handleDeleteRoleAssignment(rec)}
                            className="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 shrink-0"
                            title={`Delete owner role for ${rec.email}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 3: BASIC SETTINGS FOR USER & ALL */}
          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Personal User Settings */}
              <Card className="border-white/10 bg-card/85">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-400" />
                    User Account & Preferences
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Manage your display profile, password, and local viewing preferences.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <form onSubmit={handleSaveProfile} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-11 h-11 border border-amber-500/40">
                        {photoUrl && <AvatarImage src={photoUrl} alt={displayName || 'User'} className="object-cover" />}
                        <AvatarFallback className="bg-amber-500/20 text-amber-300 font-bold">
                          {(displayName || user?.email || 'U').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{user?.email}</p>
                        <p className="text-[11px] text-muted-foreground">Signed-in account</p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="settings-display-name">Display Name</Label>
                      <Input
                        id="settings-display-name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your display name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="settings-photo-url">Avatar Photo URL</Label>
                      <Input
                        id="settings-photo-url"
                        value={photoUrl}
                        onChange={(e) => setPhotoUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isSavingProfile}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {isSavingProfile ? 'Saving Profile...' : 'Save Profile'}
                    </Button>
                  </form>

                  <div className="pt-4 border-t border-white/10 space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Device Viewing & Audio
                    </p>
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="flex items-center gap-2 text-sm">
                        {soundOn ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
                        <span>Auction Sound Effects</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleToggleSound}>
                        {soundOn ? 'Enabled' : 'Muted'}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="flex items-center gap-2 text-sm">
                        {isSunlightMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
                        <span>Outdoor High-Contrast Mode</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={toggleSunlightMode}>
                        {isSunlightMode ? 'Sunlight' : 'Obsidian'}
                      </Button>
                    </div>
                  </div>

                  <form onSubmit={handleChangePassword} className="pt-4 border-t border-white/10 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      Change Password
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <Input
                        type="password"
                        placeholder="New password (8+ chars)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <Input
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                    <Button type="submit" variant="outline" disabled={isSavingPassword} className="w-full font-semibold">
                      {isSavingPassword ? 'Updating...' : 'Update Password'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Global Division & Team Settings */}
              <Card className="border-white/10 bg-card/85">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    Global Auction & Team Settings
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Set the active tournament division and customize franchise names, starting purses, or squad limits across all users.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-1.5">
                    <Label>Active Tournament Division</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={activeTournamentId === 'kapl-3-mens' ? 'default' : 'outline'}
                        onClick={() => setActiveTournamentId('kapl-3-mens')}
                        className={
                          activeTournamentId === 'kapl-3-mens'
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                            : ''
                        }
                      >
                        Men&apos;s Auction
                      </Button>
                      <Button
                        type="button"
                        variant={activeTournamentId === 'kapl-3-womens' ? 'default' : 'outline'}
                        onClick={() => setActiveTournamentId('kapl-3-womens')}
                        className={
                          activeTournamentId === 'kapl-3-womens'
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                            : ''
                        }
                      >
                        Women&apos;s Auction
                      </Button>
                    </div>
                  </div>

                  <form onSubmit={handleSaveTeamConfig} className="pt-4 border-t border-white/10 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Edit Franchise Basic Settings
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="config-team-select">Franchise (All Divisions)</Label>
                      <Select value={selectedConfigTeamId} onValueChange={setSelectedConfigTeamId}>
                        <SelectTrigger id="config-team-select">
                          <SelectValue placeholder="Choose a team to edit..." />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              [{t.tournamentId === 'kapl-3-womens' ? "Women's" : "Men's"}] {t.name} (₹{t.initialPurse || 10000})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="config-team-name">Franchise Name</Label>
                      <Input
                        id="config-team-name"
                        value={configTeamName}
                        onChange={(e) => setConfigTeamName(e.target.value)}
                        placeholder="Team name"
                        disabled={!selectedConfigTeamId}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="config-initial-purse">Starting Purse (₹)</Label>
                        <Input
                          id="config-initial-purse"
                          type="number"
                          min={100}
                          step={100}
                          value={configInitialPurse}
                          onChange={(e) => setConfigInitialPurse(Number(e.target.value) || 0)}
                          disabled={!selectedConfigTeamId}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="config-max-squad">Max Squad Size</Label>
                        <Input
                          id="config-max-squad"
                          type="number"
                          min={1}
                          max={25}
                          value={configMaxSquadSize}
                          onChange={(e) => setConfigMaxSquadSize(Number(e.target.value) || 1)}
                          disabled={!selectedConfigTeamId}
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSavingTeamConfig || !selectedConfigTeamId}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {isSavingTeamConfig ? 'Saving Team Settings...' : 'Save Franchise Settings'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
