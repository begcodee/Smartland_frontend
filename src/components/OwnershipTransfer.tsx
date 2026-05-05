import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowRightLeft, Shield, Clock, CheckCircle, XCircle, Plus } from 'lucide-react';
import { Transfer } from '@/types';
import { api } from '@/lib/api';
import { mapApiParcelToLandParcel } from '@/lib/parcelMapper';
import { useAuth } from '@/contexts/AuthContext';
import { isUserRestricted } from '@/lib/identityGate';
import { toast } from '@/lib/appToast';

function mapApiTransfer(t: { id: string; landParcelId: string; fromUser?: { name?: string }; toUser?: { name?: string }; amount?: number; status?: string; initiatedDate?: string; completedDate?: string | null }) {
  return {
    id: t.id,
    landParcelId: t.landParcelId,
    from: (t.fromUser && typeof t.fromUser === 'object' && t.fromUser.name) ? t.fromUser.name : 'Unknown',
    to: (t.toUser && typeof t.toUser === 'object' && t.toUser.name) ? t.toUser.name : 'Unknown',
    amount: t.amount ?? 0,
    status: (t.status === 'pending' ? 'escrowed' : t.status) as Transfer['status'],
    initiatedDate: t.initiatedDate ? new Date(t.initiatedDate).toISOString().split('T')[0] : '',
    completedDate: t.completedDate ? new Date(t.completedDate).toISOString().split('T')[0] : undefined
  };
}

