'use client';

import { useEffect } from 'react';
import { Toaster } from '@/lib/appToast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ThemeProvider } from '@/components/ThemeProvider';
import Index from './views/Index';
import AdminDashboard from './views/AdminDashboard';
import SellerDashboard from './views/SellerDashboard';
import BuyerDashboard from './views/BuyerDashboard';
import ArbitratorDashboard from './views/ArbitratorDashboard';
import NotFound from './views/NotFound';
import PaymentCallback from './views/PaymentCallback';
import LandsCommissionDashboard from './views/LandsCommissionDashboard';
import VerificationStatusPage from './views/VerificationStatus';
import { purgeLocalIdentityArtifactsFromEnv } from './lib/localIdentityCleanup';

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    purgeLocalIdentityArtifactsFromEnv();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <Toaster />
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/payment/callback" element={<PaymentCallback />} />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/seller"
                  element={
                    <ProtectedRoute allowedRoles={['seller']}>
                      <SellerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/buyer"
                  element={
                    <ProtectedRoute allowedRoles={['buyer']}>
                      <BuyerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/verification/status"
                  element={
                    <ProtectedRoute allowedRoles={['buyer', 'seller']}>
                      <VerificationStatusPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/verification-status"
                  element={
                    <ProtectedRoute allowedRoles={['buyer', 'seller']}>
                      <VerificationStatusPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/arbitrator"
                  element={
                    <ProtectedRoute allowedRoles={['arbitrator']}>
                      <ArbitratorDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/lands-commission"
                  element={
                    <ProtectedRoute allowedRoles={['lands_commission']}>
                      <LandsCommissionDashboard />
                    </ProtectedRoute>
                  }
                />
                {/* Legacy route removed: verification authority is Ghana Lands Commission */}
                <Route path="/404" element={<NotFound />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
