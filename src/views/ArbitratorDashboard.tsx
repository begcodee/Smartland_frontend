import { DashboardLayout } from '@/components/DashboardLayout';
import { FlaggedRegistryParcels } from '@/components/FlaggedRegistryParcels';
import ArbitrationCaseManager from '@/components/ArbitrationCaseManager';

export default function ArbitratorDashboard() {
  return (
    <DashboardLayout
      role="arbitrator"
      title="Arbitrator Dashboard"
      subtitle="Review disputes, evidence, and propose resolutions"
    >
      <div className="space-y-6">
        <FlaggedRegistryParcels />
        <ArbitrationCaseManager />
      </div>
    </DashboardLayout>
  );
}
