import { DashboardLayout } from '@/components/DashboardLayout';
import { LandRegistry } from '@/components/LandRegistry';
import { useAuth } from '@/contexts/AuthContext';

export default function BuyerDashboard() {
  const { user } = useAuth();
  return (
    <DashboardLayout
      role="buyer"
      title="Buyer Dashboard"
      subtitle="Search land, make offers, and complete secure purchases"
    >
      <LandRegistry currentUser={user ?? undefined} />
    </DashboardLayout>
  );
}
