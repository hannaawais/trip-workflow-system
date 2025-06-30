import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, TrendingUp, ArrowRight } from "lucide-react";
import { 
  Department, 
  Project, 
  TripRequest 
} from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";

export default function BudgetPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("departments");
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);

  // Fetch departments
  const { data: departments = [], isLoading: isLoadingDepartments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  // Fetch projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch trip requests to calculate actual usage
  const { data: tripRequestData } = useQuery({
    queryKey: ["/api/trip-requests"],
  });
  
  // Extract trips array from the response (API returns { data: TripRequest[] })
  const tripRequests = Array.isArray(tripRequestData?.data) ? tripRequestData.data : [];

  // Budget increase schema
  const budgetIncreaseSchema = z.object({
    amount: z.string().refine(val => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount must be a positive number",
    }),
    description: z.string().min(5, "Please provide a reason for the budget increase"),
  });

  // Budget form setup
  const budgetForm = useForm<z.infer<typeof budgetIncreaseSchema>>({
    resolver: zodResolver(budgetIncreaseSchema),
    defaultValues: {
      amount: "",
      description: "",
    }
  });

  // Mutation for submitting budget increase request
  const budgetIncreaseMutation = useMutation({
    mutationFn: async (data: { 
      userId: number; 
      subject: string; 
      description: string; 
      requestType: string; 
      requestedAmount: number;
      targetType: string;
      targetId: number;
    }) => {
      const res = await apiRequest("POST", "/api/admin-requests", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Budget increase requested",
        description: "Your request has been submitted for approval by Finance.",
      });
      budgetForm.reset();
      setBudgetDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit request",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleOpenBudgetDialog = (entity: any, type: 'department' | 'project') => {
    setSelectedEntity({ ...entity, type });
    budgetForm.reset();
    setBudgetDialogOpen(true);
  };

  const handleBudgetIncrease = (data: z.infer<typeof budgetIncreaseSchema>) => {
    if (!selectedEntity || !user) return;
    
    budgetIncreaseMutation.mutate({
      userId: user.id,
      subject: `Budget Increase for ${selectedEntity.name}`,
      description: data.description,
      requestType: "budget-increase",
      requestedAmount: parseFloat(data.amount),
      targetType: selectedEntity.type,
      targetId: selectedEntity.id
    });
  };

  // Format and cap percentage for display and progress bars
  const formatPercentage = (value: number): number => {
    return Math.min(100, Math.round(value));
  };

  // Calculate department budget usage
  const calculateDepartmentUsage = (departmentId: number) => {
    if (tripRequests.length === 0) return { used: 0, remaining: 0, percentage: 0 };
    
    const approvedRequests = tripRequests.filter((req: any) => 
      req.departmentId === departmentId && 
      req.status === 'Approved'
    );
    
    const totalUsed = approvedRequests.reduce((sum: number, req: any) => sum + (req.cost || 0), 0);
    
    const department = departments.find((d) => d.id === departmentId);
    if (!department) return { used: 0, remaining: 0, percentage: 0 };
    
    const remaining = Math.max(0, department.budget - totalUsed);
    const percentage = department.budget > 0 ? (totalUsed / department.budget) * 100 : 0;
    
    return { used: totalUsed, remaining, percentage };
  };

  // Calculate project budget usage
  const calculateProjectUsage = (projectId: number) => {
    if (tripRequests.length === 0) return { used: 0, remaining: 0, percentage: 0 };
    
    const approvedRequests = tripRequests.filter((req: any) => 
      req.projectId === projectId && 
      req.status === 'Approved'
    );
    
    const totalUsed = approvedRequests.reduce((sum: number, req: any) => sum + (req.cost || 0), 0);
    
    const project = projects.find((p) => p.id === projectId);
    if (!project) return { used: 0, remaining: 0, percentage: 0 };
    
    const remaining = Math.max(0, project.budget - totalUsed);
    const percentage = project.budget > 0 ? (totalUsed / project.budget) * 100 : 0;
    
    return { used: totalUsed, remaining, percentage };
  };

  // Check if user can request budget increase
  const canRequestBudgetIncrease = () => {
    if (!user) return false;
    
    // Check actual role or active role
    const userRoles = [user.role, user.activeRole].filter(Boolean);
    return userRoles.some(role => 
      role === 'Finance' || 
      role === 'Admin' || 
      role === 'Manager'
    );
  };

  // Filter departments based on user role
  const getFilteredDepartments = () => {
    if (!departments || !user) return [];
    
    // Admin and Finance users can see all departments
    const allowedRoles = ['Admin', 'Finance'];
    if (allowedRoles.includes(user.role) || allowedRoles.includes(user.activeRole)) {
      return departments;
    }
    
    // Regular managers can only see departments they actively manage
    // Remove the fallback to user.department === dept.name to enforce proper manager assignments
    return departments.filter((dept) => 
      dept.managerId === user.id || 
      dept.secondManagerId === user.id
    );
  };
  
  // Filter projects based on user role
  const getFilteredProjects = () => {
    if (!projects || !user) return [];
    
    // Admin and Finance users can see all projects
    if (user.role === 'Admin' || user.role === 'Finance' || 
        user.activeRole === 'Admin' || user.activeRole === 'Finance') {
      return projects;
    }
    
    // Regular managers can only see projects they actively manage
    // Remove the fallback to user.department to enforce proper manager assignments
    return projects.filter((proj) => 
      proj.managerId === user.id || 
      proj.secondManagerId === user.id ||
      // Include projects that belong to departments the user actively manages
      (proj.departmentId && departments.find((d) => 
        d.id === proj.departmentId && 
        (d.managerId === user.id || d.secondManagerId === user.id)
      ))
    );
  };

  // Prepare data for department budget chart
  const getDepartmentChartData = () => {
    const filteredDepartments = getFilteredDepartments();
    if (!filteredDepartments.length) return [];
    
    return filteredDepartments.map((dept) => {
      const usage = calculateDepartmentUsage(dept.id);
      return {
        name: dept.name,
        budget: dept.budget,
        used: usage.used,
        remaining: usage.remaining
      };
    });
  };

  // Prepare data for project budget chart
  const getProjectChartData = () => {
    const filteredProjects = getFilteredProjects();
    if (!filteredProjects.length) return [];
    
    return filteredProjects.map((proj) => {
      const usage = calculateProjectUsage(proj.id);
      return {
        name: proj.name,
        budget: proj.budget,
        used: usage.used,
        remaining: usage.remaining
      };
    });
  };

  const departmentChartData = getDepartmentChartData();
  const projectChartData = getProjectChartData();

  return (
    <Layout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <h1 className="text-2xl font-semibold text-neutral-600">Budget Management</h1>
          <p className="mt-1 text-sm text-neutral-400">
            View and manage department and project budgets.
          </p>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="mt-6">
            <TabsList className="grid w-full md:w-[400px] grid-cols-2">
              <TabsTrigger value="departments">Department Budgets</TabsTrigger>
              <TabsTrigger value="projects">Project Budgets</TabsTrigger>
            </TabsList>
            
            {/* Departments Tab */}
            <TabsContent value="departments">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Department Budget Overview</CardTitle>
                  <CardDescription>
                    Monthly budget allocation and usage by department
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={departmentChartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`${value} JD`, 'Amount']} />
                        <Legend />
                        <Bar dataKey="budget" name="Budget" fill="#8884d8" />
                        <Bar dataKey="used" name="Used" fill="#82ca9d" />
                        <Bar dataKey="remaining" name="Remaining" fill="#ffc658" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Department Budget Details</CardTitle>
                  <CardDescription>
                    View detailed budget usage and request increases if needed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingDepartments ? (
                    <div className="flex justify-center my-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : !departments || departments.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-neutral-500">No departments found.</p>
                    </div>
                  ) : getFilteredDepartments().length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-neutral-500">You don't have access to any department budgets.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {getFilteredDepartments().map((dept) => {
                        const usage = calculateDepartmentUsage(dept.id);
                        const progressColor = usage.percentage > 90 
                          ? "bg-red-500" 
                          : usage.percentage > 70 
                            ? "bg-yellow-500" 
                            : "bg-primary";
                            
                        return (
                          <div key={dept.id} className="bg-white rounded-lg p-4 shadow border border-neutral-200">
                            <div className="flex justify-between items-center mb-2">
                              <h3 className="text-lg font-medium text-neutral-700">{dept.name}</h3>
                              {canRequestBudgetIncrease() && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleOpenBudgetDialog(dept, 'department')}
                                >
                                  <TrendingUp className="w-4 h-4 mr-2" />
                                  Request Increase
                                </Button>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4 mb-3">
                              <div>
                                <p className="text-sm text-neutral-500">Total Budget</p>
                                <p className="text-lg font-semibold">{dept.budget.toFixed(2)} JD</p>
                              </div>
                              <div>
                                <p className="text-sm text-neutral-500">Used</p>
                                <p className="text-lg font-semibold">{usage.used.toFixed(2)} JD</p>
                              </div>
                              <div>
                                <p className="text-sm text-neutral-500">Remaining</p>
                                <p className="text-lg font-semibold">{usage.remaining.toFixed(2)} JD</p>
                              </div>
                            </div>
                            
                            <div className="w-full">
                              <div className="flex justify-between text-sm mb-1">
                                <span>Budget Usage</span>
                                <span>{formatPercentage(usage.percentage)}%</span>
                              </div>
                              <Progress 
                                value={formatPercentage(usage.percentage)} 
                                className={`h-2 ${progressColor}`} 
                              />
                              {usage.percentage > 90 && (
                                <p className="text-xs text-red-600 mt-1">
                                  Warning: Budget almost depleted
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Projects Tab */}
            <TabsContent value="projects">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Project Budget Overview</CardTitle>
                  <CardDescription>
                    Budget allocation and usage by project
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={projectChartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`${value} JD`, 'Amount']} />
                        <Legend />
                        <Bar dataKey="budget" name="Budget" fill="#8884d8" />
                        <Bar dataKey="used" name="Used" fill="#82ca9d" />
                        <Bar dataKey="remaining" name="Remaining" fill="#ffc658" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Project Budget Details</CardTitle>
                  <CardDescription>
                    View detailed project budget usage and request increases if needed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingProjects ? (
                    <div className="flex justify-center my-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : !projects || projects.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-neutral-500">No projects found.</p>
                    </div>
                  ) : getFilteredProjects().length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-neutral-500">You don't have access to any project budgets.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {getFilteredProjects().map((proj) => {
                        const usage = calculateProjectUsage(proj.id);
                        const progressColor = usage.percentage > 90 
                          ? "bg-red-500" 
                          : usage.percentage > 70 
                            ? "bg-yellow-500" 
                            : "bg-primary";
                            
                        return (
                          <div key={proj.id} className="bg-white rounded-lg p-4 shadow border border-neutral-200">
                            <div className="flex justify-between items-center mb-2">
                              <div>
                                <h3 className="text-lg font-medium text-neutral-700">{proj.name}</h3>
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                  proj.isActive 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {proj.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                              {canRequestBudgetIncrease() && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleOpenBudgetDialog(proj, 'project')}
                                >
                                  <TrendingUp className="w-4 h-4 mr-2" />
                                  Request Increase
                                </Button>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4 mb-3">
                              <div>
                                <p className="text-sm text-neutral-500">Total Budget</p>
                                <p className="text-lg font-semibold">{proj.budget.toFixed(2)} JD</p>
                              </div>
                              <div>
                                <p className="text-sm text-neutral-500">Used</p>
                                <p className="text-lg font-semibold">{usage.used.toFixed(2)} JD</p>
                              </div>
                              <div>
                                <p className="text-sm text-neutral-500">Remaining</p>
                                <p className="text-lg font-semibold">{usage.remaining.toFixed(2)} JD</p>
                              </div>
                            </div>
                            
                            <div className="w-full">
                              <div className="flex justify-between text-sm mb-1">
                                <span>Budget Usage</span>
                                <span>{formatPercentage(usage.percentage)}%</span>
                              </div>
                              <Progress 
                                value={formatPercentage(usage.percentage)} 
                                className={`h-2 ${progressColor}`} 
                              />
                              {usage.percentage > 90 && (
                                <p className="text-xs text-red-600 mt-1">
                                  Warning: Budget almost depleted
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Budget Increase Dialog */}
      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Budget Increase</DialogTitle>
            <DialogDescription>
              Submit a request to increase the budget for {selectedEntity?.name}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...budgetForm}>
            <form onSubmit={budgetForm.handleSubmit(handleBudgetIncrease)} className="space-y-4">
              <Alert>
                <AlertDescription>
                  Budget increase requests require Finance approval. If approved, the amount will be added to the current budget.
                </AlertDescription>
              </Alert>
              
              <div className="flex justify-between mb-2">
                <div>
                  <p className="text-sm text-neutral-500">Current Budget</p>
                  <p className="text-base font-medium">{selectedEntity?.budget?.toFixed(2) || "0.00"} JD</p>
                </div>
                <div className="flex items-center">
                  <ArrowRight className="mx-2 w-4 h-4 text-neutral-400" />
                </div>
                <div>
                  <p className="text-sm text-neutral-500">New Budget</p>
                  <p className="text-base font-medium text-primary-500">
                    {selectedEntity?.budget 
                        ? (selectedEntity.budget + parseFloat(budgetForm.watch("amount") || "0")).toFixed(2) 
                        : "0.00"} JD
                  </p>
                </div>
              </div>
              
              <FormField
                control={budgetForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Increase Amount</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-neutral-500 sm:text-sm">JD</span>
                        </div>
                        <Input 
                          type="number" 
                          min="0.01" 
                          step="0.01" 
                          placeholder="0.00" 
                          className="pl-7"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={budgetForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Increase</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Explain why this budget increase is needed" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Provide a clear justification for the Finance team.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setBudgetDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={budgetIncreaseMutation.isPending}
                >
                  {budgetIncreaseMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Submit Request
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}