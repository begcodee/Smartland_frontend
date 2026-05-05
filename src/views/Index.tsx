import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Shield, Mail, Lock, Eye, EyeOff,
  UserPlus, LogIn, ShieldCheck, Gavel, MapPin, ShoppingBag, UserRound, Fingerprint
} from 'lucide-react';
import { toast } from '@/lib/appToast';
import { NewUserRegistrationFlow } from '@/components/NewUserRegistrationFlow';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_DASHBOARD } from '@/lib/roleDashboard';
import type { User } from '@/lib/mockData';
import { api } from '@/lib/api';
import { normalizeBackendRole } from '@/lib/backendRole';
import { shouldForceBuyerSellerVerificationRoute } from '@/lib/verificationRouting';
import { readBackendIdentityReferenceId, readBackendIdentityStatus } from '@/lib/backendIdentity';

type Role = User['role'];

function AuthBackgroundVideo() {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const tryPlay = async () => {
      try {
        await el.play();
      } catch {
        // Autoplay can be blocked on some devices; keep UI usable.
      }
    };

    const onPause = () => void tryPlay();
    const onEnded = () => void tryPlay();
    const onVisibility = () => {
      if (!document.hidden) void tryPlay();
    };

    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    document.addEventListener('visibilitychange', onVisibility);
    void tryPlay();

    return () => {
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <video
      ref={ref}
      className="absolute inset-0 w-full h-full object-cover opacity-85 contrast-115 saturate-110 pointer-events-none"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
    >
      <source src="/auth-bg.mp4" type="video/mp4" />
    </video>
  );
}

