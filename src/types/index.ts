export interface LandParcel {
  id: string;
  title: string;
  owner: string;
  location: {
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  area: number; // in square meters
  registrationDate: string;
  lastTransfer: string;
  value: number; // in USD
  status: 'active' | 'disputed' | 'transfer_pending';
  registryClearance?: 'clear' | 'flagged';
  documents: string[];
  blockchainHash: string;
}

export interface Dispute {
  id: string;
  landParcelId: string;
  plaintiff: string;
  defendant: string;
  description: string;
  evidence: string[];
  status: 'filed' | 'pending' | 'under_review' | 'community_voting' | 'resolved';
  filedDate: string;
  resolution?: string;
  votes?: {
    support: number;
    against: number;
    abstain: number;
  };
  arbitrator?: string;
}

export interface Transfer {
  id: string;
  landParcelId: string;
  from: string;
  to: string;
  amount: number;
  status: 'pending' | 'escrowed' | 'completed' | 'cancelled';
  initiatedDate: string;
  completedDate?: string;
  escrowHash?: string;
}

/** User type - aligned with @/lib/mockData */
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'lands_commission' | 'seller' | 'buyer' | 'arbitrator';
  verificationStatus: 'pending' | 'verified' | 'rejected';
  country: string;
  phoneNumber: string;
  organization?: string;
  reputation?: {
    score: number;
    totalTransactions: number;
    successfulTransactions: number;
    disputesWon: number;
    communityVotes: number;
  };
  creditScore?: {
    score: number;
    rating: string;
    paymentHistory: number;
    creditUtilization: number;
    lengthOfHistory: number;
    newCredit: number;
    creditMix: number;
  };
  financialProfile?: {
    monthlyIncome: number;
    assets: number;
    liabilities: number;
    netWorth: number;
    bankingHistory: number;
  };
  idVerification?: { status: 'pending' | 'verified' | 'rejected'; [k: string]: unknown };
  /**
   * Lands Commission identity decision for Ghana Card submissions.
   */
  identityStatus?: 'not_submitted' | 'pending' | 'verified' | 'rejected';
  identityReferenceId?: string;
}

export interface SmartContract {
  address: string;
  type: 'ownership' | 'transfer' | 'dispute' | 'escrow';
  status: 'active' | 'executed' | 'cancelled';
  createdAt: string;
  parameters: Record<string, string | number | boolean>;
}