export default function OwnershipTransfer() {
  const { user } = useAuth();
  const restrictedUser = isUserRestricted(user);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [parcels, setParcels] = useState<Array<ReturnType<typeof mapApiParcelToLandParcel>>>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [newTransfer, setNewTransfer] = useState({
    landParcelId: '',
    toUserId: '',
    amount: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const [trfRes, parcelRes, userRes] = await Promise.all([
          api.getTransfers().catch(() => null),
          api.getParcels().catch(() => null),
          api.getUsers().catch(() => null)
        ]);
        if (!ok) return;
        if (trfRes?.success && Array.isArray(trfRes.transfers)) {
          setTransfers(trfRes.transfers.map((t: object) => mapApiTransfer(t as Parameters<typeof mapApiTransfer>[0])));
        }
        if (parcelRes?.success && Array.isArray(parcelRes.parcels)) {
          setParcels(parcelRes.parcels.map((p: object) => mapApiParcelToLandParcel(p as Parameters<typeof mapApiParcelToLandParcel>[0])));
        }
        if (userRes?.success && Array.isArray(userRes.users)) {
          setUsers(userRes.users);
        }
        if (!trfRes?.success && !parcelRes?.success) {
          toast.error('Could not load transfers data', { description: 'Check backend connectivity.' });
        }
      } finally {
        if (ok) setLoading(false);
      }
    })();
    return () => { ok = false; };
  }, []);

  const myParcels = parcels.filter(p => p.ownerId === user?.id && (p.status === 'available' || p.status === 'pending'));

  const handleCreateTransfer = async () => {
    if (restrictedUser) {
      toast.error('Your account is pending verification. Transfer actions are locked for now.');
      return;
    }
    if (!newTransfer.landParcelId || !newTransfer.toUserId || !newTransfer.amount) {
      toast.error('Please fill in all required fields (parcel, buyer, amount)');
      return;
    }

    setIsCreating(true);
    try {
      const result = await api.createTransfer({
        landParcelId: newTransfer.landParcelId,
        toUserId: newTransfer.toUserId,
        amount: parseInt(newTransfer.amount)
      });
      if (result.success && result.transfer) {
        setTransfers(prev => [...prev, mapApiTransfer(result.transfer)]);
        setNewTransfer({ landParcelId: '', toUserId: '', amount: '' });
        toast.success('Transfer initiated successfully');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to initiate transfer');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCompleteTransfer = async (transferId: string) => {
    if (restrictedUser) {
      toast.error('Your account is pending verification. Transfer actions are locked for now.');
      return;
    }
    try {
      const result = await api.completeTransfer(transferId);
      if (result.success && result.transfer) {
        setTransfers(prev => prev.map(t => t.id === transferId ? mapApiTransfer(result.transfer) : t));
        toast.success('Transfer completed successfully');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to complete transfer');
    }
  };

  const handleCancelTransfer = (_transferId: string) => {
    toast.info('Cancel not yet supported via API');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'escrowed': return <Shield className="w-4 h-4 text-blue-500" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'escrowed': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {restrictedUser && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertDescription className="text-amber-900">
            You can review transfer history while pending verification, but initiating or completing transfers is disabled.
          </AlertDescription>
        </Alert>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold">Ownership Transfer</h2>
          <p className="text-muted-foreground">Manage land ownership transfers with smart contract escrow</p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2" disabled={restrictedUser}>
              <Plus className="w-4 h-4" />
              Initiate Transfer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Initiate Ownership Transfer</DialogTitle>
              <DialogDescription>
                Create a new land ownership transfer with smart contract escrow
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="parcel">Land Parcel (your listed parcels)</Label>
                <Select value={newTransfer.landParcelId} onValueChange={(value) => 
                  setNewTransfer({ ...newTransfer, landParcelId: value })
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a land parcel" />
                  </SelectTrigger>
                  <SelectContent>
                    {myParcels.map((parcel) => (
                      <SelectItem key={parcel.id} value={parcel.id}>
                        {parcel.title} - {parcel.owner}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="to">Buyer (new owner)</Label>
                <Select value={newTransfer.toUserId} onValueChange={(value) => 
                  setNewTransfer({ ...newTransfer, toUserId: value })
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Select buyer" />
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
                <Label htmlFor="amount">Transfer Amount (Ghana Cedis)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="150000"
                  value={newTransfer.amount}
                  onChange={(e) => setNewTransfer({ ...newTransfer, amount: e.target.value })}
                />
              </div>
            </div>
            <Button 
              onClick={handleCreateTransfer} 
              disabled={isCreating || restrictedUser}
              className="w-full"
            >
              {isCreating ? 'Creating Smart Contract...' : 'Initiate Transfer'}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Transfer Process Flow */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer Process</CardTitle>
          <CardDescription>How smart contract-based land transfers work</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">1</div>
              <h4 className="font-medium">Initiate</h4>
              <p className="text-xs text-muted-foreground">Buyer initiates transfer request</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">2</div>
              <h4 className="font-medium">Escrow</h4>
              <p className="text-xs text-muted-foreground">Funds locked in smart contract</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">3</div>
              <h4 className="font-medium">Verify</h4>
              <p className="text-xs text-muted-foreground">Documents and ownership verified</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">4</div>
              <h4 className="font-medium">Complete</h4>
              <p className="text-xs text-muted-foreground">Ownership transferred automatically</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Transfers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {transfers.map((transfer) => {
          const parcel = parcels.find(p => p.id === transfer.landParcelId);
          const blockedByDispute = parcel?.status === 'disputed';
          return (
            <Card key={transfer.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{parcel?.title}</CardTitle>
                  <Badge className={getStatusColor(transfer.status)}>
                    {getStatusIcon(transfer.status)}
                    <span className="ml-1">{transfer.status}</span>
                  </Badge>
                </div>
                <CardDescription>Transfer ID: {transfer.id}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center py-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">From</p>
                    <p className="font-medium">{transfer.from}</p>
                  </div>
                  <ArrowRightLeft className="mx-4 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">To</p>
                    <p className="font-medium">{transfer.to}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Amount</p>
                    <p className="font-medium">₵{transfer.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Initiated</p>
                    <p className="font-medium">{transfer.initiatedDate}</p>
                  </div>
                </div>

                {transfer.escrowHash && (
                  <div className="text-xs">
                    <p className="text-muted-foreground">Escrow Hash:</p>
                    <p className="font-mono break-all">{transfer.escrowHash}</p>
                  </div>
                )}

                {transfer.status === 'escrowed' && (
                  <div className="space-y-2">
                    {blockedByDispute && (
                      <Alert className="border-destructive/30 bg-destructive/10">
                        <AlertDescription className="text-sm text-foreground">
                          <strong>Blocked:</strong> This parcel is under dispute. Transfer actions are disabled until the dispute is resolved.
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => handleCompleteTransfer(transfer.id)}
                      disabled={restrictedUser || blockedByDispute}
                      className="flex-1"
                    >
                      Complete Transfer
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleCancelTransfer(transfer.id)}
                      disabled={restrictedUser || blockedByDispute}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                  </div>
                )}

                {transfer.status === 'completed' && transfer.completedDate && (
                  <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                    ✓ Transfer completed on {transfer.completedDate}
                  </div>
                )}

                {transfer.status === 'cancelled' && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    ✗ Transfer was cancelled
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {transfers.length === 0 && (
        <div className="text-center py-12">
          <ArrowRightLeft className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No transfers found</h3>
          <p className="text-muted-foreground">Initiate your first land ownership transfer to get started.</p>
        </div>
      )}
    </div>
  );
}