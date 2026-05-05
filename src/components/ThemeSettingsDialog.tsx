import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Monitor, Moon, Sun, Bell, Shield, Accessibility, Mail, HelpCircle, RotateCcw } from 'lucide-react';

type ThemeMode = 'light' | 'dark' | 'system';

export function ThemeSettingsDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: { name?: string; email?: string; role?: string } | null;
}) {
  const { theme, setTheme, systemTheme } = useTheme();

  const current = (theme ?? 'system') as ThemeMode;
  const effective = useMemo(() => {
    if (current === 'system') return (systemTheme ?? 'light') as 'light' | 'dark';
    return current;
  }, [current, systemTheme]);

  const [prefs, setPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem('smartland_settings');
      return raw
        ? (JSON.parse(raw) as {
            inAppNotifications?: boolean;
            emailNotifications?: boolean;
            reduceMotion?: boolean;
            privacyMode?: boolean;
          })
        : {};
    } catch {
      return {};
    }
  });

  const inAppNotifications = prefs.inAppNotifications ?? true;
  const emailNotifications = prefs.emailNotifications ?? true;
  const reduceMotion = prefs.reduceMotion ?? false;
  const privacyMode = prefs.privacyMode ?? false;

  useEffect(() => {
    try {
      localStorage.setItem('smartland_settings', JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [prefs]);

  useEffect(() => {
    // Optional hint for CSS/animations; safe no-op if unused
    document.documentElement.toggleAttribute('data-reduce-motion', reduceMotion);
  }, [reduceMotion]);

  const safeEmail = privacyMode ? '••••••••••' : user?.email ?? '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Personalize SmartLand for this device.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="appearance" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Sun className="h-4 w-4" /> Appearance
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" /> Alerts
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center gap-2">
              <Shield className="h-4 w-4" /> Privacy
            </TabsTrigger>
            <TabsTrigger value="help" className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4" /> Help
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Theme</p>
              <RadioGroup
                value={current}
                onValueChange={(v) => setTheme(v as ThemeMode)}
                className="grid gap-2"
              >
                <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                  <RadioGroupItem value="system" id="theme-system" />
                  <Label htmlFor="theme-system" className="flex-1 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-primary" />
                      System
                      <span className="text-xs text-muted-foreground">(currently {effective})</span>
                    </span>
                  </Label>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                  <RadioGroupItem value="light" id="theme-light" />
                  <Label htmlFor="theme-light" className="flex-1 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-amber-500" />
                      Light
                    </span>
                  </Label>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                  <RadioGroupItem value="dark" id="theme-dark" />
                  <Label htmlFor="theme-dark" className="flex-1 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Moon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                      Dark
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Accessibility className="h-4 w-4 text-primary" />
                  Reduce motion
                </p>
                <p className="text-xs text-muted-foreground">Minimize animations and transitions.</p>
              </div>
              <Switch
                checked={reduceMotion}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, reduceMotion: v }))}
              />
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  In-app notifications
                </p>
                <p className="text-xs text-muted-foreground">Show alerts inside SmartLand.</p>
              </div>
              <Switch
                checked={inAppNotifications}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, inAppNotifications: v }))}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Email updates
                </p>
                <p className="text-xs text-muted-foreground">
                  Send verification and transaction updates to your email when enabled server-side.
                </p>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, emailNotifications: v }))}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Note: server-side notifications still get generated; these toggles control your local UI preferences.
            </p>
          </TabsContent>

          <TabsContent value="privacy" className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Privacy mode
                  </p>
                  <p className="text-xs text-muted-foreground">Hide personal details on-screen.</p>
                </div>
                <Switch
                  checked={privacyMode}
                  onCheckedChange={(v) => setPrefs((p) => ({ ...p, privacyMode: v }))}
                />
              </div>
              <Separator />
              <div className="text-sm text-muted-foreground">
                <p>
                  Signed in as{' '}
                  <span className="text-foreground font-medium">{user?.name ?? '—'}</span>{' '}
                  <Badge variant="outline" className="ml-2 capitalize">
                    {user?.role ?? 'user'}
                  </Badge>
                </p>
                <p className="text-xs mt-1">
                  Email: <span className="font-mono text-foreground">{safeEmail}</span>
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="help" className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <p className="text-sm font-medium text-foreground">Support</p>
              <p className="text-xs text-muted-foreground">
                Use your notification center to track verification decisions and red-flag outcomes.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText('support@smartland.local');
                    } catch {
                      // ignore
                    }
                  }}
                >
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Copy support email
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    try {
                      localStorage.removeItem('smartland_settings');
                    } catch {
                      // ignore
                    }
                    setPrefs({});
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset preferences
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Settings are saved locally in your browser/device storage.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

