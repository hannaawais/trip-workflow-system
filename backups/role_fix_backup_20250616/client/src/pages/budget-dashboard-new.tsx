import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle,
  Plus,
  Edit3,
  History,
  Target,
  Activity,
  Clock,
  CheckCircle,
  ArrowRight
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Project, Department } from "@shared/schema";

interface ProjectSpending {
  totalAllocated: number;
  totalSpent: number;
  availableBudget: number;
  budgetUtilization: number;
  originalBudget: number;
  effectiveBudget: number;
}

interface ProjectWithSpending extends Project {
  spending: ProjectSpending;
}

interface BudgetTransaction {
  id: number;
  type: 'initial' | 'allocation' | 'deallocation' | 'adjustment';
  amount: number;
  runningBalance: number;
  description: string;
  timestamp: string;
  createdBy?: string;
  referenceId?: number;
}

export default function BudgetDashboardNew() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentDescription, setAdjustmentDescription] = useState("");

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: budgetHistory = [] } = useQuery<BudgetTransaction[]>({
    queryKey: ["/api/budget/history", selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      const res = await fetch(`/api/budget/history/${selectedProject}`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to fetch budget history");
      return await res.json();
    },
    enabled: !!selectedProject,
  });

  // Fetch spending data for all projects
  const { data: projectSpending = [] } = useQuery<ProjectWithSpending[]>({
    queryKey: ["/api/projects/spending"],
  });

  const budgetAdjustmentMutation = useMutation({
    mutationFn: async (data: { projectId: number; amount: number; description: string }) => {
      const res = await apiRequest("POST", `/api/projects/${data.projectId}/budget-adjustment`, {
        amount: data.amount,
        description: data.description
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Budget adjustment successful",
        description: "Project budget has been updated.",
      });
      setBudgetDialogOpen(false);
      setAdjustmentAmount("");
      setAdjustmentDescription("");
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects/spending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budget/history"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Budget adjustment failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Calculate summary statistics
  const totalBudget = projectSpending.reduce((sum, p) => sum + (p.spending?.originalBudget || 0), 0);
  const totalAllocated = projectSpending.reduce((sum, p) => sum + (p.spending?.totalAllocated || 0), 0);
  const totalSpent = projectSpending.reduce((sum, p) => sum + (p.spending?.totalSpent || 0), 0);
  const totalAvailable = projectSpending.reduce((sum, p) => sum + (p.spending?.availableBudget || 0), 0);
  const projectsAtRisk = projectSpending.filter(p => 
    p.spending && (p.spending.totalAllocated / p.spending.effectiveBudget) > 0.9
  ).length;

  const handleBudgetAdjustment = () => {
    if (!selectedProject || !adjustmentAmount || !adjustmentDescription) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(adjustmentAmount);
    if (isNaN(amount)) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid number.",
        variant: "destructive",
      });
      return;
    }

    budgetAdjustmentMutation.mutate({
      projectId: selectedProject,
      amount,
      description: adjustmentDescription
    });
  };

  const canManageBudgets = () => {
    if (!user) return false;
    return user.role === 'Admin' || user.role === 'Finance' || 
           user.activeRole === 'Admin' || user.activeRole === 'Finance';
  };

  return (
    <Layout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Advanced Budget Management</h1>
              <p className="text-muted-foreground mt-2">
                Monitor project budgets with real-time allocation tracking and comprehensive financial oversight
              </p>
            </div>
            <div className="flex gap-4">
              {canManageBudgets() && (
                <Button onClick={() => setBudgetDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Budget Adjustment
                </Button>
              )}
              <Button variant="outline">
                <Activity className="h-4 w-4 mr-2" />
                Budget Analytics
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Original Budget</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalBudget.toFixed(2)} JD</div>
                <p className="text-xs text-muted-foreground">
                  Across {projectSpending.length} active projects
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Allocated</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalAllocated.toFixed(2)} JD</div>
                <p className="text-xs text-muted-foreground">
                  {totalBudget > 0 ? ((totalAllocated / totalBudget) * 100).toFixed(1) : 0}% allocated
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available Budget</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalAvailable.toFixed(2)} JD</div>
                <p className="text-xs text-muted-foreground">
                  {totalBudget > 0 ? ((totalAvailable / totalBudget) * 100).toFixed(1) : 0}% remaining
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Projects At Risk</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projectsAtRisk}</div>
                <p className="text-xs text-muted-foreground">
                  Over 90% budget allocated
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Project Overview</TabsTrigger>
              <TabsTrigger value="allocations">Budget Allocations</TabsTrigger>
              <TabsTrigger value="history">Transaction History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Project Budget Overview</CardTitle>
                  <CardDescription>
                    Real-time budget tracking with allocation-based monitoring
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projectSpending.map((project) => (
                      <div key={project.id} className="space-y-3 p-4 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-medium">{project.name}</span>
                            <p className="text-sm text-muted-foreground">
                              Original Budget: {project.spending?.originalBudget || 0} JD
                              {project.spending && project.spending.effectiveBudget !== project.spending.originalBudget && (
                                <span className="ml-2 text-blue-600">
                                  (Effective: {project.spending.effectiveBudget} JD)
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge 
                              variant={
                                !project.spending ? "secondary" :
                                project.spending.budgetUtilization > 90 ? "destructive" : 
                                project.spending.budgetUtilization > 70 ? "default" : "secondary"
                              }
                            >
                              {project.spending ? project.spending.budgetUtilization.toFixed(1) : 0}% utilized
                            </Badge>
                            <p className="text-sm text-muted-foreground mt-1">
                              {project.spending ? project.spending.availableBudget.toFixed(2) : project.budget} JD available
                            </p>
                          </div>
                        </div>
                        
                        {project.spending && (
                          <>
                            <Progress 
                              value={(project.spending.totalAllocated / project.spending.effectiveBudget) * 100} 
                              className="h-2"
                            />
                            <div className="grid grid-cols-3 gap-4 text-xs">
                              <div>
                                <span className="text-muted-foreground">Allocated: </span>
                                <span className="font-medium text-orange-600">
                                  {project.spending.totalAllocated.toFixed(2)} JD
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Spent: </span>
                                <span className="font-medium text-red-600">
                                  {project.spending.totalSpent.toFixed(2)} JD
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Available: </span>
                                <span className="font-medium text-green-600">
                                  {project.spending.availableBudget.toFixed(2)} JD
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedProject(project.id)}
                          className="w-full"
                        >
                          <History className="h-4 w-4 mr-2" />
                          View Budget History
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="allocations" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Budget Allocation Analysis</CardTitle>
                  <CardDescription>
                    Detailed breakdown of budget allocations vs actual spending
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {projectSpending.map((project) => (
                      <div key={project.id} className="space-y-4 p-4 border rounded-lg">
                        <div className="flex justify-between items-center">
                          <h3 className="font-medium">{project.name}</h3>
                          <Badge variant="outline">
                            {project.spending 
                              ? ((project.spending.totalAllocated / project.spending.effectiveBudget) * 100).toFixed(1)
                              : 0
                            }% Allocated
                          </Badge>
                        </div>
                        
                        {project.spending && (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>Allocated</span>
                                  <span className="font-medium">{project.spending.totalAllocated.toFixed(2)} JD</span>
                                </div>
                                <Progress 
                                  value={(project.spending.totalAllocated / project.spending.effectiveBudget) * 100} 
                                  className="h-2"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>Actually Spent</span>
                                  <span className="font-medium">{project.spending.totalSpent.toFixed(2)} JD</span>
                                </div>
                                <Progress 
                                  value={(project.spending.totalSpent / project.spending.effectiveBudget) * 100} 
                                  className="h-2"
                                />
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                              <div>
                                <span className="block font-medium">Pending</span>
                                <span>{(project.spending.totalAllocated - project.spending.totalSpent).toFixed(2)} JD</span>
                              </div>
                              <div>
                                <span className="block font-medium">Available</span>
                                <span>{project.spending.availableBudget.toFixed(2)} JD</span>
                              </div>
                              <div>
                                <span className="block font-medium">Efficiency</span>
                                <span>
                                  {project.spending.totalAllocated > 0 
                                    ? ((project.spending.totalSpent / project.spending.totalAllocated) * 100).toFixed(1)
                                    : 0
                                  }%
                                </span>
                              </div>
                              <div>
                                <span className="block font-medium">Status</span>
                                <span className={
                                  project.spending.availableBudget < 0 ? "text-red-600" :
                                  project.spending.availableBudget < project.spending.effectiveBudget * 0.1 ? "text-orange-600" :
                                  "text-green-600"
                                }>
                                  {project.spending.availableBudget < 0 ? "Over Budget" :
                                   project.spending.availableBudget < project.spending.effectiveBudget * 0.1 ? "Low" :
                                   "Healthy"}
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Budget Transaction History</CardTitle>
                  <CardDescription>
                    Complete audit trail of all budget transactions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Select 
                      value={selectedProject?.toString() || ""} 
                      onValueChange={(value) => setSelectedProject(value ? parseInt(value) : null)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a project to view history" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id.toString()}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedProject && budgetHistory.length > 0 && (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {budgetHistory.map((transaction) => (
                          <div key={transaction.id} className="flex justify-between items-center p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <Badge variant={
                                transaction.type === 'initial' ? 'default' :
                                transaction.type === 'allocation' ? 'destructive' :
                                transaction.type === 'deallocation' ? 'secondary' :
                                'outline'
                              }>
                                {transaction.type}
                              </Badge>
                              <div>
                                <p className="text-sm font-medium">{transaction.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(transaction.timestamp).toLocaleString()}
                                  {transaction.createdBy && ` • by ${transaction.createdBy}`}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-medium ${
                                transaction.type === 'allocation' ? 'text-red-600' :
                                transaction.type === 'deallocation' ? 'text-green-600' :
                                'text-blue-600'
                              }`}>
                                {transaction.type === 'allocation' ? '-' : '+'}
                                {transaction.amount.toFixed(2)} JD
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Balance: {transaction.runningBalance.toFixed(2)} JD
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedProject && budgetHistory.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Clock className="h-8 w-8 mx-auto mb-2" />
                        <p>No budget transactions found for this project</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Budget Adjustment Dialog */}
          <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Budget Adjustment</DialogTitle>
                <DialogDescription>
                  Adjust project budget with proper audit trail
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="project">Project</Label>
                  <Select 
                    value={selectedProject?.toString() || ""} 
                    onValueChange={(value) => setSelectedProject(value ? parseInt(value) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="amount">Adjustment Amount (JD)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={adjustmentAmount}
                    onChange={(e) => setAdjustmentAmount(e.target.value)}
                    placeholder="Enter positive or negative amount"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={adjustmentDescription}
                    onChange={(e) => setAdjustmentDescription(e.target.value)}
                    placeholder="Reason for budget adjustment"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBudgetDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleBudgetAdjustment}
                  disabled={budgetAdjustmentMutation.isPending}
                >
                  {budgetAdjustmentMutation.isPending ? "Processing..." : "Apply Adjustment"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </Layout>
  );
}