export default function Index() {
  const { isAuthenticated, user, login, refreshUser, authReady, authHydrating } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showNewUserFlow, setShowNewUserFlow] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginRole, setLoginRole] = useState<Role | ''>('');
  const [roleCredential, setRoleCredential] = useState('');

  if (!authReady || authHydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    if (shouldForceBuyerSellerVerificationRoute(user)) {
      return <Navigate to="/verification-status" replace />;
    }

    return <Navigate to={ROLE_DASHBOARD[user.role]} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveRole: Role = loginRole || (
      /admin|landregistry\.gh|ghanalandcommission/i.test(email) ? 'admin' :
      /lands\\s*commission|commission|glc/i.test(email) ? 'lands_commission' :
      /seller|john\.doe/i.test(email) ? 'seller' :
      /buyer|akosua|frimpong/i.test(email) ? 'buyer' :
      /arbitrator|ama\.osei/i.test(email) ? 'arbitrator' : 'seller'
    );
    if (effectiveRole === 'admin' && !roleCredential.trim()) {
      toast.error('Staff ID is required for Ghana Lands Commission admin login');
      return;
    }
    if (effectiveRole === 'arbitrator' && !roleCredential.trim()) {
      toast.error('Arbitrator registration number is required');
      return;
    }
    setIsLoading(true);
    try {
      const staffId =
        effectiveRole === 'admin' || effectiveRole === 'lands_commission' ? roleCredential.trim() || undefined : undefined;
      const arbitratorRegNo = effectiveRole === 'arbitrator' ? roleCredential.trim() || undefined : undefined;
      const res = await api.login(email, password, effectiveRole, staffId, arbitratorRegNo);
      const token = (res as { token?: string }).token;
      // Backend returns { token, user }; api.login stores token in localStorage.
      if (res.user && (token || (res as { success?: boolean }).success)) {
        const u = res.user;
        const mappedUser: User = {
          id: u.id,
          name: u.name,
          email: u.email,
          role: normalizeBackendRole(u.role as string | undefined),
          verificationStatus: u.verified ? 'verified' : u.verificationStatus || 'pending',
          country: u.country || 'GH',
          phoneNumber: u.phoneNumber,
          organization: u.organization,
          staffId: u.staffId,
          arbitratorRegNo: u.arbitratorRegNo,
          blockchainToken: u.blockchainToken,
          idVerification: u.idVerification,
          identityStatus: (readBackendIdentityStatus(u) ?? undefined) as User['identityStatus'] | undefined,
          identityReferenceId: readBackendIdentityReferenceId(u),
          reputation: u.reputation,
          creditScore: u.creditScore,
          financialProfile: u.financialProfile
        } as User;
        const identityState = readBackendIdentityStatus(u) ?? undefined;
        if (fullName.trim()) mappedUser.name = fullName.trim();
        login(mappedUser);
        await refreshUser();
        setIsLoading(false);
        const firstName = mappedUser.name.split(' ')[0];
        toast.success(`Akwaaba, ${firstName}!`);
        if (mappedUser.role === 'buyer' || mappedUser.role === 'seller') {
          if (identityState === 'verified') {
            toast.message('Identity verification', {
              description: 'Your Ghana Card check is approved. Ghana Lands Commission may still review your account.',
              duration: 8000,
            });
          } else if (identityState === 'rejected') {
            toast.error('Identity verification', {
              description:
                'Your Ghana Card check was not approved. Open your dashboard for details, or contact support if this is unexpected.',
              duration: 12000,
            });
          }
        }
        return;
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Sign-in failed. Is the backend running on port 3001?'
      );
      setIsLoading(false);
      return;
    }
    setIsLoading(false);
    toast.error('Could not complete sign-in. Check your email and password, or create an account.');
  };

  if (showNewUserFlow) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-transparent">
        <AuthBackgroundVideo />
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/20 to-black/70" />
        <div className="w-full max-w-2xl relative z-10">
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">New user registration</h1>
            <p className="text-slate-200/90 font-medium">Ghana Card, land documents & Ghana Lands Commission verification</p>
          </div>
          <NewUserRegistrationFlow
            onSuccess={async (user) => {
              setShowNewUserFlow(false);
              login(user);
              await refreshUser();
            }}
            onBack={() => setShowNewUserFlow(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-transparent">
      <AuthBackgroundVideo />
      <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/20 to-black/70" />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-[0_12px_30px_rgba(0,0,0,0.55)] ring-1 ring-white/20 bg-white/90 overflow-hidden">
            <img
              src="/brands/lands-commission-logo.jpg"
              alt="Ghana Lands Commission logo"
              className="w-full h-full object-contain p-2"
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                el.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
            Ghana Land Registry
          </h1>
          <p
            className="text-white/95 font-semibold text-lg md:text-xl tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]"
            style={{ fontFamily: 'cursive' }}
          >
            Clients satisfaction is our goal
          </p>
          <p className="text-slate-300/80 text-sm mt-1">Ghana Lands Commission</p>
        </div>

        <Card className="bg-black/45 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,0,0,0.55)] border border-white/10 rounded-2xl overflow-hidden">
          <CardHeader className="pb-4 bg-black/25 border-b border-white/10">
            <Tabs value={authMode} onValueChange={(v) => setAuthMode(v as 'login' | 'register')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 h-12 p-1 bg-white/10 rounded-xl">
                <TabsTrigger value="login" className="text-slate-200 data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:shadow rounded-lg">
                  <LogIn className="w-4 h-4 mr-2" /> Returning user
                </TabsTrigger>
                <TabsTrigger value="register" className="text-slate-200 data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:shadow rounded-lg">
                  <UserPlus className="w-4 h-4 mr-2" /> New user
                </TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <CardTitle className="text-2xl font-semibold text-white">Sign in</CardTitle>
                <CardDescription className="text-slate-200/80 font-medium">Sign in with your role — Admin & Arbitrator need extra credentials</CardDescription>
              </TabsContent>
              <TabsContent value="register">
                <CardTitle className="text-2xl font-semibold text-white">Create account</CardTitle>
                <CardDescription className="text-slate-200/80 font-medium">
                  Register to explore the app. Ghana Lands Commission verification is not instant — expect email updates within 24–48 hours after you submit documents.
                </CardDescription>
              </TabsContent>
            </Tabs>
          </CardHeader>

          <CardContent>
            <Tabs value={authMode} onValueChange={(v) => setAuthMode(v as 'login' | 'register')}>
              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-100/90">I am a</Label>
                    <Select value={loginRole || 'buyer'} onValueChange={(v) => { setLoginRole(v as Role); setRoleCredential(''); }}>
                      <SelectTrigger className="w-full bg-white/10 border-white/15 text-slate-50 placeholder:text-slate-300/70">
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buyer"><ShoppingBag className="w-4 h-4 mr-2 inline" /> Buyer</SelectItem>
                        <SelectItem value="seller"><MapPin className="w-4 h-4 mr-2 inline" /> Seller</SelectItem>
                        {/* <SelectItem value="admin"><ShieldCheck className="w-4 h-4 mr-2 inline" /> Admin (Ghana Lands Commission)</SelectItem> */}
                        <SelectItem value="lands_commission"><Fingerprint className="w-4 h-4 mr-2 inline" /> Lands Commission (Verification)</SelectItem>
                        <SelectItem value="arbitrator"><Gavel className="w-4 h-4 mr-2 inline" /> Arbitrator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(loginRole === 'admin' || loginRole === 'lands_commission' || loginRole === 'arbitrator') && (
                    <div className="space-y-2">
                      <Label className="text-slate-100/90">
                        {loginRole === 'admin' || loginRole === 'lands_commission'
                          ? 'Staff ID (Lands Commission)'
                          : 'Arbitrator registration no.'}
                      </Label>
                      <Input
                        placeholder={loginRole === 'admin' || loginRole === 'lands_commission' ? 'e.g. GLC-EMP-2024-001' : 'e.g. ARB-GH-2023-045'}
                        value={roleCredential}
                        onChange={(e) => setRoleCredential(e.target.value)}
                        className="pl-10 bg-white/10 border-white/15 text-slate-50 placeholder:text-slate-300/70"
                        required={loginRole === 'admin' || loginRole === 'lands_commission' || loginRole === 'arbitrator'}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-slate-100/90">Full Name</Label>
                    <div className="relative">
                      <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-200/70 w-4 h-4" />
                      <Input id="fullName" type="text" placeholder="e.g. Akosua Frimpong" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-10 bg-white/10 border-white/15 text-slate-50 placeholder:text-slate-300/70" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-100/90">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-200/70 w-4 h-4" />
                      <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-white/10 border-white/15 text-slate-50 placeholder:text-slate-300/70" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-100/90">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-200/70 w-4 h-4" />
                      <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10 bg-white/10 border-white/15 text-slate-50 placeholder:text-slate-300/70" required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-200/70 hover:text-white">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-12 text-base font-semibold bg-white/20 hover:bg-white/25 text-white border border-white/15" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign in'}
                  </Button>
                  {/* <p className="text-xs text-slate-200/70 text-center">
                    Demo: Buyer akosua.frimpong@yahoo.com · Seller john.doe@gmail.com · Lands Commission admin admin@ghanalandcommission.gov.gh + GLC-EMP-2024-001 · Arbitrator ama.osei@arbitrator.gh + ARB-GH-2023-045
                  </p> */}
                </form>
              </TabsContent>

              <TabsContent value="register" className="space-y-4">
                <div className="space-y-4">
                  <p className="text-sm text-slate-200/80">
                    Sign up takes under a minute. After registering you can explore the platform immediately.
                    Complete Ghana Card verification from your dashboard to unlock full access.
                  </p>
                  <ul className="text-sm text-slate-200/80 space-y-1.5 list-inside">
                    <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 font-bold">1</span> Enter your name, email, phone &amp; role</li>
                    <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 font-bold">2</span> Sign in and explore the platform</li>
                    <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-accent text-accent-foreground text-xs flex items-center justify-center shrink-0 font-bold">3</span> Verify your Ghana Card to unlock transactions</li>
                  </ul>
                  <Button onClick={() => setShowNewUserFlow(true)} className="w-full h-12 text-base font-semibold bg-white/20 hover:bg-white/25 text-white border border-white/15">
                    Create account
                  </Button>
                  <p className="text-xs text-slate-200/70 text-center">
                    Need to <strong className="text-slate-100">verify applicants</strong>? Choose role <strong className="text-slate-100">Lands Commission (Verification)</strong> above (staff ID required). Arbitrators are assigned by Ghana Lands Commission and cannot self-register.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-200/70 font-medium mt-6">Secure land registry · Ghana Card verification · Blockchain & SSI</p>
      </div>
    </div>
  );
}
