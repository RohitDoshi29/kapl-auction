import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Gavel,
  LogIn,
  Shield,
  Eye,
  EyeOff,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const emailSchema = z.string().trim().email({ message: 'Please enter a valid email address' });
const passwordSchema = z.string().min(8, { message: 'Password must be at least 8 characters' });

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithPassword, isAuthenticated } = useAuth();

  const searchParams = new URLSearchParams(location.search);
  const prefillEmail = (location.state as { prefillEmail?: string } | null)?.prefillEmail || searchParams.get('email') || '';
  const initialMessage = (location.state as { message?: string } | null)?.message;

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';

  useEffect(() => {
    if (initialMessage) {
      toast.info(initialMessage);
    }
  }, [initialMessage]);

  // If already authenticated, redirect safely via useEffect
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  if (isAuthenticated) {
    return null;
  }

  const validateSignIn = () => {
    const errs: { email?: string; password?: string } = {};
    const emailRes = emailSchema.safeParse(email);
    if (!emailRes.success) {
      errs.email = emailRes.error.errors[0].message;
    }
    const passRes = passwordSchema.safeParse(password);
    if (!passRes.success) {
      errs.password = passRes.error.errors[0].message;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignIn()) return;
    setIsSubmitting(true);

    try {
      const { error } = await signInWithPassword(email, password);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password. Please try again.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Welcome back to KAPL 3.0!');
        navigate(from, { replace: true });
      }
    } catch {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 py-8 relative overflow-hidden">
      {/* Decorative Stadium Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-4">
        <Card
          className="w-full shadow-2xl border border-white/[0.1] backdrop-blur-2xl bg-card/90 relative z-10 rounded-3xl transition-all duration-300"
        >
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/30 text-black">
            <Gavel className="w-8 h-8 text-black" />
          </div>
          <div>
            <Badge variant="gold" className="mb-2 px-3 py-1 text-xs font-black tracking-wider">
              <Sparkles className="w-3 h-3 mr-1 text-amber-300" />
              KAPL 3.0 AUCTION
            </Badge>
            <CardTitle className="text-2xl md:text-3xl font-black tracking-tight font-display text-foreground">
              Auction <span className="text-gradient-gold">Sign In</span>
            </CardTitle>
            <CardDescription className="text-xs md:text-sm mt-1 text-muted-foreground">
              Sign in to access auction admin and franchise controls
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="signin-email" className="font-semibold text-xs">
                Email Address
              </Label>
              <Input
                id="signin-email"
                type="email"
                placeholder="player@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                className={errors.email ? 'border-destructive bg-white/[0.03]' : 'bg-white/[0.03] border-white/10'}
                disabled={isSubmitting}
                autoComplete="email"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signin-password">Password</Label>
              <div className="relative">
                <Input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                  disabled={isSubmitting}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            <Button type="submit" className="w-full h-11 gap-2 font-semibold" disabled={isSubmitting}>
              <LogIn className="w-4 h-4" />
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="text-center pt-2 space-y-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Live Auction
            </Link>
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
              <Shield className="w-3.5 h-3.5 text-primary" />
              Secured by Supabase Authentication • KAPL 3.0 Auction
            </p>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}


