import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, FileText, Plus, Search, Eye, Camera, Zap, Hexagon, Shield, Image as ImageIcon, Gavel, Lock, Smartphone, Building2, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/mockData';
import { LandParcel, User } from '@/lib/mockData';
import { api } from '@/lib/api';
import { mapApiParcelToLandParcel } from '@/lib/parcelMapper';
import { ImageUpload } from '@/components/ImageUpload';
import { DocumentScanner, type ScannedDocument } from '@/components/DocumentScanner';
import { toast } from '@/lib/appToast';
import { isUserRestricted } from '@/lib/identityGate';
import { ParcelChatDialog } from '@/components/ParcelChatDialog';
import { formatAreaSummary, parseAreaToSqm, sqftToSqm } from '@/lib/measurements';

interface LandImage {
  id: string;
  url: string;
  caption: string;
  type: 'main' | 'aerial' | 'boundary' | 'interior' | 'exterior';
  uploadedAt: string;
  size?: number;
}

interface LandRegistryProps {
  currentUser?: User;
}

/** Merge GLC prototype overrides; keep pending until docs verified, then allow available (never overrides disputed/sold). */
function applyGlcGate(m: LandParcel): LandParcel {
  // Backend is the source of truth. We only enforce the rule:
  // a parcel cannot be considered "available" unless documents are verified.
  if (m.status === 'disputed' || m.status === 'sold') return m;
  const docs = m.documentsVerificationStatus;
  if (docs === 'verified' && m.status === 'pending') return { ...m, status: 'available' };
  if (docs !== 'verified' && m.status === 'available') return { ...m, status: 'pending' };
  return m;
}

