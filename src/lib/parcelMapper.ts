/**
 * Maps API parcel responses to frontend LandParcel shape
 */
import type { LandParcel } from './mockData';

export function mapApiParcelToLandParcel(p: {
  id: string;
  title: string;
  description?: string;
  area?: number;
  price?: number;
  priceGhs?: number;
  location?: string | { address: string; latitude?: number; longitude?: number; region?: string };
  status: string;
  ownerId?: string;
  sellerId?: string;
  registryClearance?: 'clear' | 'flagged';
  redFlag?: LandParcel['redFlag'];
  type?: string;
  documentsVerificationStatus?: string;
  createdAt: string;
  updatedAt?: string;
  owner?: { id: string; name: string; email: string };
  seller?: { id: string; name?: string; email?: string };
  documents?: Array<{
    id: string;
    name: string;
    type: string;
    url: string;
    verificationStatus?: string;
    verifiedAt?: string | null;
  }>;
  images?: Array<{
    id: string;
    url: string;
    caption: string;
    type: string;
    displayOrder?: number;
    uploadedAt?: string;
  }>;
  comments?: Array<{
    id: string;
    userId: string;
    content: string;
    user?: { id: string; name: string };
  }>;
  transfers?: Array<{
    chainTxHash?: string | null;
    chainNetwork?: string | null;
    transactionHash?: string | null;
    chainSaleId?: string | null;
  }>;
  blockchainHash?: string | null;
}): LandParcel {
  const last = p.transfers?.[0];
  const loc =
    typeof p.location === 'string'
      ? {
          address: p.location,
          coordinates: { lat: 5.6, lng: -0.19 },
          region: 'Greater Accra'
        }
      : {
          address: p.location?.address ?? '',
          coordinates: {
            lat: p.location?.latitude ?? 5.6,
            lng: p.location?.longitude ?? -0.19
          },
          region: p.location?.region ?? 'Greater Accra'
        };
  const priceVal = typeof p.price === 'number' ? p.price : typeof p.priceGhs === 'number' ? p.priceGhs : 0;
  const areaVal = typeof p.area === 'number' ? p.area : 0;
  const rawImages = (p.images ?? []).map(img => ({
    id: img.id,
    url: img.url,
    caption: img.caption ?? '',
    type: (img.type as 'main' | 'aerial' | 'boundary' | 'interior' | 'exterior') ?? 'main',
    uploadedAt: img.uploadedAt ?? new Date().toISOString()
  }));
  const docStatus = (p.documentsVerificationStatus as 'pending' | 'verified' | 'rejected' | undefined) ?? 'pending';
  let parcelStatus = (p.status as LandParcel['status']) ?? 'available';
  if (docStatus !== 'verified' && parcelStatus === 'available') {
    parcelStatus = 'pending';
  }
  return {
    id: p.id,
    title: p.title,
    description: p.description ?? '',
    location: loc,
    area: areaVal,
    price: priceVal,
    status: parcelStatus,
    ownerId: p.ownerId ?? p.sellerId ?? '',
    registryClearance: p.registryClearance ?? 'clear',
    redFlag: p.redFlag ?? null,
    owner: p.owner?.name ?? p.seller?.name ?? 'Unknown',
    documents: (p.documents ?? []).map(d => ({
      id: d.id,
      name: d.name,
      type: d.type,
      url: d.url,
      uploadedAt: '',
      verificationStatus: d.verificationStatus as 'pending' | 'verified' | 'rejected' | undefined
    })),
    documentsVerificationStatus: docStatus,
    images: rawImages,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt ?? p.createdAt,
    type: (p.type as LandParcel['type']) ?? 'residential',
    comments: (p.comments ?? []).map(c => ({
      id: c.id,
      userId: c.userId,
      userName: c.user?.name ?? 'Unknown',
      content: c.content,
      timestamp: '',
      likes: 0
    })),
    paystackReference: last?.transactionHash ?? undefined,
    chainAnchorTxHash: last?.chainTxHash ?? undefined,
    chainNetwork: last?.chainNetwork ?? undefined,
    blockchainHash: last?.chainSaleId ?? p.blockchainHash
  };
}
