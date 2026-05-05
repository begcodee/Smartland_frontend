import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/initials';
import { formatCurrency } from '@/lib/mockData';
import { 
  MapPin, Info, DollarSign, Ruler, Calendar, User, 
  MessageSquare, Send, Heart, Share2, Eye
} from 'lucide-react';

interface LandParcel {
  id: string;
  title: string;
  location: string;
  coordinates: { lat: number; lng: number };
  area: number;
  price: number;
  owner: string;
  status: 'available' | 'sold' | 'disputed' | 'pending';
  registrationDate: string;
  description: string;
  region: string;
  district: string;
  comments: Comment[];
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
  likes: number;
}

const ghanaLandParcels: LandParcel[] = [
  {
    id: 'GH001',
    title: 'Residential Plot - East Legon',
    location: 'East Legon, Accra',
    coordinates: { lat: 5.6037, lng: -0.1870 },
    area: 1200,
    price: 85000,
    owner: 'Kwame Asante',
    status: 'available',
    registrationDate: '2024-03-15',
    description: 'Prime residential land in East Legon with easy access to main roads and utilities.',
    region: 'Greater Accra',
    district: 'Accra Metropolitan',
    comments: [
      {
        id: 'C001',
        userId: 'U001',
        userName: 'Ama Osei',
        content: 'This looks like a great location! Is water and electricity readily available?',
        timestamp: '2024-10-08T14:30:00Z',
        likes: 3
      },
      {
        id: 'C002',
        userId: 'U002',
        userName: 'John Mensah',
        content: 'I know this area well. Very good for residential development.',
        timestamp: '2024-10-09T09:15:00Z',
        likes: 5
      }
    ]
  },
  {
    id: 'GH002',
    title: 'Commercial Land - Kumasi',
    location: 'Adum, Kumasi',
    coordinates: { lat: 6.6885, lng: -1.6244 },
    area: 2500,
    price: 120000,
    owner: 'Akosua Frimpong',
    status: 'pending',
    registrationDate: '2024-02-20',
    description: 'Strategic commercial land in the heart of Kumasi business district.',
    region: 'Ashanti',
    district: 'Kumasi Metropolitan',
    comments: [
      {
        id: 'C003',
        userId: 'U003',
        userName: 'Kofi Boateng',
        content: 'Perfect for a shopping complex. The location has high foot traffic.',
        timestamp: '2024-10-07T16:45:00Z',
        likes: 8
      }
    ]
  },
  {
    id: 'GH003',
    title: 'Agricultural Land - Brong Ahafo',
    location: 'Sunyani, Brong Ahafo',
    coordinates: { lat: 7.3392, lng: -2.3265 },
    area: 5000,
    price: 45000,
    owner: 'Yaw Oppong',
    status: 'available',
    registrationDate: '2024-01-10',
    description: 'Fertile agricultural land suitable for cocoa and food crop cultivation.',
    region: 'Bono',
    district: 'Sunyani Municipal',
    comments: [
      {
        id: 'C004',
        userId: 'U004',
        userName: 'Abena Serwaa',
        content: 'Is this land suitable for organic farming? The soil looks very fertile.',
        timestamp: '2024-10-06T11:20:00Z',
        likes: 2
      }
    ]
  },
  {
    id: 'GH004',
    title: 'Coastal Land - Cape Coast',
    location: 'Cape Coast, Central Region',
    coordinates: { lat: 5.1053, lng: -1.2466 },
    area: 800,
    price: 95000,
    owner: 'Efua Asamoah',
    status: 'disputed',
    registrationDate: '2024-04-05',
    description: 'Beautiful coastal land with tourism potential near Cape Coast Castle.',
    region: 'Central',
    district: 'Cape Coast Metropolitan',
    comments: [
      {
        id: 'C005',
        userId: 'U005',
        userName: 'Samuel Nkrumah',
        content: 'This would be perfect for a beach resort. What are the zoning restrictions?',
        timestamp: '2024-10-05T13:10:00Z',
        likes: 6
      }
    ]
  }
];

