
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  User, Mail, Lock, Phone, Building, Eye, EyeOff,
  ShieldCheck, Loader2, InfoIcon
} from 'lucide-react';
import { toast } from '@/lib/appToast';
import type { User as UserType } from '@/lib/mockData';
import { api } from '@/lib/api';
import { normalizeBackendRole } from '@/lib/backendRole';
import { readBackendIdentityReferenceId, readBackendIdentityStatus } from '@/lib/backendIdentity';
import {
  isSignupEmailConfigured,
  sendSignupConfirmationEmail,
} from '@/lib/sendSignupConfirmationEmail';
import { VerificationTimelineDialog } from '@/components/VerificationTimelineDialog';
import {
  SIGNUP_PENDING_DESCRIPTION,
  VERIFICATION_HOURS_RANGE,
  SIGNUP_TIMELINE_BUYER,
  SIGNUP_TIMELINE_LANDOWNER,
} from '@/lib/verificationMessaging';

type Role = UserType['role'];

const REG_FORM_DRAFT_KEY = 'smartland_registration_form_draft_v1';

const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  { value: 'buyer', label: 'Buyer / Investor', description: 'Search and purchase land — Ghana Card is used for identity verification.' },
  {
    value: 'seller',
    label: 'Landowner / Seller (or agent)',
    description:
      'After login: (1) Ghana Card verification. (2) Then land documents when you register each parcel — Ghana Lands Commission reviews those separately.',
  },
  // { value: 'admin', label: 'Admin (Ghana Lands Commission)', description: 'Oversee registry and users' },
  { value: 'lands_commission', label: 'Lands Commission (Verification)', description: 'Review Ghana Card submissions and verification audit trail' },
  { value: 'arbitrator', label: 'Arbitrator (Dispute Resolution)', description: 'Neutral dispute resolver — reviews evidence and records decisions.' },
];

interface NewUserRegistrationFlowProps {
  onSuccess: (user: UserType) => void | Promise<void>;
  onBack: () => void;
}

const defaultFormData = {
  name: '',
  email: '',
  phoneNumber: '',
  role: 'buyer' as Role,
  organization: '',
  password: '',
  confirmPassword: '',
  staffId: '',
  arbitratorRegNo: '',
};

function readRegistrationDraft() {
  try {
    const raw = localStorage.getItem(REG_FORM_DRAFT_KEY);
    if (!raw) return defaultFormData;
    const p = JSON.parse(raw) as Record<string, unknown>;
    const roleFromStore = p.role as Role | undefined;
    const role = ROLE_OPTIONS.some((o) => o.value === roleFromStore) ? roleFromStore! : 'buyer';
    return {
      name: typeof p.name === 'string' ? p.name : '',
      email: typeof p.email === 'string' ? p.email : '',
      phoneNumber: typeof p.phoneNumber === 'string' ? p.phoneNumber : '',
      role,
      organization: typeof p.organization === 'string' ? p.organization : '',
      password: '',
      confirmPassword: '',
      staffId: typeof p.staffId === 'string' ? p.staffId : '',
      arbitratorRegNo: typeof p.arbitratorRegNo === 'string' ? p.arbitratorRegNo : '',
    };
  } catch {
    return defaultFormData;
  }
}

