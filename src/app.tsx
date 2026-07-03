import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import NotFoundPage from "@/pages/NotFoundPage/NotFoundPage";
import DashboardPage from "@/pages/DashboardPage/DashboardPage";
import ProcurementPage from "@/pages/ProcurementPage/ProcurementPage";
import UnreceivedPage from "@/pages/UnreceivedPage/UnreceivedPage";
import ShippingPage from "@/pages/ShippingPage/ShippingPage";
import LoginPage from "@/pages/LoginPage/LoginPage";
import DeployGuidePage from "@/pages/DeployGuidePage/DeployGuidePage";

function ProtectedRoutes() {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="procurement" element={<ProcurementPage />} />
        <Route path="unreceived" element={<UnreceivedPage />} />
        <Route path="shipping" element={<ShippingPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/deploy-guide" element={<DeployGuidePage />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </AuthProvider>
  );
}
