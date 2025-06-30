import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, DollarSign } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface BudgetStatusProps {
  projectId: number;
  tripCost?: number;
  showTripImpact?: boolean;
}

interface ProjectBudgetInfo {
  canApprove: boolean;
  budgetExcess: number;
  budgetInfo: {
    projectId: number;
    projectName: string;
    projectBudget: number;
    totalSpent: number;
    availableBudget: number;
    budgetUtilization: number;
  };
}

export function BudgetStatus({ projectId, tripCost = 0, showTripImpact = false }: BudgetStatusProps) {
  const { data: budgetCheck, isLoading, error } = useQuery<ProjectBudgetInfo>({
    queryKey: ['/api/projects', projectId, 'budget-check', tripCost],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/projects/${projectId}/budget-check?tripCost=${tripCost}`);
      return await response.json();
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Budget Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-2 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !budgetCheck) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Budget Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Unable to load budget information</p>
        </CardContent>
      </Card>
    );
  }

  // Extract budget info from the response
  const budgetInfo = budgetCheck.budgetInfo;
  const canApproveTripCost = budgetCheck.canApprove;
  const budgetExcess = budgetCheck.budgetExcess;

  // Add safety checks for undefined values
  const projectBudget = budgetInfo.projectBudget || 0;
  const totalSpent = budgetInfo.totalSpent || 0;
  const availableBudget = budgetInfo.availableBudget || 0;
  const budgetUtilization = budgetInfo.budgetUtilization || 0;

  const utilizationPercentage = Math.round(budgetUtilization);
  const afterTripUtilization = showTripImpact && tripCost > 0 
    ? Math.round(((totalSpent + tripCost) / projectBudget) * 100)
    : utilizationPercentage;

  const getStatusColor = (utilization: number) => {
    if (utilization >= 100) return "destructive";
    if (utilization >= 85) return "secondary";
    return "default";
  };

  const getStatusIcon = (utilization: number) => {
    if (utilization >= 100) return <AlertCircle className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Project Budget Status
        </CardTitle>
        <p className="text-sm text-muted-foreground">{budgetInfo.projectName}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Budget Status */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Current Utilization</span>
            <Badge variant={getStatusColor(utilizationPercentage)} className="flex items-center gap-1">
              {getStatusIcon(utilizationPercentage)}
              {utilizationPercentage}%
            </Badge>
          </div>
          <Progress value={Math.min(utilizationPercentage, 100)} className="h-2" />
        </div>

        {/* Budget Breakdown */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total Budget</p>
            <p className="font-semibold">{projectBudget.toFixed(2)} JD</p>
          </div>
          <div>
            <p className="text-muted-foreground">Spent</p>
            <p className="font-semibold">{totalSpent.toFixed(2)} JD</p>
          </div>
          <div>
            <p className="text-muted-foreground">Available</p>
            <p className="font-semibold">{availableBudget.toFixed(2)} JD</p>
          </div>
        </div>

        {/* Trip Impact Analysis */}
        {showTripImpact && tripCost > 0 && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Trip Cost</span>
              <span className="text-sm font-semibold">{tripCost.toFixed(2)} JD</span>
            </div>
            
            {canApproveTripCost ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">After Approval</span>
                  <Badge variant={getStatusColor(afterTripUtilization)} className="flex items-center gap-1">
                    {getStatusIcon(afterTripUtilization)}
                    {afterTripUtilization}%
                  </Badge>
                </div>
                <Progress value={Math.min(afterTripUtilization, 100)} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Remaining budget: {(availableBudget - tripCost).toFixed(2)} JD
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Budget Exceeded</span>
                </div>
                <p className="text-xs text-destructive/80 mt-1">
                  This trip exceeds the available budget by {budgetExcess.toFixed(2)} JD
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}