import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/initials';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User, Settings, Shield, MapPin, Building, CreditCard, Star, Trophy, PieChart,
  Mail, Phone, TrendingUp
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/mockData';

interface UserProfileDialogProps {
  /** Controlled mode: when provided, renders only the dialog (no trigger) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const UserProfileDialog = ({ open, onOpenChange }: UserProfileDialogProps = {}) => {
  const { user, logout, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', email: '', phoneNumber: '' });

  if (!user) return null;

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'seller': return <MapPin className="w-4 h-4" />;
      case 'buyer': return <User className="w-4 h-4" />;
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'arbitrator': return <Building className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'seller': return 'bg-emerald-100 text-emerald-800';
      case 'buyer': return 'bg-cyan-100 text-cyan-800';
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'arbitrator': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVerificationColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getReputationLevel = (score: number) => {
    if (score >= 95) return { level: 'Excellent', color: 'text-green-600', icon: '🏆' };
    if (score >= 85) return { level: 'Very Good', color: 'text-blue-600', icon: '⭐' };
    if (score >= 70) return { level: 'Good', color: 'text-orange-600', icon: '👍' };
    if (score >= 50) return { level: 'Fair', color: 'text-yellow-600', icon: '👌' };
    return { level: 'Poor', color: 'text-red-600', icon: '⚠️' };
  };

  const handleEditStart = () => {
    setEditData({ name: user.name, email: user.email, phoneNumber: user.phoneNumber });
    setIsEditing(true);
  };

  const handleSaveProfile = () => {
    updateUser(editData);
    setIsEditing(false);
  };

  const reputation = user.reputation ? getReputationLevel(user.reputation.score) : null;
  const avgStars = user.reputation && user.reputation.communityVotes > 0
    ? Math.max(0, Math.min(5, user.reputation.score / 20))
    : 0;

  const content = (
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile
            </DialogTitle>
            <DialogDescription>
              Your account and reputation
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="profile" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="reputation">Reputation & votes</TabsTrigger>
              <TabsTrigger value="credit">Credit score</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} />
                  <AvatarFallback className="text-xl">{getInitials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold">{user.name}</h3>
                    <Badge className={getRoleColor(user.role)}>
                      {getRoleIcon(user.role)}
                      <span className="ml-1 capitalize">{user.role}</span>
                    </Badge>
                  </div>
                  <Badge className={getVerificationColor(user.verificationStatus)}>
                    <Shield className="w-3 h-3 mr-1" />
                    {user.verificationStatus}
                  </Badge>
                  {reputation && (
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span className="font-medium">{user.reputation!.score}/100</span>
                      <span className={reputation.color}>{reputation.icon} {reputation.level}</span>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={editData.phoneNumber} onChange={(e) => setEditData({ ...editData, phoneNumber: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveProfile}>Save</Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="font-medium">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="font-medium">{user.phoneNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Country</p>
                        <p className="font-medium">{user.country}</p>
                      </div>
                    </div>
                    {user.organization && (
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Organization</p>
                          <p className="font-medium">{user.organization}</p>
                        </div>
                      </div>
                    )}
                    {user.blockchainToken && (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-emerald-600" />
                          <div>
                            <p className="text-xs text-muted-foreground">Blockchain token (unique ID)</p>
                            <p className="font-mono text-sm break-all">{user.blockchainToken}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(user.blockchainToken!);
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                    )}
                  </div>
                  <Button variant="outline" onClick={handleEditStart}>
                    <Settings className="w-4 h-4 mr-2" />
                    Edit profile
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="reputation" className="space-y-4">
              {user.reputation ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        Reputation
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-3xl font-bold">{user.reputation.score}/100</p>
                        {reputation && (
                          <p className={`text-sm ${reputation.color}`}>{reputation.icon} {reputation.level}</p>
                        )}
                        {user.reputation.communityVotes > 0 && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${avgStars >= i + 1 ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`}
                                />
                              ))}
                            </span>
                            <span>{avgStars.toFixed(1)}/5</span>
                            <span>·</span>
                            <span>{user.reputation.communityVotes} rating(s)</span>
                          </div>
                        )}
                      </div>
                      <Progress value={user.reputation.score} className="h-3" />
                    </CardContent>
                  </Card>
                  <div className="grid grid-cols-2 gap-3">
                    <Card>
                      <CardContent className="pt-4">
                        <TrendingUp className="w-6 h-6 text-cyan-500 mb-2" />
                        <div className="text-xl font-bold">{user.reputation.totalTransactions}</div>
                        <p className="text-xs text-muted-foreground">Transactions</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <Trophy className="w-6 h-6 text-green-500 mb-2" />
                        <div className="text-xl font-bold">{user.reputation.successfulTransactions}</div>
                        <p className="text-xs text-muted-foreground">Successful</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <Shield className="w-6 h-6 text-amber-500 mb-2" />
                        <div className="text-xl font-bold">{user.reputation.disputesWon}</div>
                        <p className="text-xs text-muted-foreground">Disputes won</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <Star className="w-6 h-6 text-purple-500 mb-2" />
                        <div className="text-xl font-bold">{user.reputation.communityVotes}</div>
                        <p className="text-xs text-muted-foreground">Community votes</p>
                      </CardContent>
                    </Card>
                  </div>
                  {user.reputation.totalTransactions > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Success rate: {Math.round((user.reputation.successfulTransactions / user.reputation.totalTransactions) * 100)}%
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">No reputation data yet. Complete transactions to build your score.</p>
              )}
            </TabsContent>

            <TabsContent value="credit" className="space-y-4">
              {user.creditScore ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-cyan-500" />
                        Credit score
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-3xl font-bold">{user.creditScore.score}</p>
                          <p className="text-sm text-muted-foreground">{user.creditScore.rating}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Payment history</span>
                          <span>{user.creditScore.paymentHistory}%</span>
                        </div>
                        <Progress value={user.creditScore.paymentHistory} className="h-2" />
                        <div className="flex justify-between text-sm">
                          <span>Credit utilization</span>
                          <span>{user.creditScore.creditUtilization}%</span>
                        </div>
                        <Progress value={100 - user.creditScore.creditUtilization} className="h-2" />
                        <div className="flex justify-between text-sm">
                          <span>Length of history</span>
                          <span>{user.creditScore.lengthOfHistory}%</span>
                        </div>
                        <Progress value={user.creditScore.lengthOfHistory} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">No credit score data yet.</p>
              )}
            </TabsContent>

            <TabsContent value="financial" className="space-y-4">
              {user.financialProfile ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <PieChart className="w-6 h-6 text-emerald-500 mb-2" />
                      <p className="text-xs text-muted-foreground">Monthly income</p>
                      <p className="text-xl font-bold text-emerald-600">{formatCurrency(user.financialProfile.monthlyIncome)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <TrendingUp className="w-6 h-6 text-cyan-500 mb-2" />
                      <p className="text-xs text-muted-foreground">Net worth</p>
                      <p className="text-xl font-bold text-cyan-600">{formatCurrency(user.financialProfile.netWorth)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Total assets</p>
                      <p className="text-xl font-bold">{formatCurrency(user.financialProfile.assets)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Banking history</p>
                      <p className="text-xl font-bold">{user.financialProfile.bankingHistory} years</p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No financial profile data yet.</p>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
  );

  if (open !== undefined && onOpenChange !== undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {content}
      </Dialog>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 h-auto p-2">
          <Avatar className="w-8 h-8">
            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`} />
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
          </div>
        </Button>
      </DialogTrigger>
      {content}
    </Dialog>
  );
};
