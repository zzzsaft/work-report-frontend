import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { LoadingScreen } from "@/components/auth/LoadingScreen";
import { AdminIndexRedirect, AdminRouteGuard, CapabilityGuard } from "@/components/auth/CapabilityGuard";
import AuthCallback from "@/pages/AuthCallback";

const MobileLayout = lazy(() => import("@/components/layout/MobileLayout"));
const AdminLayout = lazy(() => import("@/components/layout/AdminLayout"));
const XftRedirectPage = lazy(() => import("@/pages/XftRedirectPage"));
const mobilePages = import("@/pages/mobile/MobilePages");
const adminPages = import("@/pages/admin/AdminPages");
const ClaimOperationsPage = lazy(() => mobilePages.then((m) => ({ default: m.ClaimOperationsPage })));
const OperationsPage = lazy(() => mobilePages.then((m) => ({ default: m.OperationsPage })));
const StatsPage = lazy(() => mobilePages.then((m) => ({ default: m.StatsPage })));
const ProfilePage = lazy(() => mobilePages.then((m) => ({ default: m.ProfilePage })));
const DashboardPage = lazy(() => adminPages.then((m) => ({ default: m.DashboardPage })));
const OrdersPage = lazy(() => adminPages.then((m) => ({ default: m.OrdersPage })));
const LeaderImportPage = lazy(() => adminPages.then((m) => ({ default: m.LeaderImportPage })));
const AssignmentAdminPage = lazy(() => adminPages.then((m) => ({ default: m.AssignmentAdminPage })));
const ReportsPage = lazy(() => adminPages.then((m) => ({ default: m.ReportsPage })));
const PeoplePage = lazy(() => adminPages.then((m) => ({ default: m.PeoplePage })));
const PermissionsPage = lazy(() => adminPages.then((m) => ({ default: m.PermissionsPage })));
const AccountsPage = lazy(() => adminPages.then((m) => ({ default: m.AccountsPage })));
const WeComPage = lazy(() => adminPages.then((m) => ({ default: m.WeComPage })));
const ExceptionsPage = lazy(() => adminPages.then((m) => ({ default: m.ExceptionsPage })));
const SettingsPage = lazy(() => adminPages.then((m) => ({ default: m.SettingsPage })));
const requireAuth = import.meta.env.VITE_REQUIRE_AUTH !== "false";

function ProtectedApp() {
  const routes = <Suspense fallback={<LoadingScreen text="正在加载页面..." />}><Routes>
    <Route path="/xft/redirect" element={<XftRedirectPage />} />
    <Route element={<MobileLayout />}><Route path="/work/claim" element={<ClaimOperationsPage />} /><Route path="/work/current" element={<Navigate to="/work/claim" replace />} /><Route path="/work/operations" element={<OperationsPage />} /><Route path="/work/stats" element={<StatsPage />} /><Route path="/me" element={<ProfilePage />} /></Route>
    <Route path="/admin" element={<CapabilityGuard><AdminLayout /></CapabilityGuard>}><Route index element={<AdminIndexRedirect />} /><Route path="dashboard" element={<AdminRouteGuard routeKey="dashboard"><DashboardPage /></AdminRouteGuard>} /><Route path="orders" element={<AdminRouteGuard routeKey="orders"><OrdersPage /></AdminRouteGuard>} /><Route path="import" element={<AdminRouteGuard routeKey="import"><LeaderImportPage /></AdminRouteGuard>} /><Route path="assignments" element={<AdminRouteGuard routeKey="assignments"><AssignmentAdminPage /></AdminRouteGuard>} /><Route path="reports" element={<AdminRouteGuard routeKey="reports"><ReportsPage /></AdminRouteGuard>} /><Route path="people" element={<AdminRouteGuard routeKey="people"><PeoplePage /></AdminRouteGuard>} /><Route path="permissions" element={<AdminRouteGuard routeKey="permissions"><PermissionsPage /></AdminRouteGuard>} /><Route path="accounts" element={<AdminRouteGuard routeKey="accounts"><AccountsPage /></AdminRouteGuard>} /><Route path="wecom" element={<AdminRouteGuard routeKey="wecom"><WeComPage /></AdminRouteGuard>} /><Route path="exceptions" element={<AdminRouteGuard routeKey="exceptions"><ExceptionsPage /></AdminRouteGuard>} /><Route path="settings" element={<AdminRouteGuard routeKey="settings"><SettingsPage /></AdminRouteGuard>} /></Route>
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
