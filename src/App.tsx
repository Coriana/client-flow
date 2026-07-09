import { lazy, Suspense } from "react";
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
// Login is the common entry point, so keep it eager to avoid a load flash.
import Login from "./pages/Login";

// All other pages are code-split so the initial bundle stays small; each
// route's chunk loads on demand behind the Suspense fallback below.
const SignUp = lazy(() => import("./pages/SignUp"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clients = lazy(() => import("./pages/Clients"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Jobs = lazy(() => import("./pages/Jobs"));
const JobDetail = lazy(() => import("./pages/JobDetail"));
const Invoices = lazy(() => import("./pages/Invoices"));
const InvoiceDetail = lazy(() => import("./pages/InvoiceDetail"));
const Payments = lazy(() => import("./pages/Payments"));
const Inventory = lazy(() => import("./pages/Inventory"));
const InventoryDetail = lazy(() => import("./pages/InventoryDetail"));
const Assets = lazy(() => import("./pages/Assets"));
const AssetDetail = lazy(() => import("./pages/AssetDetail"));
const Issues = lazy(() => import("./pages/Issues"));
const IssueDetail = lazy(() => import("./pages/IssueDetail"));
const Vendors = lazy(() => import("./pages/Vendors"));
const VendorDetail = lazy(() => import("./pages/VendorDetail"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Team = lazy(() => import("./pages/Team"));
const TeamMemberDetail = lazy(() => import("./pages/TeamMemberDetail"));
const Roles = lazy(() => import("./pages/Roles"));
const ApiKeys = lazy(() => import("./pages/ApiKeys"));
const Banking = lazy(() => import("./pages/Banking"));
const BankAccountDetail = lazy(() => import("./pages/BankAccountDetail"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const KBArticleDetail = lazy(() => import("./pages/KBArticleDetail"));
const Locations = lazy(() => import("./pages/Locations"));
const LocationDetail = lazy(() => import("./pages/LocationDetail"));
const Docs = lazy(() => import("./pages/Docs"));
const ActivityLog = lazy(() => import("./pages/ActivityLog"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,          // 30s: avoid refetching on every mount
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <PermissionProvider>
          <BrandingProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>}>
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
              </Suspense>
            </BrowserRouter>
          </BrandingProvider>
        </PermissionProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
