import { DashboardLayout } from '@/components/DashboardLayout';
import { LandRegistry } from '@/components/LandRegistry';
import { useAuth } from '@/contexts/AuthContext';
import { SellerSalesRatings } from '@/components/SellerSalesRatings';

export default function SellerDashboard() {
  const { user } = useAuth();
  return (
    <DashboardLayout
      role="seller"
      title="Seller Dashboard"
      subtitle="List and manage your land parcels; receive payments securely"
    >
      <LandRegistry currentUser={user ?? undefined} />
      <SellerSalesRatings />
    </DashboardLayout>
  );
}
