import { ReactNode, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_DASHBOARD } from '@/lib/roleDashboard';
import { isUserRestricted } from '@/lib/identityGate';
import { UserProfileDialog } from '@/components/UserProfile';
import { NotificationCenter } from '@/components/NotificationCenter';
import { VerifyIdentityBanner } from '@/components/VerifyIdentityBanner';
import { VerificationGateDialog } from '@/components/VerificationGateDialog';
import { ThemeSettingsDialog } from '@/components/ThemeSettingsDialog';
import { User, ChevronDown, LogOut, Hexagon, Settings, Star, CreditCard, TrendingUp } from 'lucide-react';
import type { User as UserType } from '@/lib/mockData';
import { formatCurrency } from '@/lib/currency';

interface DashboardLayoutProps {
  children: ReactNode;
  role: UserType['role'];
  title: string;
  subtitle?: string;
}

const ROLE_LABELS: Record<UserType['role'], string> = {
  admin: 'Admin',
  lands_commission: 'Lands Commission',
  seller: 'Seller',
  buyer: 'Buyer',
  arbitrator: 'Arbitrator',
};

export function DashboardLayout({ children, role, title, subtitle }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const restricted = isUserRestricted(user);
  const [brandLogoOk, setBrandLogoOk] = useState(true);
  const [appLogoOk, setAppLogoOk] = useState(true);

  const appBrand = useMemo(() => {
    return { name: 'Ghana Lands Commission', logoSrc: '/brands/lands-commission-logo.jpg' };
  }, []);

  const brand = useMemo(() => {
    if (role === 'admin' || role === 'lands_commission')
      return {
        name: 'Ghana Lands Commission',
        logoSrc: '/brands/lands-commission-logo.jpg',
        backgroundSrc: '/brands/lands-commission-hq.jpg',
      };
    return null;
  }, [role]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
            <Link to={ROLE_DASHBOARD[role]} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-sm overflow-hidden relative">
                <Hexagon className="w-6 h-6 text-white" />
                {appBrand.logoSrc && appLogoOk ? (
                  <img
                    src={appBrand.logoSrc}
                    alt={`${appBrand.name} logo`}
                    className="absolute inset-0 w-full h-full object-contain bg-white p-1"
                    onError={() => setAppLogoOk(false)}
                  />
                ) : null}
                {brand?.logoSrc && brandLogoOk ? (
                  <img
                    src={brand.logoSrc}
                    alt={`${brand.name} logo`}
                    className="absolute -right-2 -bottom-2 w-6 h-6 object-contain bg-white rounded-md p-0.5 shadow-sm border border-border"
                    onError={() => setBrandLogoOk(false)}
                  />
                ) : null}
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  Ghana Land Registry
                </h1>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABELS[role]} · {brand?.name ?? 'SmartLand'}
                </p>
              </div>
            </Link>
            <NotificationCenter />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-3 hover:bg-secondary text-foreground">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{user?.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 bg-card border border-border">
                <DropdownMenuLabel className="text-foreground">Account</DropdownMenuLabel>
                {(user?.reputation || user?.creditScore || user?.financialProfile) && (
                  <>
                    <div className="px-2 py-2 space-y-2 text-xs">
                      {user.reputation && (
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-amber-500" /> Reputation</span>
                          <span className="font-medium text-foreground">{user.reputation.score} · {user.reputation.communityVotes} votes</span>
                        </div>
                      )}
                      {user.creditScore && (
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-primary" /> Credit</span>
                          <span className="font-medium text-foreground">{user.creditScore.score} · {user.creditScore.rating}</span>
                        </div>
                      )}
                      {user.financialProfile && (
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-primary" /> Net worth</span>
                          <span className="font-medium text-foreground">{formatCurrency(user.financialProfile.netWorth)}</span>
                        </div>
                      )}
                      {user.blockchainToken && (
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="flex items-center gap-1.5 text-xs">Blockchain token</span>
                          <span className="font-mono text-[10px] truncate max-w-[140px]">{user.blockchainToken.slice(0, 12)}...</span>
                        </div>
                      )}
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 hover:bg-red-50">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
            <ThemeSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} user={user} />
          </div>
        </div>
      </header>

      <VerificationGateDialog />
      <main
        className={[
          'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative overflow-hidden',
          role === 'admin'
            ? '[&_.bg-card]:bg-card/85 [&_.bg-card]:backdrop-blur-sm [&_.bg-card]:border-border/60 [&_.bg-card]:shadow-[0_18px_48px_rgba(0,0,0,0.10)]'
            : '',
        ].join(' ')}
      >
        {restricted && <VerifyIdentityBanner />}
        <div className="mb-6 p-4 rounded-xl bg-primary text-primary-foreground shadow-sm relative">
          <p className="text-xl text-white font-bold">Akwaaba, {user?.name?.split(' ')[0]}!</p>
          <p className="text-primary-foreground/85 text-sm mt-0.5">Welcome to Ghana Land Registry</p>
        </div>
        <div className="mb-8 relative">
          <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="relative">
          {children}
        </div>
      </main>
    </div>
  );
}
