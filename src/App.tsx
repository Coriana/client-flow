import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import Invoices from "./pages/Invoices";
import InvoiceDetail from "./pages/InvoiceDetail";
import Payments from "./pages/Payments";
import Inventory from "./pages/Inventory";
import InventoryDetail from "./pages/InventoryDetail";
import Assets from "./pages/Assets";
import AssetDetail from "./pages/AssetDetail";
import Issues from "./pages/Issues";
import IssueDetail from "./pages/IssueDetail";
import Vendors from "./pages/Vendors";
import VendorDetail from "./pages/VendorDetail";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Team from "./pages/Team";
import TeamMemberDetail from "./pages/TeamMemberDetail";
import Roles from "./pages/Roles";
import ApiKeys from "./pages/ApiKeys";
import Banking from "./pages/Banking";
import BankAccountDetail from "./pages/BankAccountDetail";
import KnowledgeBase from "./pages/KnowledgeBase";
import KBArticleDetail from "./pages/KBArticleDetail";
import Locations from "./pages/Locations";
import LocationDetail from "./pages/LocationDetail";
import Docs from "./pages/Docs";
import ActivityLog from "./pages/ActivityLog";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <PermissionProvider>
          <BrandingProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route index element={<Dashboard />} />
                  <Route path="clients" element={<Clients />} />
                  <Route path="clients/:id" element={<ClientDetail />} />
                  <Route path="jobs" element={<Jobs />} />
                  <Route path="jobs/:id" element={<JobDetail />} />
                  <Route path="invoices" element={<Invoices />} />
                  <Route path="invoices/:id" element={<InvoiceDetail />} />
                  <Route path="payments" element={<Payments />} />
                  <Route path="banking" element={<Banking />} />
                  <Route path="banking/:id" element={<BankAccountDetail />} />
                  <Route path="inventory" element={<Inventory />} />
                  <Route path="inventory/:id" element={<InventoryDetail />} />
                  <Route path="assets" element={<Assets />} />
                  <Route path="assets/:id" element={<AssetDetail />} />
                  <Route path="issues" element={<Issues />} />
                  <Route path="issues/:id" element={<IssueDetail />} />
                  <Route path="vendors" element={<Vendors />} />
                  <Route path="vendors/:id" element={<VendorDetail />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="team" element={<Team />} />
                  <Route path="team/:id" element={<TeamMemberDetail />} />
                  <Route path="roles" element={<Roles />} />
                  <Route path="api-keys" element={<ApiKeys />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="knowledge-base" element={<KnowledgeBase />} />
                  <Route path="knowledge-base/:id" element={<KBArticleDetail />} />
                  <Route path="locations" element={<Locations />} />
                  <Route path="locations/:id" element={<LocationDetail />} />
                  <Route path="docs" element={<Docs />} />
                  <Route path="activity-log" element={<ActivityLog />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </BrandingProvider>
        </PermissionProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
