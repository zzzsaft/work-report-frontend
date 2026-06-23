import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CapabilityGuard } from "@/components/auth/CapabilityGuard";
import AuthCallback from "@/pages/AuthCallback";
import { isMockMode } from "@/api/services/workReport.service";

const MobileLayout = lazy(() => import("@/components/layout/MobileLayout"));
const AdminLayout = lazy(() => import("@/components/layout/AdminLayout"));
const mobilePages = import("@/pages/mobile/MobilePages");
const adminPages = import("@/pages/admin/AdminPages");
const CurrentOperationPage = lazy(() => mobilePages.then((m) => ({ default: m.CurrentOperationPage })));
const OperationsPage = lazy(() => mobilePages.then((m) => ({ default: m.OperationsPage })));
const StatsPage = lazy(() => mobilePages.then((m) => ({ default: m.StatsPage })));
const ProfilePage = lazy(() => mobilePages.then((m) => ({ default: m.ProfilePage })));
const DashboardPage = lazy(() => adminPages.then((m) => ({ default: m.DashboardPage })));
const OrdersPage = lazy(() => adminPages.then((m) => ({ default: m.OrdersPage })));
const ReportsPage = lazy(() => adminPages.then((m) => ({ default: m.ReportsPage })));
const PeoplePage = lazy(() => adminPages.then((m) => ({ default: m.PeoplePage })));
const ExceptionsPage = lazy(() => adminPages.then((m) => ({ default: m.ExceptionsPage })));
const SettingsPage = lazy(() => adminPages.then((m) => ({ default: m.SettingsPage })));

function ProtectedApp() {
  const routes = <Suspense fallback={<div className="page-state"><span className="spinner" /><p>正在加载页面...</p></div>}><Routes>
    <Route element={<MobileLayout />}><Route path="/work/current" element={<CurrentOperationPage />} /><Route path="/work/operations" element={<OperationsPage />} /><Route path="/work/stats" element={<StatsPage />} /><Route path="/me" element={<ProfilePage />} /></Route>
    <Route path="/admin" element={<CapabilityGuard><AdminLayout /></CapabilityGuard>}><Route index element={<Navigate to="dashboard" replace />} /><Route path="dashboard" element={<DashboardPage />} /><Route path="orders" element={<OrdersPage />} /><Route path="reports" element={<ReportsPage />} /><Route path="people" element={<PeoplePage />} /><Route path="exceptions" element={<ExceptionsPage />} /><Route path="settings" element={<SettingsPage />} /></Route>
    <Route path="*" element={<Navigate to="/work/current" replace />} />
  </Routes></Suspense>;
  return isMockMode ? routes : <AuthGuard>{routes}</AuthGuard>;
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
