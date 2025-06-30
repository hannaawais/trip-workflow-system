import { useAuth } from "@/hooks/use-auth";
import { Loader2, Home } from "lucide-react";
import { Redirect, Route, Link } from "wouter";
import { Button } from "@/components/ui/button";

export function ProtectedRoute({
  path,
  component: Component,
  allowedRoles = [],
}: {
  path: string;
  component: () => React.ReactNode;
  allowedRoles?: string[];
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // If roles are specified, check if the user has permission
  // Use activeRole for permission checks if it exists (for Manager role switching)
  const currentRole = user.activeRole || user.role;
  if (allowedRoles.length > 0 && !allowedRoles.includes(currentRole)) {
    return (
      <Route path={path}>
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
          <p className="text-muted-foreground text-center mb-6">
            You don't have permission to access this page. This area requires one of the following roles: {allowedRoles.join(", ")}
          </p>
          <Link href="/">
            <Button variant="outline" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Go back to home page
            </Button>
          </Link>
        </div>
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}
