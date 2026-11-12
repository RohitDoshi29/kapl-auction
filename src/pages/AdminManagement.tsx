import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Shield, Plus, Trash2, Edit2, Lock, User } from 'lucide-react';

interface UserAccount {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export default function AdminManagement() {
  const { isAdmin, isOwner, user } = useAuth();
  const navigate = useNavigate();

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('co_admin');
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Redirect if not admin or owner
  useEffect(() => {
    if (!isAdmin && !isOwner) {
      navigate('/');
      toast.error('Access denied. Only admins and owners can access this page.');
    }
  }, [isAdmin, isOwner, navigate]);

  // Fetch existing users
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.admin.listUsers();
      if (error) throw error;

      setUsers(
        data.users.map((u) => ({
          id: u.id,
          email: u.email || 'N/A',
          role: u.user_metadata?.role || 'user',
          created_at: u.created_at,
        }))
      );
    } catch (err) {
      toast.error('Failed to fetch users: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const createUser = async () => {
    if (!newEmail || !newPassword) {
      toast.error('Please fill in email and password');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      setIsCreating(true);

      // Create user in Supabase Auth
      const { data, error: signUpError } = await supabase.auth.admin.createUser({
        email: newEmail,
        password: newPassword,
        email_confirm: true,
        user_metadata: {
          role: selectedRole,
        },
      });

      if (signUpError) throw signUpError;
      if (!data.user) throw new Error('Failed to create user');

      // Assign role via RPC
      const { error: roleError } = await supabase.rpc('admin_assign_role_by_email', {
        p_email: newEmail.toLowerCase(),
        p_role: selectedRole,
      });

      if (roleError && roleError.message !== 'could not find the function') {
        console.warn('Role assignment warning:', roleError.message);
      }

      toast.success(`${selectedRole.toUpperCase()} account created for ${newEmail}`);
      setNewEmail('');
      setNewPassword('');
      setSelectedRole('co_admin');
      fetchUsers();
    } catch (err) {
      toast.error('Failed to create account: ' + (err as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;

      toast.success(`User ${email} deleted`);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to delete user: ' + (err as Error).message);
    }
  };

  if (!isAdmin && !isOwner) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3 border border-white/[0.08] bg-card/85 backdrop-blur-xl rounded-2xl p-5 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/15 border border-amber-500/30 flex items-center justify-center">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">User Management</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Create and manage admin and co-admin accounts</p>
          </div>
        </div>

        {/* Create New Account Card */}
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-400" />
              Create New Account
            </CardTitle>
            <CardDescription>Add a new owner or co-admin to the system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="border-amber-500/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Temporary Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="border-amber-500/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="border-amber-500/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="co_admin">Co-Admin</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="primary_scorer">Primary Scorer</SelectItem>
                    <SelectItem value="secondary_scorer">Secondary Scorer</SelectItem>
                    <SelectItem value="captain">Captain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={createUser}
              disabled={isCreating || !newEmail || !newPassword}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-2"
            >
              <Plus className="w-4 h-4" />
              {isCreating ? 'Creating...' : 'Create Account'}
            </Button>
          </CardContent>
        </Card>

        {/* Existing Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-400" />
              Existing Accounts ({users.length})
            </CardTitle>
            <CardDescription>View and manage all user accounts</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No users found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Email</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Role</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Created</th>
                      <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                        <td className="py-3 px-4">{u.email}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                              u.role === 'owner'
                                ? 'bg-amber-500/20 text-amber-300'
                                : u.role === 'co_admin'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : u.role === 'admin'
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : 'bg-white/10 text-white/70'
                            }`}
                          >
                            <Shield className="w-3 h-3" />
                            {u.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {u.email !== user?.email && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span className="hidden sm:inline">Delete</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete User?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Permanently delete {u.email}? This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteUser(u.id, u.email)}
                                    className="bg-rose-600 hover:bg-rose-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-300">
              <Lock className="w-5 h-5" />
              Account Setup Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              1. <strong>Create Account:</strong> Fill in email, password, and select a role above.
            </p>
            <p>
              2. <strong>Share Credentials:</strong> Send the email and temporary password to the new user securely.
            </p>
            <p>
              3. <strong>First Login:</strong> User logs in with provided credentials.
            </p>
            <p>
              4. <strong>Password Change:</strong> User can change their password in settings after login.
            </p>
            <hr className="border-white/10 my-4" />
            <div className="bg-white/5 p-3 rounded-lg">
              <p className="font-semibold text-white mb-2">Role Descriptions:</p>
              <ul className="space-y-1">
                <li><strong>Owner:</strong> Full system access, can manage all users and settings</li>
                <li><strong>Co-Admin:</strong> Admin privileges for auction management</li>
                <li><strong>Admin:</strong> Auction desk and player management</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
