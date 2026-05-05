import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Gavel, FileText, Plus, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { Dispute } from '@/types';
import { api } from '@/lib/api';
import { mapApiParcelToLandParcel } from '@/lib/parcelMapper';
import { useAuth } from '@/contexts/AuthContext';
import { isUserRestricted } from '@/lib/identityGate';
import { initialsFromName } from '@/lib/namePrivacy';
import { toast } from '@/lib/appToast';

function ResolveDisputeDialog({ disputeId, onResolved }: { disputeId: string; onResolved: (resolution: string) => void }) {
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const handleResolve = async () => {
    if (!resolution.trim()) return;
    setSubmitting(true);
    try {
      await api.resolveDispute(disputeId, resolution.trim());
      onResolved(resolution.trim());
      setOpen(false);
      setResolution('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full">Resolve Dispute</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve Dispute</DialogTitle>
          <DialogDescription>Enter the resolution details</DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Resolution text..."
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          rows={4}
        />
        <Button onClick={handleResolve} disabled={!resolution.trim() || submitting}>
          {submitting ? 'Submitting...' : 'Submit Resolution'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function mapApiDispute(d: { id: string; landParcelId: string; plaintiff?: { name?: string }; defendant?: { name?: string }; description?: string; status?: string; filedDate?: string; evidence?: unknown[]; supportVotes?: number; againstVotes?: number; abstainVotes?: number; resolution?: string | null }) {
  return {
    id: d.id,
    landParcelId: d.landParcelId,
    plaintiff: (d.plaintiff && typeof d.plaintiff === 'object' && d.plaintiff.name) ? d.plaintiff.name : 'Unknown',
    defendant: (d.defendant && typeof d.defendant === 'object' && d.defendant.name) ? d.defendant.name : 'Unknown',
    description: d.description ?? '',
    evidence: Array.isArray(d.evidence) ? d.evidence.map((e: { fileName?: string }) => e?.fileName ?? String(e)) : [],
    status: (d.status ?? 'filed') as Dispute['status'],
    filedDate: d.filedDate ? new Date(d.filedDate).toISOString().split('T')[0] : '',
    votes: {
      support: d.supportVotes ?? 0,
      against: d.againstVotes ?? 0,
      abstain: d.abstainVotes ?? 0
    },
    resolution: d.resolution ?? undefined
  };
}

export default function DisputeResolution() {
  const { user } = useAuth();
  const restrictedUser = isUserRestricted(user);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [parcels, setParcels] = useState<Array<ReturnType<typeof mapApiParcelToLandParcel>>>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [newDispute, setNewDispute] = useState({
    landParcelId: '',
    defendantUserId: '',
    description: '',
    evidence: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const [dispRes, parcelRes, userRes] = await Promise.all([
          api.getDisputes().catch(() => null),
          api.getParcels().catch(() => null),
          api.getUsers().catch(() => null)
        ]);
        if (!ok) return;
        if (dispRes?.success && Array.isArray(dispRes.disputes)) {
          setDisputes(dispRes.disputes.map((d: object) => mapApiDispute(d as Parameters<typeof mapApiDispute>[0])));
        }
        if (parcelRes?.success && Array.isArray(parcelRes.parcels)) {
          setParcels(parcelRes.parcels.map((p: object) => mapApiParcelToLandParcel(p as Parameters<typeof mapApiParcelToLandParcel>[0])));
        }
        if (userRes?.success && Array.isArray(userRes.users)) {
          setUsers(userRes.users);
        }
        if (!dispRes?.success && !parcelRes?.success) {
          toast.error('Could not load disputes data', { description: 'Check backend connectivity.' });
        }
      } finally {
        if (ok) setLoading(false);
      }
    })();
    return () => { ok = false; };
  }, []);

  const handleCreateDispute = async () => {
    if (restrictedUser) {
      toast.error('Your account is pending verification. Dispute actions are locked for now.');
      return;
    }
    if (!newDispute.landParcelId || !newDispute.defendantUserId || !newDispute.description) {
      toast.error('Please fill in all required fields (parcel, defendant, description)');
      return;
    }

    setIsCreating(true);
    try {
      const result = await api.createDispute({
        landParcelId: newDispute.landParcelId,
        defendantUserId: newDispute.defendantUserId,
        description: newDispute.description,
        evidence: newDispute.evidence ? newDispute.evidence.split(',').map(e => e.trim()).filter(Boolean) : undefined
      });
      if (result.success && result.dispute) {
        setDisputes(prev => [...prev, mapApiDispute(result.dispute)]);
        setNewDispute({ landParcelId: '', defendantUserId: '', description: '', evidence: '' });
        toast.success('Dispute filed successfully');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to file dispute');
    } finally {
      setIsCreating(false);
    }
  };

  const handleVote = async (disputeId: string, vote: 'support' | 'against' | 'abstain') => {
    if (restrictedUser) {
      toast.error('Your account is pending verification. Voting is locked for now.');
      return;
    }
    try {
      await api.voteDispute(disputeId, vote);
      setDisputes(prev => prev.map(d => {
        if (d.id === disputeId && d.votes) {
          const v = { ...d.votes };
          v[vote]++;
          return { ...d, votes: v };
        }
        return d;
      }));
      toast.success('Vote recorded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record vote');
    }
  };

  const handleResolveDispute = async (disputeId: string, resolution: string) => {
    if (restrictedUser) {
      toast.error('Your account is pending verification. Resolution actions are locked for now.');
      return;
    }
    if (!resolution.trim()) {
      toast.error('Please enter a resolution');
      return;
    }
    try {
      await api.resolveDispute(disputeId, resolution);
      setDisputes(prev => prev.map(d => d.id === disputeId ? { ...d, status: 'resolved' as const, resolution } : d));
      toast.success('Dispute resolved successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resolve dispute');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'filed':
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'under_review': return 'bg-blue-100 text-blue-800';
      case 'community_voting': return 'bg-purple-100 text-purple-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVotePercentage = (votes: { support: number; against: number; abstain: number }, type: keyof typeof votes) => {
    const total = votes.support + votes.against + votes.abstain;
    return total > 0 ? (votes[type] / total) * 100 : 0;
  };

  return (
    <div className="space-y-6">
      {restrictedUser && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertDescription className="text-amber-900">
            Your account is pending verification. You can view disputes, but filing, voting, and resolution actions are disabled until approval.
          </AlertDescription>
        </Alert>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold">Dispute Resolution</h2>
          <p className="text-muted-foreground">Community-driven land dispute resolution system</p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2" disabled={restrictedUser}>
              <Plus className="w-4 h-4" />
              File New Dispute
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>File Land Dispute</DialogTitle>
              <DialogDescription>
                Submit a new land dispute for community resolution
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="parcel">Land Parcel</Label>
                <Select value={newDispute.landParcelId} onValueChange={(value) => 
                  setNewDispute({ ...newDispute, landParcelId: value })
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Select the disputed land parcel" />
                  </SelectTrigger>
                  <SelectContent>
                    {parcels.map((parcel) => (
                      <SelectItem key={parcel.id} value={parcel.id}>
                        {parcel.title} - {parcel.owner ?? 'N/A'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="defendant">Defendant (opposing party)</Label>
                <Select value={newDispute.defendantUserId} onValueChange={(value) => 
                  setNewDispute({ ...newDispute, defendantUserId: value })
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Select defendant user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.id !== user?.id).map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Dispute Description</Label>
                <Textarea
                  id="description"
                  placeholder="Provide detailed description of the dispute, including timeline and key facts..."
                  value={newDispute.description}
                  onChange={(e) => setNewDispute({ ...newDispute, description: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evidence">Evidence Files (comma-separated)</Label>
                <Textarea
                  id="evidence"
                  placeholder="family_tree.pdf, old_land_records.pdf, witness_statements.pdf"
                  value={newDispute.evidence}
                  onChange={(e) => setNewDispute({ ...newDispute, evidence: e.target.value })}
                />
              </div>
            </div>
            <Button 
              onClick={handleCreateDispute} 
              disabled={isCreating || restrictedUser}
              className="w-full"
            >
              {isCreating ? 'Filing Dispute...' : 'File Dispute'}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dispute Resolution Process */}
      <Card>
        <CardHeader>
          <CardTitle>Resolution Process</CardTitle>
          <CardDescription>How community-driven dispute resolution works</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="w-8 h-8 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-2">1</div>
              <h4 className="font-medium">File</h4>
              <p className="text-xs text-muted-foreground">Submit dispute with evidence</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">2</div>
              <h4 className="font-medium">Review</h4>
              <p className="text-xs text-muted-foreground">Authority preliminary review</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-2">3</div>
              <h4 className="font-medium">Vote</h4>
              <p className="text-xs text-muted-foreground">Community voting period</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">4</div>
              <h4 className="font-medium">Resolve</h4>
              <p className="text-xs text-muted-foreground">Automated resolution</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Disputes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {disputes.map((dispute) => {
          const parcel = parcels.find(p => p.id === dispute.landParcelId);
          return (
            <Card key={dispute.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{parcel?.title}</CardTitle>
                  <Badge className={getStatusColor(dispute.status)}>
                    {dispute.status.replace('_', ' ')}
                  </Badge>
                </div>
                <CardDescription>
                  {dispute.plaintiff} vs {dispute.defendant}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Description</Label>
                  <p className="text-sm text-muted-foreground mt-1">{dispute.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Filed Date</p>
                    <p className="font-medium">{dispute.filedDate}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Evidence Files</p>
                    <p className="font-medium">{dispute.evidence.length} files</p>
                  </div>
                </div>

                {dispute.evidence.length > 0 && (
                  <div>
                    <Label>Evidence</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {dispute.evidence.map((evidence, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          <FileText className="w-3 h-3 mr-1" />
                          {evidence}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {dispute.status === 'community_voting' && dispute.votes && (
                  <div className="space-y-3">
                    <Label>Community Votes</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3 text-green-600" />
                          Support ({dispute.votes.support})
                        </span>
                        <span>{getVotePercentage(dispute.votes, 'support').toFixed(1)}%</span>
                      </div>
                      <Progress value={getVotePercentage(dispute.votes, 'support')} className="h-2" />
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1">
                          <ThumbsDown className="w-3 h-3 text-red-600" />
                          Against ({dispute.votes.against})
                        </span>
                        <span>{getVotePercentage(dispute.votes, 'against').toFixed(1)}%</span>
                      </div>
                      <Progress value={getVotePercentage(dispute.votes, 'against')} className="h-2" />
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1">
                          <Minus className="w-3 h-3 text-gray-600" />
                          Abstain ({dispute.votes.abstain})
                        </span>
                        <span>{getVotePercentage(dispute.votes, 'abstain').toFixed(1)}%</span>
                      </div>
                      <Progress value={getVotePercentage(dispute.votes, 'abstain')} className="h-2" />
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleVote(dispute.id, 'support')}
                        disabled={restrictedUser}
                        className="flex-1"
                      >
                        <ThumbsUp className="w-3 h-3 mr-1" />
                        Support
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleVote(dispute.id, 'against')}
                        disabled={restrictedUser}
                        className="flex-1"
                      >
                        <ThumbsDown className="w-3 h-3 mr-1" />
                        Against
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleVote(dispute.id, 'abstain')}
                        disabled={restrictedUser}
                        className="flex-1"
                      >
                        <Minus className="w-3 h-3 mr-1" />
                        Abstain
                      </Button>
                    </div>
                  </div>
                )}

                {dispute.status === 'under_review' && dispute.arbitrator && (
                  <div className="text-sm bg-blue-50 p-3 rounded">
                    <p className="font-medium">Under Review</p>
                    <p className="text-muted-foreground">Arbitrator: {initialsFromName(dispute.arbitrator)}</p>
                  </div>
                )}

                {dispute.status === 'resolved' && dispute.resolution && (
                  <div className="text-sm bg-green-50 p-3 rounded">
                    <p className="font-medium text-green-800">Resolution</p>
                    <p className="text-green-700">{dispute.resolution}</p>
                  </div>
                )}

                {['filed', 'pending', 'under_review'].includes(dispute.status) && (user?.role === 'admin') && !restrictedUser && (
                  <div className="flex flex-col gap-2">
                    {['filed', 'pending'].includes(dispute.status) && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={async () => {
                          try {
                            await api.patchDisputeStatus(dispute.id, 'under_review');
                            setDisputes(prev => prev.map(d => d.id === dispute.id ? { ...d, status: 'under_review' as const } : d));
                            toast.success('Dispute moved to review');
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Failed');
                          }
                        }}
                      >
                        <Gavel className="w-3 h-3 mr-1" />
                        Move to Review
                      </Button>
                    )}
                    <ResolveDisputeDialog
                      disputeId={dispute.id}
                      onResolved={(r) => {
                        setDisputes(prev => prev.map(d => d.id === dispute.id ? { ...d, status: 'resolved' as const, resolution: r } : d));
                        toast.success('Dispute resolved');
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {disputes.length === 0 && (
        <div className="text-center py-12">
          <Gavel className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No disputes found</h3>
          <p className="text-muted-foreground">File your first land dispute to get started with the resolution process.</p>
        </div>
      )}
    </div>
  );
}