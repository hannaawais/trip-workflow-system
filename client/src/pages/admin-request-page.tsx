import { useState, useEffect } from "react";
import Layout from "@/components/layout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAdminRequestSchema } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminRequestPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [requestType, setRequestType] = useState<string>("other"); // Default to safe option
  const [projectSpending, setProjectSpending] = useState<any>(null);
  
  // Only fetch departments if user has permission
  const { data: departments, isLoading: isLoadingDepartments } = useQuery({
    queryKey: ["/api/departments"],
    enabled: user?.role === 'Manager' || user?.role === 'Admin'
  });

  // Only fetch projects if user has permission for budget requests
  const { data: projects, isLoading: isLoadingProjects } = useQuery({
    queryKey: ["/api/projects"],
    enabled: user?.role === 'Manager' || user?.role === 'Admin'
  });

  // Form setup
  const form = useForm<z.infer<typeof insertAdminRequestSchema>>({
    resolver: zodResolver(insertAdminRequestSchema),
    defaultValues: {
      subject: "",
      description: "",
      userId: user?.id,
      requestType: "other",
      requestedAmount: 0,
      targetType: "department",
      targetId: undefined
    }
  });

  // Mutation for creating an administrative request
  const adminRequestMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertAdminRequestSchema>) => {
      const res = await apiRequest("POST", "/api/admin-requests", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Administrative request submitted",
        description: "Your request has been submitted for approval."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin-requests"] });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit request",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: z.infer<typeof insertAdminRequestSchema>) => {
    // Submit the form data
    adminRequestMutation.mutate(data);
  };

  // Handle request type change
  const handleRequestTypeChange = (value: string) => {
    setRequestType(value);
    form.setValue("requestType", value);
    
    if (value !== "budget-increase" && value !== "new-project") {
      form.setValue("requestedAmount", undefined);
    }
  };

  // Handle target type change
  const handleTargetTypeChange = (value: string) => {
    form.setValue("targetType", value);
    form.setValue("targetId", undefined);
    setProjectSpending(null);
  };

  // Fetch project spending data when project is selected
  const targetType = form.watch("targetType");
  const targetId = form.watch("targetId");

  useEffect(() => {
    if (targetType === "project" && targetId) {
      fetch(`/api/projects/spending`)
        .then(res => res.json())
        .then(data => {
          const projectData = data.find((p: any) => p.id === targetId);
          setProjectSpending(projectData);
        })
        .catch(err => {
          console.error('Error fetching spending data:', err);
          setProjectSpending(null);
        });
    } else {
      setProjectSpending(null);
    }
  }, [targetType, targetId]);

  // Get the current budget information for display
  const getCurrentBudgetInfo = () => {
    const targetType = form.watch("targetType");
    const targetId = form.watch("targetId");
    
    if (!targetType || !targetId) return null;
    
    if (targetType === "department" && departments) {
      const department = departments.find(d => d.id === targetId);
      if (department) {
        // For departments, use effective budget calculation
        const effectiveBudget = (department.budget || 0) + (department.monthlyBudgetBonus || 0);
        return {
          name: department.name,
          budget: effectiveBudget,
          used: 0, // TODO: Implement real department spending calculation
          remaining: effectiveBudget
        };
      }
    } else if (targetType === "project" && projects) {
      const project = projects.find(p => p.id === targetId);
      if (project && projectSpending && projectSpending.spending) {
        return {
          name: project.name,
          budget: projectSpending.spending.effectiveBudget || 0,
          used: projectSpending.spending.totalAllocated || 0,
          remaining: projectSpending.spending.availableBudget || 0
        };
      } else if (project) {
        return {
          name: project.name,
          budget: "Loading...",
          used: "Loading...",
          remaining: "Loading..."
        };
      }
    }
    
    return null;
  };

  const budgetInfo = getCurrentBudgetInfo();

  return (
    <Layout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <h1 className="text-2xl font-semibold text-neutral-600">New Administrative Request</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Submit your administrative request for approval.
          </p>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="mt-5 md:mt-0 md:col-span-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="shadow overflow-hidden sm:rounded-md">
                  <div className="px-4 py-5 bg-white sm:p-6">
                    <div className="grid grid-cols-6 gap-6">
                      <div className="col-span-6">
                        <FormLabel className="required">Request Type</FormLabel>
                        <Select value={requestType} onValueChange={handleRequestTypeChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Request Type" />
                          </SelectTrigger>
                          <SelectContent>
                            {(user?.role === 'Manager' || user?.role === 'Admin') && (
                              <>
                                <SelectItem value="budget-increase">Budget Increase</SelectItem>
                                <SelectItem value="new-project">New Project Setup</SelectItem>
                              </>
                            )}
                            <SelectItem value="transportation-plan-missing">Transportation Plan Not Listed</SelectItem>
                            <SelectItem value="payment-delay-justification">Payment Delay Justification</SelectItem>
                            <SelectItem value="trip-payment-discrepancy">Trip Payment Value Discrepancy</SelectItem>
                            <SelectItem value="other">Other Administrative Request</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(requestType === "budget-increase") && (
                        <>
                          <div className="col-span-6 sm:col-span-3">
                            <FormLabel>Target Type</FormLabel>
                            <Select 
                              value={form.watch("targetType") || "department"} 
                              onValueChange={handleTargetTypeChange}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select Target" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="department">Department</SelectItem>
                                <SelectItem value="project">Project</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="col-span-6 sm:col-span-3">
                            <FormField
                              control={form.control}
                              name="targetId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    {form.watch("targetType") === "department" ? "Department" : "Project"}
                                  </FormLabel>
                                  <Select 
                                    value={field.value?.toString() || ""} 
                                    onValueChange={(value) => field.onChange(parseInt(value))}
                                    disabled={isLoadingDepartments || isLoadingProjects}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder={`Select ${form.watch("targetType") === "department" ? "Department" : "Project"}`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {isLoadingDepartments || isLoadingProjects ? (
                                        <div className="flex justify-center p-2">
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        </div>
                                      ) : (
                                        form.watch("targetType") === "department" 
                                          ? departments?.map(dept => (
                                              <SelectItem key={dept.id} value={dept.id.toString()}>
                                                {dept.name}
                                              </SelectItem>
                                            ))
                                          : projects?.map(proj => (
                                              <SelectItem key={proj.id} value={proj.id.toString()}>
                                                {proj.name}
                                              </SelectItem>
                                            ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Budget Information section */}
                          {budgetInfo && (
                            <div className="col-span-6">
                              <Card className="bg-neutral-50">
                                <CardContent className="pt-6">
                                  <h3 className="text-sm font-medium text-neutral-600 mb-2">Current Budget Information</h3>
                                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                      <p className="text-sm text-neutral-500">Department/Project</p>
                                      <p className="text-sm font-medium text-neutral-600">{budgetInfo.name}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-neutral-500">Total Project Budget</p>
                                      <p className="text-sm font-medium text-neutral-600">JD {typeof budgetInfo?.budget === 'number' ? budgetInfo.budget.toFixed(2) : budgetInfo?.budget || '0.00'}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-neutral-500">Already Allocated</p>
                                      <p className="text-sm font-medium text-neutral-600">JD {typeof budgetInfo?.used === 'number' ? budgetInfo.used.toFixed(2) : budgetInfo?.used || '0.00'}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-neutral-500">Available for New Requests</p>
                                      <p className="text-sm font-medium text-neutral-600">JD {typeof budgetInfo?.remaining === 'number' ? budgetInfo.remaining.toFixed(2) : budgetInfo?.remaining || '0.00'}</p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </>
                      )}

                      <div className="col-span-6">
                        <FormField
                          control={form.control}
                          name="subject"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="required">Request Subject</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter request subject" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="col-span-6">
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="required">Request Description</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Describe your administrative request in detail"
                                  rows={4}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {(requestType === "budget-increase" || requestType === "new-project") && (
                        <div className="col-span-6 sm:col-span-3">
                          <FormField
                            control={form.control}
                            name="requestedAmount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="required">Requested Amount (JD)</FormLabel>
                                <FormControl>
                                  <div className="relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                      <span className="text-neutral-500 sm:text-sm">JD</span>
                                    </div>
                                    <Input 
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="pl-7"
                                      {...field}
                                      onChange={(e) => field.onChange(Number(e.target.value))}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      <div className="col-span-6">
                        <FormLabel>Attachment (PDF only)</FormLabel>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-neutral-300 border-dashed rounded-md">
                          <div className="space-y-1 text-center">
                            <svg className="mx-auto h-12 w-12 text-neutral-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div className="flex text-sm text-neutral-600 justify-center">
                              <label htmlFor="file-upload-admin" className="relative cursor-pointer bg-white rounded-md font-medium text-primary-500 hover:text-primary-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500">
                                <span>Upload a file</span>
                                <input id="file-upload-admin" name="file-upload-admin" type="file" accept=".pdf" className="sr-only" />
                              </label>
                              <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs text-neutral-500">
                              PDF up to 10MB
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-4 bg-neutral-50 border-t border-neutral-200 text-right sm:px-6">
                    <Button 
                      type="submit" 
                      disabled={adminRequestMutation.isPending}
                      className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {adminRequestMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : "Submit Request"}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