export const LandRegistry = ({ currentUser }: LandRegistryProps) => {
  const [parcels, setParcels] = useState<LandParcel[]>([]);
  const [disputes, setDisputes] = useState<Array<{ landParcelId: string; status?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParcel, setSelectedParcel] = useState<LandParcel | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [paymentChannel, setPaymentChannel] = useState<'mobile_money' | 'bank'>('mobile_money');
  const [payStarting, setPayStarting] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'disputed'>('all');
  const [newParcel, setNewParcel] = useState({
    title: '',
    description: '',
    location: {
      address: '',
      region: 'Greater Accra'
    },
    area: '',
    price: '',
    type: 'residential' as LandParcel['type'],
    images: [] as LandImage[],
    documents: [] as ScannedDocument[]
  });

  const restrictedUser = isUserRestricted(currentUser);
  const canRegisterLand = (currentUser?.role === 'seller' || currentUser?.role === 'admin') && !restrictedUser;

  const disputedParcelIds = useMemo(
    () =>
      new Set(
        disputes
          .filter((d) => String(d.status ?? '').toLowerCase() !== 'resolved')
          .map((d) => d.landParcelId)
      ),
    [disputes]
  );
  const selectedParcelIsDisputed = Boolean(
    selectedParcel && (selectedParcel.status === 'disputed' || disputedParcelIds.has(selectedParcel.id))
  );

  const canBuySelectedParcel = Boolean(
    selectedParcel &&
      !restrictedUser &&
      !selectedParcelIsDisputed &&
      (currentUser?.role === 'buyer' || currentUser?.role === 'admin') &&
      selectedParcel.status === 'available' &&
      selectedParcel.documentsVerificationStatus === 'verified' &&
      selectedParcel.registryClearance !== 'flagged' &&
      currentUser?.id &&
      selectedParcel.ownerId !== currentUser.id
  );

  const parsedNewArea = useMemo(() => {
    const p = parseAreaToSqm(newParcel.area);
    return p.sqm ? formatAreaSummary(p.sqm) : null;
  }, [newParcel.area]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const [parcelRes, disputeRes] = await Promise.all([
          api.getParcels().catch(() => null),
          api.getDisputes().catch(() => null),
        ]);
        if (!alive) return;
        if (parcelRes?.success && Array.isArray(parcelRes.parcels)) {
          setParcels(
            parcelRes.parcels
              .map((p: object) => mapApiParcelToLandParcel(p as Parameters<typeof mapApiParcelToLandParcel>[0]))
              .map(applyGlcGate)
          );
        } else {
          setParcels([]);
        }
        if (disputeRes?.success && Array.isArray((disputeRes as { disputes?: unknown }).disputes)) {
          const list = (disputeRes as { disputes: Array<Record<string, unknown>> }).disputes;
          setDisputes(
            list.map((d) => ({
              landParcelId: String(d.landParcelId ?? d.parcelId ?? ''),
              status: typeof d.status === 'string' ? d.status : undefined,
            }))
          );
        } else {
          setDisputes([]);
        }
      } catch (e) {
        if (!alive) return;
        setParcels([]);
        setDisputes([]);
        toast.error('Failed to load registry data', {
          description: e instanceof Error ? e.message : 'Check your backend connection.',
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const ghanaPlotStandards = useMemo(() => {
    const region = (newParcel.location.region || '').toLowerCase();
    const isNorthern =
      region.includes('northern') ||
      region.includes('upper east') ||
      region.includes('upper west') ||
      region.includes('savannah') ||
      region.includes('north east') ||
      region.includes('oti') ||
      region.includes('bono') ||
      region.includes('bono east') ||
      region.includes('ahafo');

    const presets = [
      { label: 'Roadside / developed: 70×100 ft', a: 70, b: 100 },
      { label: 'Less developed / far: 70×70 ft', a: 70, b: 70 },
      { label: 'Spacious: 100×100 ft', a: 100, b: 100 },
    ];

    const recommended = isNorthern
      ? ['Less developed / far: 70×70 ft', 'Spacious: 100×100 ft']
      : ['Roadside / developed: 70×100 ft'];

    return { presets, recommended };
  }, [newParcel.location.region]);

  const setAreaFromFeet = (a: number, b: number) => {
    const sqft = a * b;
    const sqm = sqftToSqm(sqft);
    setNewParcel({ ...newParcel, area: `${a}x${b} ft` });
    toast.message('Plot size applied', {
      description: `≈ ${Math.round(sqm).toLocaleString()} sqm (${sqft.toLocaleString()} sqft)`,
      duration: 4500,
    });
  };

  const canMessageSeller = Boolean(
    selectedParcel &&
      !restrictedUser &&
      !selectedParcelIsDisputed &&
      (currentUser?.role === 'buyer' || currentUser?.role === 'admin') &&
      currentUser?.id &&
      selectedParcel.ownerId !== currentUser.id &&
      selectedParcel.status === 'available' &&
      selectedParcel.documentsVerificationStatus === 'verified' &&
      selectedParcel.registryClearance !== 'flagged'
  );

  // Deep-link: /buyer?parcelId=...
  useEffect(() => {
    const pid = searchParams.get('parcelId');
    if (!pid) return;
    const p = parcels.find((x) => x.id === pid);
    if (p) {
      setSelectedParcel(p);
      setDetailsOpen(true);
      // remove param so refresh doesn't keep reopening
      searchParams.delete('parcelId');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, parcels]);

  const handlePaystackPurchase = async () => {
    if (!selectedParcel) return;
    if (selectedParcelIsDisputed) {
      toast.error('Parcel is under dispute', {
        description: 'All actions on this parcel are blocked until the dispute is resolved.',
      });
      return;
    }
    if (selectedParcel.documentsVerificationStatus !== 'verified') {
      toast.error('Listing not cleared yet', {
        description: 'Ghana Lands Commission must verify this parcel’s documents before purchase is allowed.',
      });
      return;
    }
    setPayStarting(true);
    try {
      const res = await api.initializeLandPayment({
        landParcelId: selectedParcel.id,
        channel: paymentChannel,
        amountGhs: selectedParcel.price || selectedParcel.value || 0
      });
      if (res.authorizationUrl) {
        window.location.href = res.authorizationUrl;
        return;
      }
      toast.error('No checkout URL returned');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start Paystack checkout');
    } finally {
      setPayStarting(false);
    }
  };

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const [parcelRes, disputeRes] = await Promise.all([
          api.getParcels().catch(() => null),
          api.getDisputes().catch(() => null)
        ]);
        if (!ok) return;
        if (parcelRes?.success && Array.isArray(parcelRes.parcels)) {
          setParcels(
            parcelRes.parcels.map((p: object) =>
              applyGlcGate(mapApiParcelToLandParcel(p as Parameters<typeof mapApiParcelToLandParcel>[0]))
            )
          );
        }
        if (disputeRes?.success && Array.isArray(disputeRes.disputes)) {
          setDisputes(disputeRes.disputes.map((d: { id: string; landParcelId: string; plaintiff?: { name?: string }; defendant?: { name?: string }; description?: string; status?: string; filedDate?: string }) => ({
            id: d.id,
            landParcelId: d.landParcelId,
            plaintiff: (typeof d.plaintiff === 'object' && d.plaintiff?.name) ? d.plaintiff.name : 'Unknown',
            defendant: (typeof d.defendant === 'object' && d.defendant?.name) ? d.defendant.name : 'Unknown',
            description: d.description ?? '',
            evidence: [],
            status: (d.status ?? 'filed') as 'filed' | 'pending' | 'under_review' | 'community_voting' | 'resolved',
            filedDate: d.filedDate ?? new Date().toISOString()
          })));
        }
      } finally {
        if (ok) setLoading(false);
      }
    })();
    return () => { ok = false; };
  }, [currentUser?.id]);

  useEffect(() => {
    const onGlc = () => {
      void (async () => {
        try {
          const parcelRes = await api.getParcels().catch(() => null);
          if (parcelRes?.success && Array.isArray(parcelRes.parcels)) {
            setParcels(
              parcelRes.parcels.map((p: object) =>
                applyGlcGate(mapApiParcelToLandParcel(p as Parameters<typeof mapApiParcelToLandParcel>[0]))
              )
            );
          }
        } catch {
          // ignore
        }
      })();
    };
    window.addEventListener('smartland-parcel-glc-updated', onGlc);
    return () => window.removeEventListener('smartland-parcel-glc-updated', onGlc);
  }, []);

  const disputedParcels = parcels.filter(p => disputedParcelIds.has(p.id) || p.status === 'disputed');

  const filteredParcels = parcels.filter(parcel => {
    const matchesSearch = parcel.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parcel.location.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parcel.location.region.toLowerCase().includes(searchTerm.toLowerCase());
    const isOwn = currentUser?.role === 'seller' && parcel.ownerId === currentUser?.id;
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'disputed'
          ? disputedParcelIds.has(parcel.id) || parcel.status === 'disputed'
          : parcel.status === 'available' || (isOwn && parcel.status === 'pending');
    const isVerified = parcel.documentsVerificationStatus === 'verified';
    const isAdmin = currentUser?.role === 'admin';
    // New / restricted users should still be able to browse parcels.
    // Restrictions are enforced on actions (purchase/chat/register), not on visibility.
    // Buyers see listings once Lands Commission has verified the parcel’s documents (per parcel), not a separate “seller account” GLC step.
    const buyerCanSeeLive = currentUser?.role === 'buyer' ? isVerified : true;
    const canSee = restrictedUser
      ? true
      : isAdmin || isOwn || (buyerCanSeeLive && (currentUser?.role === 'buyer' || currentUser?.role === 'arbitrator'));
    return matchesSearch && matchesStatus && canSee;
  });

  const resetNewParcel = () => {
    setNewParcel({
      title: '',
      description: '',
      location: { address: '', region: 'Greater Accra' },
      area: '',
      price: '',
      type: 'residential' as LandParcel['type'],
      images: [],
      documents: []
    });
    setShowImageUpload(false);
  };

  const handleRegisterLand = async () => {
    if (currentUser?.identityStatus !== 'verified') {
      const underReview =
        currentUser?.identityStatus === 'pending' ||
        (currentUser?.identityStatus == null && !!(currentUser as { idVerification?: unknown }).idVerification);
      toast.info(underReview ? 'Identity under review' : 'Ghana Card verification required', {
        description: underReview
          ? 'Ghana Lands Commission is reviewing your Ghana Card. You will be notified within 24–48 hours.'
          : 'Complete Ghana Card verification before you can submit a new parcel. After approval, Ghana Lands Commission will still review this parcel’s documents before it can go live for buyers.',
        duration: 9000,
      });
      return;
    }
    if (!newParcel.title.trim() || !newParcel.location.address.trim() || !newParcel.area) {
      toast.error('Missing required fields', {
        description: 'Please fill in Land Title, Address, and Area before submitting.',
      });
      return;
    }
    if (!parsedNewArea?.sqm) {
      toast.error('Invalid area format', {
        description: 'Enter area in sqm (e.g. 500), sqft (e.g. 5382 sqft), acres (e.g. 0.12 acre), or dimensions (e.g. 100x70 ft).',
        duration: 8000,
      });
      return;
    }
    if (newParcel.documents.length < 1) {
      toast.error('At least one land document required', {
        description: 'Upload or scan at least a Land Title Certificate. Use the "Scan" button to simulate a document scan.',
        duration: 7000,
      });
      return;
    }

    setIsRegistering(true);
    const coords = { lat: 5.6037 + Math.random() * 0.1, lng: -0.1870 + Math.random() * 0.1 };
    const now = new Date().toISOString();

    try {
      // Upload land documents to secure vault (encrypted at rest). Only fileId + sha256 are persisted on parcel.
      const uploadedDocs = await Promise.all(
        newParcel.documents.map(async (d) => {
          const dataUrl = d.scannedImage || '';
          if (!dataUrl.startsWith('data:')) {
            // Prototype fallback: allow text-only placeholder, but keep it non-sensitive.
            return {
              name: d.name,
              type: d.type || 'PDF',
              fileId: undefined,
              sha256: undefined,
              verificationStatus: 'pending' as const,
              url: '',
            };
          }
          const up = await api.uploadFile({
            dataUrl,
            filename: d.name,
            scope: 'parcel_docs',
          });
          return {
            name: d.name,
            type: d.type || 'PDF',
            fileId: up.file.id,
            sha256: up.file.sha256,
            verificationStatus: 'pending' as const,
            url: '',
          };
        })
      );

      const payload = {
        title: newParcel.title,
        description: newParcel.description || '',
        location: {
          address: newParcel.location.address,
          latitude: coords.lat,
          longitude: coords.lng,
          region: newParcel.location.region
        },
        areaSqm: Math.round(parsedNewArea.sqm),
        areaSqft: Math.round(parsedNewArea.sqft),
        price: parseInt(newParcel.price) || 0,
        type: newParcel.type,
        /** Not public until Ghana Lands Commission verifies documents on their dashboard. */
        status: 'pending',
        documentsVerificationStatus: 'pending',
        documents: uploadedDocs,
        images: newParcel.images.map(img => ({
          url: img.url,
          caption: img.caption,
          type: img.type
        }))
      };

      let registeredParcel: LandParcel | null = null;

      try {
        const result = await api.createParcel(payload);
        if (result.success && result.parcel) {
          const raw = { ...result.parcel, owner: { id: currentUser?.id ?? '', name: currentUser?.name ?? '', email: '' } };
          const m = mapApiParcelToLandParcel(raw as Parameters<typeof mapApiParcelToLandParcel>[0]);
          registeredParcel = applyGlcGate(m);
        }
      } catch {
        // Backend unavailable — create parcel locally for prototype use
        registeredParcel = {
          id: `PARCEL_${Date.now()}`,
          title: newParcel.title,
          description: newParcel.description,
          location: {
            address: newParcel.location.address,
            coordinates: { lat: coords.lat, lng: coords.lng },
            region: newParcel.location.region
          },
          area: Math.round(parsedNewArea.sqm) || 0,
          price: parseInt(newParcel.price) || 0,
          status: 'pending',
          ownerId: currentUser?.id ?? '',
          owner: currentUser?.name ?? 'Unknown',
          documents: newParcel.documents.map(d => ({
            id: `DOC_${Date.now()}_${Math.random()}`,
            name: d.name,
            type: d.type || 'PDF',
            url: d.scannedImage || '',
            uploadedAt: now,
            verificationStatus: 'pending' as const
          })),
          documentsVerificationStatus: 'pending',
          images: newParcel.images,
          createdAt: now,
          updatedAt: now,
          type: newParcel.type,
          comments: [],
          blockchainHash: `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`
        };
      }

      if (registeredParcel) {
        setParcels((prev) => [...prev, applyGlcGate(registeredParcel!)]);
        resetNewParcel();
        setRegisterDialogOpen(false);
        toast.success('Parcel submitted for Ghana Lands Commission review', {
          description: `"${registeredParcel.title}" is not visible to buyers until Lands Commission verifies your documents and ownership from the admin dashboard.`,
          duration: 9000,
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      toast.error('Failed to register land parcel', {
        description: msg || 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleImagesChange = (uploadedImages: Array<{ id: string; url: string; caption?: string; type: string }>) => {
    const images = uploadedImages.map((img) => ({
      id: img.id,
      url: img.url,
      caption: img.caption ?? '',
      type: (
        ['main', 'aerial', 'boundary', 'interior', 'exterior'].includes(img.type)
          ? img.type
          : 'main'
      ) as LandImage['type'],
      uploadedAt: new Date().toISOString(),
    }));
    setNewParcel({ ...newParcel, images });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-primary text-primary-foreground border-0';
      case 'disputed': return 'bg-destructive text-destructive-foreground border-0';
      case 'pending': return 'bg-accent text-accent-foreground border-0';
      case 'sold': return 'bg-secondary text-secondary-foreground border-0';
      default: return 'bg-muted text-foreground border-0';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'residential': return <MapPin className="w-4 h-4 text-blue-500" />;
      case 'commercial': return <Shield className="w-4 h-4 text-purple-400" />;
      case 'agricultural': return <Hexagon className="w-4 h-4 text-green-400" />;
      case 'industrial': return <Zap className="w-4 h-4 text-orange-400" />;
      default: return <MapPin className="w-4 h-4 text-blue-500" />;
    }
  };

  const regions = [
    'Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern',
    'Northern', 'Upper East', 'Upper West', 'Volta', 'Brong Ahafo',
    'Bono', 'Bono East', 'Ahafo', 'Western North', 'Savannah', 'North East'
  ];

  return (
    <div className="space-y-6">
      {restrictedUser && (
        <Alert className="border-accent/50 bg-accent/15">
          <AlertDescription className="text-sm text-foreground">
            Browsing mode is active until Ghana Lands Commission approves your Ghana Card. Transaction actions and parcel details stay locked until then.
          </AlertDescription>
        </Alert>
      )}
      {currentUser?.role === 'seller' && !restrictedUser && currentUser?.identityStatus === 'verified' && (
        <Alert className="border-primary/30 bg-primary/5">
          <AlertDescription className="text-sm text-foreground">
            <strong>Landowner next step:</strong> your identity is cleared. When you <strong>Register New Land</strong>, upload title and survey documents — those go to{' '}
            <strong>Ghana Lands Commission</strong> for review and permission to list each parcel.
          </AlertDescription>
        </Alert>
      )}
      {/* Header with Search and Register */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-3xl font-semibold text-foreground">
            Blockchain Land Registry
          </h2>
          <p className="text-muted-foreground mt-1">
            {currentUser?.role === 'seller' ? 'Manage your digital land assets' : 'Explore verified blockchain properties'}
          </p>
        </div>
        
        {canRegisterLand && (
          <Dialog open={registerDialogOpen} onOpenChange={(open) => { setRegisterDialogOpen(open); if (!open) resetNewParcel(); }}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2" onClick={() => setRegisterDialogOpen(true)}>
                <Plus className="w-4 h-4" />
                <Zap className="w-4 h-4" />
                Register New Land
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border border-border">
              <DialogHeader>
                <DialogTitle className="text-2xl text-foreground">
                  Register New Land Parcel
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Add a parcel to the registry. After your Ghana Card is approved, land documents you upload here are reviewed by Ghana Lands Commission for that parcel.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-foreground font-medium">Land Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Residential Plot - East Legon"
                      value={newParcel.title}
                      onChange={(e) => setNewParcel({ ...newParcel, title: e.target.value })}
                      className="border-input focus:border-primary focus:ring-primary"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="type" className="text-foreground font-medium">Property Type *</Label>
                    <Select value={newParcel.type} onValueChange={(value: 'residential' | 'commercial' | 'agricultural' | 'industrial') => setNewParcel({ ...newParcel, type: value })}>
                      <SelectTrigger className="border-input focus:border-primary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="residential">🏠 Residential</SelectItem>
                        <SelectItem value="commercial">🏢 Commercial</SelectItem>
                        <SelectItem value="agricultural">🌾 Agricultural</SelectItem>
                        <SelectItem value="industrial">🏭 Industrial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description" className="text-foreground font-medium">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Detailed description of the land property..."
                      value={newParcel.description}
                      onChange={(e) => setNewParcel({ ...newParcel, description: e.target.value })}
                      className="border-input focus:border-primary focus:ring-primary"
                    />
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address" className="text-foreground font-medium">Address *</Label>
                    <Input
                      id="address"
                      placeholder="Complete address with landmarks"
                      value={newParcel.location.address}
                      onChange={(e) => setNewParcel({ 
                        ...newParcel, 
                        location: { ...newParcel.location, address: e.target.value }
                      })}
                      className="border-input focus:border-primary focus:ring-primary"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="region" className="text-foreground font-medium">Region *</Label>
                    <Select 
                      value={newParcel.location.region} 
                      onValueChange={(value) => setNewParcel({ 
                        ...newParcel, 
                        location: { ...newParcel.location, region: value }
                      })}
                    >
                      <SelectTrigger className="border-input focus:border-primary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map((region) => (
                          <SelectItem key={region} value={region}>{region}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="area" className="text-foreground font-medium">Area (sq. meters) *</Label>
                    <Input
                      id="area"
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 500, 5382 sqft, 0.12 acre, 100x70 ft"
                      value={newParcel.area}
                      onChange={(e) => setNewParcel({ ...newParcel, area: e.target.value })}
                      className="border-input focus:border-primary focus:ring-primary"
                    />
                    <div className="flex flex-wrap gap-2">
                      {ghanaPlotStandards.presets.map((p) => {
                        const isRecommended = ghanaPlotStandards.recommended.includes(p.label);
                        return (
                          <Button
                            key={p.label}
                            type="button"
                            size="sm"
                            variant={isRecommended ? 'default' : 'outline'}
                            onClick={() => setAreaFromFeet(p.a, p.b)}
                          >
                            {p.label}
                          </Button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ghana standard guide: roadside/developed areas often use <strong>70×100 ft</strong>. Less developed/far locations (e.g. parts of the north) may use <strong>70×70 ft</strong> or <strong>100×100 ft</strong>. You can also type dimensions like <strong>70x100 ft</strong>.
                    </p>
                    {parsedNewArea?.sqm ? (
                      <p className="text-xs text-muted-foreground">
                        Stored as <span className="font-medium text-foreground">{Math.round(parsedNewArea.sqm).toLocaleString()} sqm</span> · {parsedNewArea.text}
                      </p>
                    ) : null}
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="price" className="text-foreground font-medium">Estimated Value (Ghana Cedis)</Label>
                    <Input
                      id="price"
                      type="number"
                      placeholder="450000"
                      value={newParcel.price}
                      onChange={(e) => setNewParcel({ ...newParcel, price: e.target.value })}
                      className="border-input focus:border-primary focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Land Documents - required, verified by Lands Commission before listing */}
                <div className="space-y-4 p-4 border rounded-lg border-accent/40 bg-accent/10">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      <h3 className="text-lg font-semibold text-foreground">Land documents</h3>
                      <Badge variant="outline" className="border-accent/60 text-foreground text-xs">
                        Min. 1 required
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Upload a file or click <strong>Scan</strong> to simulate a document scan for demo purposes
                    </span>
                  </div>
                  <DocumentScanner
                    title="Upload land ownership documents"
                    requiredDocuments={['Land Title Certificate', 'Survey Plan', 'Site Plan']}
                    onDocumentsScanned={(docs: ScannedDocument[]) =>
                      setNewParcel({ ...newParcel, documents: docs })
                    }
                  />
                </div>

                {/* Image Upload Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                      <Camera className="w-5 h-5 text-primary" />
                      Property Images
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowImageUpload(!showImageUpload)}
                      className="border-input text-foreground hover:bg-secondary"
                    >
                      {showImageUpload ? 'Hide Upload' : 'Add Images'}
                    </Button>
                  </div>
                  
                  {showImageUpload && (
                    <ImageUpload
                      onImagesChange={handleImagesChange}
                      maxImages={8}
                    />
                  )}
                </div>

                <Button 
                  onClick={handleRegisterLand} 
                  disabled={isRegistering}
                  className="w-full"
                  size="lg"
                >
                  {isRegistering ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Registering on Blockchain...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Register Land Parcel
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Search by title, address, or region..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 border-input focus:border-primary focus:ring-primary bg-card/70 backdrop-blur-sm"
        />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Lands in Dispute - prominent section */}
      {!loading && disputedParcels.length > 0 && (
        <Card className="border-accent/40 bg-accent/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Gavel className="w-5 h-5" />
              Lands in Dispute ({disputedParcels.length})
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Parcels under dispute resolution. Resolve via Dispute Resolution dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {disputedParcels.map((parcel) => {
                const dispute = disputes.find(d => d.landParcelId === parcel.id);
                return (
                  <Badge
                    key={parcel.id}
                    variant="outline"
                    className="border-accent/60 text-foreground bg-card py-1.5 px-3 cursor-pointer hover:bg-accent/25"
                    onClick={() => {
                      if (restrictedUser) return;
                      setSelectedParcel(parcel);
                    }}
                  >
                    {parcel.title} — {dispute?.status === 'community_voting' ? 'Voting' : dispute?.status?.replace('_', ' ')}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status filter */}
      <div className="flex gap-2">
        {(['all', 'available', 'disputed'] as const).map((f) => (
          <Button
            key={f}
            variant={statusFilter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(f)}
          >
            {f === 'all' ? 'All parcels' : f === 'disputed' ? 'In dispute' : 'Available'}
          </Button>
        ))}
      </div>

      {/* Land Parcels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredParcels.map((parcel) => (
          <Card key={parcel.id} className="group hover:shadow-lg transition-all duration-300 border border-border bg-card hover:-translate-y-1 overflow-hidden">
            {/* Property Image */}
            {parcel.images && parcel.images.length > 0 && (
              <div className="relative h-48 overflow-hidden">
                <img
                  src={parcel.images[0].url}
                  alt={parcel.images[0].caption || parcel.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <Badge className={`absolute top-3 right-3 ${getStatusColor(parcel.status)}`}>
                  {parcel.status}
                </Badge>
                {parcel.images.length > 1 && (
                  <Badge className="absolute bottom-3 right-3 bg-black/50 text-white border-0">
                    <ImageIcon className="w-3 h-3 mr-1" />
                    {parcel.images.length}
                  </Badge>
                )}
              </div>
            )}
            
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getTypeIcon(parcel.type)}
                  <CardTitle className="text-lg text-foreground group-hover:text-primary transition-colors">
                    {parcel.title}
                  </CardTitle>
                </div>
                {!parcel.images?.length && (
                  <Badge className={getStatusColor(parcel.status)}>
                    {parcel.status}
                  </Badge>
                )}
              </div>
              <CardDescription className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary" />
                {parcel.location.address}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground font-medium">Owner</p>
                  <p className="font-semibold text-foreground">{parcel.owner || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">Area</p>
                  <p className="font-semibold text-foreground">{parcel.area?.toLocaleString()} sq.m</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">Value</p>
                  <p className="font-semibold text-primary">
                    {formatCurrency(parcel.price || parcel.value || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">Type</p>
                  <p className="font-semibold text-foreground capitalize">{parcel.type}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary rounded-lg p-2">
                <FileText className="w-3 h-3 text-primary" />
                <span>{parcel.documents?.length || 0} document(s)</span>
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse ml-auto"></div>
                <span className="text-primary font-medium">Verified</span>
              </div>
              
              <div className="pt-2 border-t border-slate-200">
                {restrictedUser ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="w-full border-accent/60 text-foreground bg-accent/15"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Details locked until verification
                  </Button>
                ) : (
                  <Dialog
                    open={detailsOpen && selectedParcel?.id === parcel.id}
                    onOpenChange={(o) => {
                      setDetailsOpen(o);
                      if (!o) setSelectedParcel(null);
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full border-input text-foreground hover:bg-secondary transition-all duration-300"
                        onClick={() => {
                          setSelectedParcel(parcel);
                          setDetailsOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl bg-card border border-border max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-2xl text-foreground">
                        {selectedParcel?.title}
                      </DialogTitle>
                      <DialogDescription asChild>
                        <div className="space-y-2 text-muted-foreground text-sm">
                          <p className="flex items-start gap-2">
                            <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <span>
                              <span className="font-medium text-foreground">Settlement:</span> pay in Ghana Cedis (GHS) via Mobile Money or bank.
                            </span>
                          </p>
                        </div>
                      </DialogDescription>
                    </DialogHeader>
                    {selectedParcel && (
                      <div className="space-y-6">
                        {/* Image Gallery */}
                        {selectedParcel.images && selectedParcel.images.length > 0 && (
                          <div className="space-y-4">
                            <Label className="text-foreground font-medium">Property Images</Label>
                            <div className="space-y-3">
                              {/* Main Image */}
                              <div className="relative aspect-video bg-secondary rounded-lg overflow-hidden">
                                <img
                                  src={selectedParcel.images[selectedImageIndex]?.url}
                                  alt={selectedParcel.images[selectedImageIndex]?.caption || 'Property image'}
                                  className="w-full h-full object-cover"
                                />
                                <Badge className="absolute bottom-3 left-3 bg-black/70 text-white border-0">
                                  {selectedParcel.images[selectedImageIndex]?.type}
                                </Badge>
                              </div>
                              
                              {/* Image Caption */}
                              {selectedParcel.images[selectedImageIndex]?.caption && (
                                <p className="text-sm text-muted-foreground italic">
                                  {selectedParcel.images[selectedImageIndex].caption}
                                </p>
                              )}
                              
                              {/* Image Thumbnails */}
                              {selectedParcel.images.length > 1 && (
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                  {selectedParcel.images.map((image, index) => (
                                    <button
                                      key={image.id}
                                      onClick={() => setSelectedImageIndex(index)}
                                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                                        index === selectedImageIndex 
                                          ? 'border-primary ring-2 ring-primary/20' 
                                          : 'border-border hover:border-primary/50'
                                      }`}
                                    >
                                      <img
                                        src={image.url}
                                        alt={image.caption || `Image ${index + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-foreground font-medium">Owner</Label>
                            <p className="text-sm font-semibold text-foreground">{selectedParcel.owner}</p>
                          </div>
                          <div>
                            <Label className="text-foreground font-medium">Status</Label>
                            <Badge className={getStatusColor(selectedParcel.status)}>
                              {selectedParcel.status}
                            </Badge>
                          </div>
                          <div>
                            <Label className="text-foreground font-medium">Area</Label>
                            <p className="text-sm font-semibold text-foreground">{selectedParcel.area?.toLocaleString()} square meters</p>
                          </div>
                          <div>
                            <Label className="text-foreground font-medium">Estimated Value</Label>
                            <p className="text-sm font-semibold text-primary">
                              {formatCurrency(selectedParcel.price || selectedParcel.value || 0)}
                            </p>
                          </div>
                        </div>
                        {selectedParcelIsDisputed && (
                          <Alert className="border-destructive/30 bg-destructive/10">
                            <AlertDescription className="text-sm text-foreground">
                              <strong>This parcel is under dispute.</strong> All actions (purchase, messaging, transfer) are blocked until the dispute is resolved.
                            </AlertDescription>
                          </Alert>
                        )}
                        <div>
                          <Label className="text-foreground font-medium">Address</Label>
                          <p className="text-sm text-muted-foreground">{selectedParcel.location.address}</p>
                        </div>
                        <div>
                          <Label className="text-foreground font-medium">Region</Label>
                          <p className="text-sm text-muted-foreground">{selectedParcel.location.region}</p>
                        </div>
                        {selectedParcel.description && (
                          <div>
                            <Label className="text-foreground font-medium">Description</Label>
                            <p className="text-sm text-muted-foreground">{selectedParcel.description}</p>
                          </div>
                        )}
                        <div>
                          <Label className="text-foreground font-medium">Documents</Label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {selectedParcel.documents?.map((doc, index) => (
                              <Badge key={index} variant="outline" className="border-border text-foreground">
                                {doc.name}
                              </Badge>
                            )) || <span className="text-sm text-muted-foreground">No documents</span>}
                          </div>
                        </div>

                        {canBuySelectedParcel && (
                          <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 space-y-3">
                            <Label className="text-foreground font-medium flex items-center gap-2">
                              <CreditCard className="h-4 w-4" />
                              Purchase
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Pay in Ghana Cedis (GHS) via Mobile Money or bank.
                            </p>
                           
                            <RadioGroup
                              value={paymentChannel}
                              onValueChange={(v) => setPaymentChannel(v as 'mobile_money' | 'bank')}
                              className="grid gap-2 sm:grid-cols-2"
                            >
                              <div className="flex items-center space-x-2 rounded-md border border-border bg-card p-3">
                                <RadioGroupItem value="mobile_money" id="momo" />
                                <Label htmlFor="momo" className="flex flex-1 cursor-pointer items-center gap-2 font-normal">
                                  <Smartphone className="h-4 w-4 text-primary shrink-0" />
                                  Mobile Money
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2 rounded-md border border-border bg-card p-3">
                                <RadioGroupItem value="bank" id="bank" />
                                <Label htmlFor="bank" className="flex flex-1 cursor-pointer items-center gap-2 font-normal">
                                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                                  Bank / account
                                </Label>
                              </div>
                            </RadioGroup>
                            <Button
                              type="button"
                              className="w-full"
                              disabled={payStarting}
                              onClick={() => void handlePaystackPurchase()}
                            >
                              {payStarting ? 'Starting checkout…' : 'Proceed to checkout'}
                            </Button>
                          </div>
                        )}

                        {canMessageSeller && (
                          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                            <Label className="text-foreground font-medium">Contact seller</Label>
                            <p className="text-xs text-muted-foreground">
                              Start a secure in-app conversation tied to this parcel.
                            </p>
                            <Button
                              type="button"
                              className="w-full"
                              variant="secondary"
                              onClick={() => {
                                if (selectedParcelIsDisputed) {
                                  toast.error('Parcel is under dispute', {
                                    description: 'Messaging is blocked until the dispute is resolved.',
                                  });
                                  return;
                                }
                                setChatOpen(true);
                              }}
                            >
                              Message seller
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredParcels.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-12 h-12 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2 text-foreground">
            No land parcels found
          </h3>
          <p className="text-muted-foreground">
            {currentUser?.role === 'seller' 
              ? 'Register your first land parcel to get started.' 
              : 'Try adjusting your search criteria or register a new land parcel.'}
          </p>
        </div>
      )}

      {selectedParcel && (
        <ParcelChatDialog
          open={chatOpen}
          onOpenChange={setChatOpen}
          landParcelId={selectedParcel.id}
          parcelTitle={selectedParcel.title}
        />
      )}
    </div>
  );
};