export function NewUserRegistrationFlow({ onSuccess, onBack }: NewUserRegistrationFlowProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [registeredUser, setRegisteredUser] = useState<UserType | null>(null);

  const [formData, setFormData] = useState(readRegistrationDraft);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const safe = {
          name: formData.name,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          role: formData.role,
          organization: formData.organization,
          staffId: formData.staffId,
          arbitratorRegNo: formData.arbitratorRegNo,
        };
        localStorage.setItem(REG_FORM_DRAFT_KEY, JSON.stringify(safe));
      } catch {
        // quota / private mode
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [
    formData.name,
    formData.email,
    formData.phoneNumber,
    formData.role,
    formData.organization,
    formData.staffId,
    formData.arbitratorRegNo,
  ]);

  const canSubmit =
    formData.name.trim().length >= 2 &&
    formData.email.trim() &&
    formData.phoneNumber.trim().length >= 7 &&
    formData.password.length >= 8 &&
    formData.password === formData.confirmPassword &&
    (formData.role !== 'admin' ||
      (formData.organization.trim().length > 0 && formData.staffId.trim().length >= 2)) &&
    (formData.role !== 'lands_commission' ||
      (formData.organization.trim().length > 0 && formData.staffId.trim().length >= 2)) &&
    (formData.role !== 'arbitrator' ||
      (formData.organization.trim().length > 0 && formData.arbitratorRegNo.trim().length >= 4));

  const mapBackendUserToLocalUser = (raw: Record<string, unknown>): UserType => {
    const verificationStatus: UserType['verificationStatus'] =
      raw.verified === true
        ? 'verified'
        : raw.verificationStatus === 'rejected' || raw.rejectionReason
          ? 'rejected'
          : 'pending';

    return {
      id: String(raw.id ?? ''),
      name: String(raw.name ?? ''),
      email: String(raw.email ?? ''),
      role: normalizeBackendRole(raw.role as string | undefined),
      verificationStatus,
      country: String(raw.country || 'GH'),
      phoneNumber: String(raw.phoneNumber ?? ''),
      organization: raw.organization != null ? String(raw.organization) : undefined,
      staffId: raw.staffId != null ? String(raw.staffId) : undefined,
      arbitratorRegNo: raw.arbitratorRegNo != null ? String(raw.arbitratorRegNo) : undefined,
      identityStatus: (readBackendIdentityStatus(raw) ?? undefined) as UserType['identityStatus'] | undefined,
      identityReferenceId: readBackendIdentityReferenceId(raw),
      idVerification:
        raw.idVerification && typeof raw.idVerification === 'object'
          ? (raw.idVerification as UserType['idVerification'])
          : undefined,
    } as UserType;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    let resMsg: string | undefined;
    try {
      let newUser: UserType;

      try {
        // Try real backend registration
        const registerPayload = {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phoneNumber: formData.phoneNumber.trim(),
          role: formData.role,
          organization: formData.organization.trim() || undefined,
          password: formData.password,
          staffId: (formData.role === 'admin' || formData.role === 'lands_commission') ? formData.staffId.trim() : undefined,
          arbitratorRegNo: formData.role === 'arbitrator' ? formData.arbitratorRegNo.trim() : undefined,
        };
        const res = await api.register(registerPayload);
        resMsg = (res as { message?: string }).message;

        // Ensure we have a valid auth token after signup so verification can start immediately.
        let hasToken = false;
        try {
          hasToken = Boolean(localStorage.getItem('smartland_token'));
        } catch {
          hasToken = false;
        }

        const rawFromRegister = (res.user ?? {}) as Record<string, unknown>;
        if (!hasToken) {
          const loginRes = await api.login(
            registerPayload.email,
            registerPayload.password,
            registerPayload.role,
            registerPayload.staffId,
            registerPayload.arbitratorRegNo
          );
          const rawFromLogin = (loginRes.user ?? rawFromRegister) as Record<string, unknown>;
          newUser = mapBackendUserToLocalUser(rawFromLogin);
        } else {
          newUser = mapBackendUserToLocalUser(rawFromRegister);
        }
      } catch (apiErr) {
        const apiMsg = apiErr instanceof Error ? apiErr.message : '';
        if (/already exists|email already exists/i.test(apiMsg)) {
          toast.error('An account with this email already exists. Please sign in.');
          return;
        }
        toast.error(
          apiMsg.trim() ||
            'Could not reach the server to create your account. Start the backend (port 3001) and try again.'
        );
        return;
      }

      try {
        localStorage.removeItem(REG_FORM_DRAFT_KEY);
      } catch {
        // ignore
      }

      let emailSent = false;
      if (isSignupEmailConfigured()) {
        try {
          await sendSignupConfirmationEmail({
            toEmail: newUser.email,
            name: newUser.name,
          });
          emailSent = true;
        } catch {
          // Registration already succeeded; email is best-effort
        }
      }

      setRegisteredUser(newUser);
      setTimelineOpen(true);
      const roleBlurb =
        newUser.role === 'seller'
          ? SIGNUP_TIMELINE_LANDOWNER
          : newUser.role === 'buyer'
            ? SIGNUP_TIMELINE_BUYER
            : SIGNUP_PENDING_DESCRIPTION;
      const apiDesc = typeof resMsg !== 'undefined' ? resMsg : roleBlurb;
      toast.success(`Welcome, ${newUser.name}!`, {
        description: emailSent
          ? `${apiDesc} We sent a confirmation to ${newUser.email}.`
          : apiDesc,
        duration: 10000,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Create your account
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {formData.role === 'seller' ? (
            <>
              Landowners complete <strong className="text-foreground">Ghana Card verification</strong>, then add{' '}
              <strong className="text-foreground">land documentation</strong> when registering each parcel for{' '}
              <strong className="text-foreground">Ghana Lands Commission</strong>.
            </>
          ) : formData.role === 'buyer' ? (
            <>
              Buyers and investors are verified via Ghana Card — no separate Lands Commission account queue.
            </>
          ) : (
            <>
              Staff accounts use organisation credentials. Other roles complete Ghana Card where applicable.
            </>
          )}{' '}
          Email updates typically arrive within {VERIFICATION_HOURS_RANGE}.
          <span className="block mt-2 text-xs">
            This form is saved automatically on this device until you register successfully — you can leave and continue later. Password fields are never stored; re-enter them when you return.
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Alert className="mb-5 border-primary/30 bg-primary/8">
          <InfoIcon className="h-4 w-4 text-primary" />
          <AlertDescription className="text-foreground text-sm">
            {formData.role === 'seller' ? (
              <>
                <strong>Landowner path:</strong> After login you will submit your Ghana Card to the{' '}
                <strong>verification queue</strong> first. Only after your identity is cleared do you upload{' '}
                <strong>land documents</strong> (e.g. title, survey) in the registry — those go to{' '}
                <strong>Ghana Lands Commission</strong> for each parcel. Verification is <strong>not immediate</strong> (
                {VERIFICATION_HOURS_RANGE}).
              </>
            ) : formData.role === 'buyer' ? (
              <>
                <strong>Buyer path:</strong> After login, Ghana Card verification is used for identity. Expect email within{' '}
                <strong>{VERIFICATION_HOURS_RANGE}</strong>.
              </>
            ) : (
              <>
                <strong>Staff sign-up:</strong> Use your organisation and staff ID. Ghana Card rules may still apply depending on policy — verification is{' '}
                <strong>not immediate</strong> where applicable ({VERIFICATION_HOURS_RANGE}).
              </>
            )}
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role picker */}
          <div className="space-y-2">
            <Label className="text-foreground">I am a *</Label>
            <Select
              value={formData.role}
              onValueChange={(v) =>
                setFormData({ ...formData, role: v as Role, staffId: '', arbitratorRegNo: '' })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className="font-medium">{o.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {ROLE_OPTIONS.find((o) => o.value === formData.role)?.description}
            </p>
          </div>

          {formData.role === 'seller' && (
            <Alert className="border-amber-300/80 bg-amber-50/90 dark:bg-amber-950/25 dark:border-amber-800">
              <InfoIcon className="h-4 w-4 text-amber-700 dark:text-amber-400" />
              <AlertDescription className="text-sm text-amber-950 dark:text-amber-100">
                <strong className="text-foreground">Order matters:</strong> land documentation is collected when you{' '}
                <strong>register a parcel</strong> on the seller dashboard — that submission is what Ghana Lands Commission reviews for permission to list.
              </AlertDescription>
            </Alert>
          )}

          {/* Staff / arbitrator extras */}
          {(formData.role === 'admin' || formData.role === 'lands_commission' || formData.role === 'arbitrator') && (
            <div className="space-y-3 p-3 rounded-lg border border-border bg-secondary/40">
              <div className="space-y-2">
                <Label className="text-foreground">Organization *</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder={
                      formData.role === 'arbitrator'
                        ? 'e.g. Ghana Arbitration Centre'
                        : 'e.g. Ghana Lands Commission'
                    }
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">
                  {formData.role === 'arbitrator' ? 'Arbitrator registration number *' : 'Staff ID *'}
                </Label>
                <Input
                  placeholder={formData.role === 'arbitrator' ? 'e.g. ARB-GH-2023-045' : 'e.g. GLC-EMP-2024-001'}
                  value={formData.role === 'arbitrator' ? formData.arbitratorRegNo : formData.staffId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      staffId: formData.role === 'arbitrator' ? formData.staffId : e.target.value,
                      arbitratorRegNo: formData.role === 'arbitrator' ? e.target.value : formData.arbitratorRegNo,
                    })
                  }
                  required
                  minLength={formData.role === 'arbitrator' ? 4 : 2}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.role === 'admin' || formData.role === 'lands_commission'
                    ? 'Issued by Ghana Lands Commission. Required for staff access.'
                    : 'Issued by an accredited arbitration body. Required for arbitrator access.'}
                </p>
              </div>
            </div>
          )}

          {/* Full name */}
          <div className="space-y-2">
            <Label className="text-foreground">Full name *</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Your full name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label className="text-foreground">Email address *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label className="text-foreground">Phone number *</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="tel"
                placeholder="+233 24 123 4567"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="pl-10"
                required
                minLength={7}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label className="text-foreground">Password * <span className="text-xs text-muted-foreground">(min 8 characters)</span></Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="pl-10 pr-10"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className="space-y-2">
            <Label className="text-foreground">Confirm password *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Repeat your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className={`pl-10 ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-destructive' : ''}`}
                required
              />
            </div>
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onBack} className="shrink-0">
              Back
            </Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting} className="flex-1">
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating account...</>
              ) : (
                'Create account & sign in'
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center pt-1">
            Dispute resolution is handled by neutral arbitrators. Use an accredited registration number for arbitrator access.
          </p>
        </form>
      </CardContent>
    </Card>

    <VerificationTimelineDialog
      open={timelineOpen}
      onOpenChange={(open) => {
        setTimelineOpen(open);
        if (!open && registeredUser) {
          onSuccess(registeredUser);
          setRegisteredUser(null);
        }
      }}
      context="signup"
      accountRole={registeredUser?.role ?? formData.role}
    />
    </>
  );
}