export const GhanaMapViewer = () => {
  const [selectedParcel, setSelectedParcel] = useState<LandParcel | null>(null);
  const [hoveredParcel, setHoveredParcel] = useState<LandParcel | null>(null);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<{ [key: string]: Comment[] }>({});

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'sold': return 'bg-gray-500';
      case 'disputed': return 'bg-red-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'available': return 'default';
      case 'sold': return 'secondary';
      case 'disputed': return 'destructive';
      case 'pending': return 'outline';
      default: return 'default';
    }
  };

  const addComment = (parcelId: string) => {
    if (!newComment.trim()) return;
    
    const comment: Comment = {
      id: `C${Date.now()}`,
      userId: 'current_user',
      userName: 'Current User',
      content: newComment,
      timestamp: new Date().toISOString(),
      likes: 0
    };

    setComments(prev => ({
      ...prev,
      [parcelId]: [...(prev[parcelId] || []), comment]
    }));
    setNewComment('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-600" />
            Ghana Land Registry Map
          </CardTitle>
          <CardDescription>
            Interactive map showing available land parcels across Ghana. Hover over markers for quick details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Simulated Map Container */}
          <div className="relative h-96 bg-gradient-to-br from-green-100 to-blue-100 rounded-lg border-2 border-dashed border-gray-300 overflow-hidden">
            {/* Map Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-blue-50">
              <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow-sm">
                <p className="text-xs font-medium text-gray-700">🇬🇭 Ghana Land Registry</p>
              </div>
            </div>

            {/* Land Parcel Markers */}
            {ghanaLandParcels.map((parcel, index) => (
              <div
                key={parcel.id}
                className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${20 + index * 20}%`,
                  top: `${30 + (index % 2) * 30}%`
                }}
                onMouseEnter={() => setHoveredParcel(parcel)}
                onMouseLeave={() => setHoveredParcel(null)}
                onClick={() => setSelectedParcel(parcel)}
              >
                {/* Marker */}
                <div className={`w-4 h-4 rounded-full ${getStatusColor(parcel.status)} border-2 border-white shadow-lg animate-pulse`}></div>
                
                {/* Hover Tooltip */}
                {hoveredParcel?.id === parcel.id && (
                  <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white p-3 rounded-lg shadow-lg border z-10 min-w-48">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{parcel.title}</p>
                      <p className="text-xs text-muted-foreground">{parcel.location}</p>
                      <div className="flex items-center justify-between">
                        <Badge variant={getStatusBadgeVariant(parcel.status)} className="text-xs">
                          {parcel.status}
                        </Badge>
                        <span className="text-xs font-medium">{formatCurrency(parcel.price)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{parcel.area} m² • {parcel.region}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Map Legend */}
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-sm">
              <p className="text-xs font-medium mb-2">Status Legend</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <span>Pending</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span>Disputed</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                  <span>Sold</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Land Parcel Details Dialog */}
      {selectedParcel && (
        <Dialog open={!!selectedParcel} onOpenChange={() => setSelectedParcel(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                {selectedParcel.title}
              </DialogTitle>
              <DialogDescription>
                Detailed information about this land parcel
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium">Location</p>
                          <p className="text-xs text-muted-foreground">{selectedParcel.location}</p>
                          <p className="text-xs text-muted-foreground">{selectedParcel.region} Region, {selectedParcel.district}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <div>
                          <p className="text-sm font-medium">Price</p>
                          <p className="text-lg font-bold text-green-600">{formatCurrency(selectedParcel.price)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Ruler className="w-4 h-4 text-purple-600" />
                        <div>
                          <p className="text-sm font-medium">Area</p>
                          <p className="text-sm">{selectedParcel.area} m²</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-indigo-600" />
                        <div>
                          <p className="text-sm font-medium">Owner</p>
                          <p className="text-sm">{selectedParcel.owner}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-orange-600" />
                        <div>
                          <p className="text-sm font-medium">Registration Date</p>
                          <p className="text-sm">{formatDate(selectedParcel.registrationDate)}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-1">Status</p>
                        <Badge variant={getStatusBadgeVariant(selectedParcel.status)}>
                          {selectedParcel.status.charAt(0).toUpperCase() + selectedParcel.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Description */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">{selectedParcel.description}</p>
                </CardContent>
              </Card>

              {/* Comments Section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageSquare className="w-5 h-5" />
                    Comments ({selectedParcel.comments.length + (comments[selectedParcel.id]?.length || 0)})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Existing Comments */}
                  {selectedParcel.comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(comment.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{comment.userName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(comment.timestamp)}
                          </p>
                        </div>
                        <p className="text-sm text-gray-700">{comment.content}</p>
                        <div className="flex items-center gap-4">
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                            <Heart className="w-3 h-3 mr-1" />
                            {comment.likes}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                            <Share2 className="w-3 h-3 mr-1" />
                            Reply
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* New Comments */}
                  {comments[selectedParcel.id]?.map((comment) => (
                    <div key={comment.id} className="flex gap-3 p-3 bg-blue-50 rounded-lg">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">CU</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{comment.userName}</p>
                          <p className="text-xs text-muted-foreground">Just now</p>
                        </div>
                        <p className="text-sm text-gray-700">{comment.content}</p>
                      </div>
                    </div>
                  ))}

                  {/* Add Comment */}
                  <div className="flex gap-3 p-3 border-2 border-dashed border-gray-200 rounded-lg">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">You</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Textarea
                        placeholder="Add a comment about this land parcel..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="min-h-[60px]"
                      />
                      <div className="flex justify-end">
                        <Button 
                          onClick={() => addComment(selectedParcel.id)}
                          disabled={!newComment.trim()}
                          size="sm"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Post Comment
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Available Parcels</p>
                <p className="text-2xl font-bold text-green-900">
                  {ghanaLandParcels.filter(p => p.status === 'available').length}
                </p>
              </div>
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <MapPin className="w-4 h-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Total Area</p>
                <p className="text-2xl font-bold text-blue-900">
                  {(ghanaLandParcels.reduce((sum, p) => sum + p.area, 0) / 1000).toFixed(1)}K m²
                </p>
              </div>
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <Ruler className="w-4 h-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">Total Value</p>
                <p className="text-2xl font-bold text-purple-900">
                  {formatCurrency(ghanaLandParcels.reduce((sum, p) => sum + p.price, 0))}
                </p>
              </div>
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-orange-50 to-orange-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700">Active Comments</p>
                <p className="text-2xl font-bold text-orange-900">
                  {ghanaLandParcels.reduce((sum, p) => sum + p.comments.length, 0)}
                </p>
              </div>
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};