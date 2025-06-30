import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import AllRequestsPage from "@/pages/all-requests-page-new";
import DashboardHomePage from "@/pages/dashboard-home-page";
import TripRequestPageRedesigned from "@/pages/trip-request-page-redesigned";
import AdminRequestPage from "@/pages/admin-request-page";
import ApprovalsPage from "@/pages/approvals-page";
import ReportsPage from "@/pages/reports-page";
import AdminPage from "@/pages/admin-page-new";
import BudgetDashboardNew from "@/pages/budget-dashboard-new";
import ProjectManagerPage from "@/pages/project-manager-page";
import ProfilePage from "@/pages/profile-page";
import FinancePaymentDashboard from "@/pages/finance-payment-dashboard";


function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={DashboardHomePage} />
      <ProtectedRoute path="/all-requests" component={AllRequestsPage} />
      <ProtectedRoute path="/trip-requests" component={TripRequestPageRedesigned} allowedRoles={["Employee"]} />
      <ProtectedRoute path="/trip-request" component={TripRequestPageRedesigned} allowedRoles={["Employee"]} />
      <ProtectedRoute path="/admin-requests" component={AdminRequestPage} />
      <ProtectedRoute 
        path="/approvals" 
        component={ApprovalsPage} 
        allowedRoles={["Manager", "Finance", "Admin"]} 
      />
      <ProtectedRoute 
        path="/reports" 
        component={ReportsPage} 
        allowedRoles={["Manager", "Finance", "Admin"]} 
      />
      <ProtectedRoute 
        path="/finance/payments" 
        component={FinancePaymentDashboard} 
        allowedRoles={["Finance"]} 
      />
      <ProtectedRoute 
        path="/admin" 
        component={AdminPage} 
        allowedRoles={["Admin"]} 
      />
      <ProtectedRoute 
        path="/budget-dashboard" 
        component={BudgetDashboardNew} 
        allowedRoles={["Manager", "Finance", "Admin"]} 
      />
      <ProtectedRoute 
        path="/projects" 
        component={ProjectManagerPage} 
        allowedRoles={["Manager", "Admin"]} 
      />
      {/* Routes for Sites, Audit Logs and KM Rates have been integrated into the Admin page */}
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
