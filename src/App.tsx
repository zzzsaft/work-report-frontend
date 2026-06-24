import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CapabilityGuard } from "@/components/auth/CapabilityGuard";
import AuthCallback from "@/pages/AuthCallback";

const MobileLayout = lazy(() => import("@/components/layout/MobileLayout"));
const AdminLayout = lazy(() => import("@/components/layout/AdminLayout"));
const mobilePages = import("@/pages/mobile/MobilePages");
const adminPages = import("@/pages/admin/AdminPages");
const ClaimOperationsPage = lazy(() => mobilePages.then((m) => ({ default: m.ClaimOperationsPage })));
const ProfilePage = lazy(() => mobilePages.then((m) => ({ default: m.ProfilePage })));
const DashboardPage = lazy(() => adminPages.then((m) => ({ default: m.DashboardPage })));
const OrdersPage = lazy(() => adminPages.then((m) => ({ default: m.OrdersPage })));
const LeaderImportPage = lazy(() => adminPages.then((m) => ({ default: m.LeaderImportPage })));
const AssignmentAdminPage = lazy(() => adminPages.then((m) => ({ default: m.AssignmentAdminPage })));
const ReportsPage = lazy(() => adminPages.then((m) => ({ default: m.ReportsPage })));
const PeoplePage = lazy(() => adminPages.then((m) => ({ default: m.PeoplePage })));
const ExceptionsPage = lazy(() => adminPages.then((m) => ({ default: m.ExceptionsPage })));
const SettingsPage = lazy(() => adminPages.then((m) => ({ default: m.SettingsPage })));
const requireAuth = import.meta.env.VITE_REQUIRE_AUTH !== "false";

function ProtectedApp() {
  const routes = <Suspense fallback={<div className="page-state"><span className="spinner" /><p>正在加载页面...</p></div>}><Routes>
    <Route element={<MobileLayout />}><Route path="/work/claim" element={<ClaimOperationsPage />} /><Route path="/work/current" element={<Navigate to="/work/claim" replace />} /><Route path="/work/operations" element={<Navigate to="/work/claim" replace />} /><Route path="/work/stats" element={<Navigate to="/work/claim" replace />} /><Route path="/me" element={<ProfilePage />} /></Route>
    <Route path="/admin" element={<CapabilityGuard><AdminLayout /></CapabilityGuard>}><Route index element={<Navigate to="dashboard" replace />} /><Route path="dashboard" element={<DashboardPage />} /><Route path="orders" element={<OrdersPage />} /><Route path="import" element={<LeaderImportPage />} /><Route path="assignments" element={<AssignmentAdminPage />} /><Route path="reports" element={<ReportsPage />} /><Route path="people" element={<PeoplePage />} /><Route path="exceptions" element={<ExceptionsPage />} /><Route path="settings" element={<SettingsPage />} /></Route>
    <Route path="*" element={<Navigate to="/work/claim" replace />} />
  </Routes></Suspense>;
  return requireAuth ? <AuthGuard>{routes}</AuthGuard> : routes;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth-callback" element={<AuthCallback />} />
        <Route path="*" element={<ProtectedApp />} />
      </Routes>
    </BrowserRouter>
  );
}
