import { DashboardLayout } from '@/components/DashboardLayout';
import { Analytics } from '@/components/Analytics';
import { RegistrationReview } from '@/components/RegistrationReview';
import { ParcelDocumentReview } from '@/components/ParcelDocumentReview';

export default function AdminDashboard() {
  return (
    <DashboardLayout
      role="admin"
      title="Admin Dashboard"
    >
      <div className="space-y-6">
        <RegistrationReview />
        <ParcelDocumentReview />
        <Analytics />
      </div>
    </DashboardLayout>
  );
}
