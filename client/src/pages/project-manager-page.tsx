import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Plus, FileText, Users, FolderKanban } from "lucide-react";
import ProjectDocuments from "@/components/project-documents";
import { format } from "date-fns";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export default function ProjectManagerPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [createProjectDialogOpen, setCreateProjectDialogOpen] = useState(false);
  const [projectDetailDialogOpen, setProjectDetailDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'managed' | 'department'>(
    ['Manager'].includes(user?.role) ? 'department' : 'managed'
  );
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [updateExpiryDialogOpen, setUpdateExpiryDialogOpen] = useState(false);

  // Fetch user's assigned projects
  const { data: projects, isLoading: isLoadingProjects } = useQuery({
    queryKey: ["/api/projects/manager"],
  });
  
  // Fetch all departments
  const { data: departments, isLoading: isLoadingDepartments } = useQuery({
    queryKey: ["/api/departments"],
  });
  
  // Find departments where user is the primary manager
  const managedDepartments = departments?.filter((dept: any) => dept.managerId === user?.id) || [];
  
  // State to track the currently selected department to view
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  
  // Initialize the selected department when managedDepartments loads
  useEffect(() => {
    if (managedDepartments.length > 0 && !selectedDepartment) {
      setSelectedDepartment(managedDepartments[0].name);
    }
  }, [managedDepartments, selectedDepartment]);
  
  // Fetch department projects if user is a department manager
  const { data: departmentProjects, isLoading: isLoadingDepartmentProjects } = useQuery({
    queryKey: ["/api/departments", selectedDepartment, "projects"],
    queryFn: async () => {
      if (['Manager'].includes(user?.role) && selectedDepartment) {
        const res = await fetch(`/api/departments/${encodeURIComponent(selectedDepartment)}/projects`);
        if (!res.ok) {
          const errorData = await res.json();
          toast({
            title: "Error fetching department projects",
            description: errorData.message || "Failed to fetch department projects",
            variant: "destructive"
          });
          throw new Error('Failed to fetch department projects');
        }
        return res.json();
      }
      return [];
    },
    // Only fetch department projects if the user is a manager and a department is selected
    enabled: ['Manager'].includes(user?.role) && !!selectedDepartment,
  });

  // Fetch users for manager selection
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/users"],
  });

  // Project form schema
  const projectSchema = z.object({
    name: z.string().min(1, "Project name is required"),
    budget: z.string().refine(val => !isNaN(Number(val)) && Number(val) >= 0, {
      message: "Budget must be a positive number",
    }),
    departmentId: z.number().min(1, "Department is required"),
    secondManagerId: z.number().optional(),
    expiryDate: z.union([
      z.date().optional(),
      z.string().transform((str) => str ? new Date(str) : undefined).optional()
    ]),
    isActive: z.boolean().default(true),
    documents: z.instanceof(FileList).optional(),
    documentTypes: z.array(z.string()).optional(),
    documentDescriptions: z.array(z.string()).optional(),
  });

  // Project form setup
  const projectForm = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      budget: "0",
      departmentId: ['Manager'].includes(user?.role) && managedDepartments.length > 0 ? 
        managedDepartments[0]?.id : undefined,
      secondManagerId: undefined,
      expiryDate: undefined,
      isActive: true,
      documentTypes: [],
      documentDescriptions: [],
    }
  });

  // Mutation for creating projects
  const createProjectMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      budget: number; 
      departmentId: number; 
      secondManagerId?: number; 
      expiryDate?: Date; 
      isActive: boolean 
    }) => {
      const res = await apiRequest("POST", "/api/projects/manager", {
        ...data,
        managerId: user?.id,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Project created",
        description: "The project has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects/manager"] });
      // If manager, also invalidate department projects
      if (['Manager'].includes(user?.role) && managedDepartments.length > 0 && selectedDepartment) {
        queryClient.invalidateQueries({ 
          queryKey: ["/api/departments", selectedDepartment, "projects"] 
        });
      }
      projectForm.reset();
      setCreateProjectDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create project",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleCreateProject = async (data: z.infer<typeof projectSchema>) => {
    try {
      // First create the project
      const newProject = await createProjectMutation.mutateAsync({
        name: data.name,
        budget: parseFloat(data.budget),
        departmentId: data.departmentId,
        secondManagerId: data.secondManagerId,
        expiryDate: data.expiryDate,
        isActive: data.isActive,
      });
      
      // Then upload documents if any files were selected
      if (data.documents && data.documents.length > 0) {
        const filePromises = Array.from(data.documents).map(async (file, index) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('documentType', data.documentTypes?.[index] || 'General');
          formData.append('description', data.documentDescriptions?.[index] || '');
          
          await fetch(`/api/projects/${newProject.id}/documents`, {
            method: 'POST',
            body: formData,
          });
        });
        
        await Promise.all(filePromises);
        
        // Invalidate documents query to refresh the list
        queryClient.invalidateQueries({ queryKey: ["/api/projects", newProject.id, "documents"] });
      }
      
      // Reset form and close dialog
      projectForm.reset();
      setCreateProjectDialogOpen(false);
      
      // Show success message
      toast({
        title: "Project created",
        description: "The project has been successfully created with all documents.",
      });
      
    } catch (error: any) {
      toast({
        title: "Failed to create project",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Mutation for updating project status
  const updateProjectStatusMutation = useMutation({
    mutationFn: async ({ projectId, isActive }: { projectId: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}`, {
        isActive,
      });
      return await res.json();
    },
    onSuccess: (updatedProject) => {
      toast({
        title: `Project ${updatedProject.isActive ? 'activated' : 'deactivated'}`,
        description: `The project has been ${updatedProject.isActive ? 'activated' : 'deactivated'} successfully.`,
      });
      
      // Update the selected project in the UI
      setSelectedProject(prev => ({
        ...prev,
        isActive: updatedProject.isActive,
      }));
      
      // Invalidate queries to refresh the lists
      queryClient.invalidateQueries({ queryKey: ["/api/projects/manager"] });
      if (['Manager'].includes(user?.role) && managedDepartments.length > 0 && selectedDepartment) {
        queryClient.invalidateQueries({ 
          queryKey: ["/api/departments", selectedDepartment, "projects"] 
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update project status",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleToggleProjectStatus = (projectId: number, isActive: boolean) => {
    // If trying to activate a project, check conditions
    if (isActive && ['Manager'].includes(user?.role) && selectedProject) {
      // Check if project has zero budget
      if (selectedProject.budget <= 0) {
        toast({
          title: "Cannot activate project",
          description: "Projects with zero budget cannot be activated. Please contact Finance or Admin to set a budget.",
          variant: "destructive"
        });
        return;
      }
      
      // Check if project is expired
      if (selectedProject.expiryDate && new Date(selectedProject.expiryDate) < new Date()) {
        toast({
          title: "Cannot activate project",
          description: "Expired projects cannot be activated. Please update the expiry date first.",
          variant: "destructive"
        });
        return;
      }
    }
    
    updateProjectStatusMutation.mutate({ projectId, isActive });
  };

  const handleOpenProjectDetailDialog = (project: any) => {
    setSelectedProject(project);
    setProjectDetailDialogOpen(true);
  };

  // Filter users to show only managers
  const projectManagers = users?.filter((u: any) => 
    u.role === 'Manager' && u.id !== user?.id
  ) || [];

  return (
    <Layout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <h1 className="text-2xl font-semibold text-neutral-600">Project Management</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Manage your projects and documents.
          </p>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-6">
          <div className="flex justify-between items-center mb-4">
            <Button onClick={() => setCreateProjectDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create New Project
            </Button>
            
            {['Manager'].includes(user?.role) && (
              <div className="flex border rounded-md">
                <Button 
                  variant={viewMode === 'managed' ? 'default' : 'outline'} 
                  size="sm"
                  className="rounded-r-none"
                  onClick={() => setViewMode('managed')}
                >
                  <FolderKanban className="h-4 w-4 mr-2" />
                  My Projects
                </Button>
                <Button 
                  variant={viewMode === 'department' ? 'default' : 'outline'} 
                  size="sm"
                  className="rounded-l-none"
                  onClick={() => setViewMode('department')}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Department Projects
                </Button>
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>
                    {viewMode === 'managed' 
                      ? 'Your Projects' 
                      : 'Department Projects'}
                  </CardTitle>
                  <CardDescription>
                    {viewMode === 'managed' 
                      ? 'View and manage projects you are assigned to as a manager.' 
                      : 'View all projects related to the selected department.'}
                  </CardDescription>
                </div>
                
                {viewMode === 'department' && managedDepartments.length > 0 && (
                  <div className="flex items-center">
                    <Select 
                      value={selectedDepartment || undefined}
                      onValueChange={(value) => setSelectedDepartment(value)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {managedDepartments.map((dept: any) => (
                          <SelectItem key={dept.id} value={dept.name}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {(viewMode === 'managed' && isLoadingProjects) || 
               (viewMode === 'department' && isLoadingDepartmentProjects) ? (
                <div className="flex justify-center my-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : 
              (viewMode === 'managed' && (!projects || projects.length === 0)) || 
              (viewMode === 'department' && (!departmentProjects || departmentProjects.length === 0)) ? (
                <div className="text-center py-8">
                  <p className="text-neutral-500">
                    {viewMode === 'managed' 
                      ? 'No projects found. Create a new project to get started.' 
                      : 'No department projects found.'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(viewMode === 'managed' ? projects : departmentProjects)?.map((project: any) => (
                      <TableRow key={project.id}>
                        <TableCell>{project.name}</TableCell>
                        <TableCell className="text-right">{project.budget.toFixed(2)} JD</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            project.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {project.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {format(new Date(project.createdAt), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          {project.expiryDate ? (
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              new Date(project.expiryDate) < new Date() 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {format(new Date(project.expiryDate), 'MMM d, yyyy')}
                            </span>
                          ) : (
                            <span className="text-neutral-400">No expiry date</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenProjectDetailDialog(project)}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Project Dialog */}
      <Dialog open={createProjectDialogOpen} onOpenChange={setCreateProjectDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Add a new project that you will manage.
            </DialogDescription>
          </DialogHeader>

          <Form {...projectForm}>
            <form onSubmit={projectForm.handleSubmit(handleCreateProject)} className="space-y-4">
              <FormField
                control={projectForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Company Website Redesign" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={projectForm.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget (JD)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        {...field} 
                        disabled={['Manager'].includes(user?.role)}
                        readOnly={['Manager'].includes(user?.role)}
                      />
                    </FormControl>
                    <FormDescription>
                      {['Manager'].includes(user?.role) 
                        ? 'Only Finance and Admin roles can set or change project budgets' 
                        : 'Total budget allocated for this project in Jordanian Dinar'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={projectForm.control}
                name="departmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    {['Manager'].includes(user?.role) && managedDepartments.length > 0 ? (
                      // Read-only department selection for managers
                      <div>
                        <FormControl>
                          <Input 
                            value={managedDepartments.length > 0 ? managedDepartments[0].name : ""}
                            readOnly
                            disabled
                          />
                        </FormControl>
                        <FormDescription>
                          As a Manager, you can only create projects for your department
                        </FormDescription>
                      </div>
                    ) : (
                      // Regular department selection for other users
                      <>
                        <Select
                          value={field.value?.toString()}
                          onValueChange={(value) => field.onChange(parseInt(value))}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {departments?.map((department: any) => (
                              <SelectItem key={department.id} value={department.id.toString()}>
                                {department.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          The department that owns this project
                        </FormDescription>
                      </>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={projectForm.control}
                name="secondManagerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Second Project Manager (Optional)</FormLabel>
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a second manager (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projectManagers.map((manager: any) => (
                          <SelectItem key={manager.id} value={manager.id.toString()}>
                            {manager.fullName} ({manager.department})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      If selected, this person will also need to approve trip requests
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={projectForm.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Project Expiry Date (Optional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={`w-full pl-3 text-left font-normal ${
                              !field.value ? "text-muted-foreground" : ""
                            }`}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value as Date}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      The project will be automatically deactivated after this date
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={projectForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Only active projects can be selected for trip requests
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <FormField
                control={projectForm.control}
                name="documents"
                render={({ field: { onChange, ...rest } }) => (
                  <FormItem>
                    <FormLabel>Project Documents (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx"
                        onChange={(e) => {
                          onChange(e.target.files);
                          
                          // Initialize document types and descriptions arrays
                          if (e.target.files && e.target.files.length > 0) {
                            const fileCount = e.target.files.length;
                            const initialTypes = Array(fileCount).fill('General');
                            const initialDescs = Array(fileCount).fill('');
                            
                            projectForm.setValue('documentTypes', initialTypes);
                            projectForm.setValue('documentDescriptions', initialDescs);
                          }
                        }}
                        {...rest}
                      />
                    </FormControl>
                    <FormDescription>
                      Upload project documents (PDF, Word, Excel). Maximum 5MB per file.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Show document fields if files are selected */}
              {projectForm.watch('documents') && projectForm.watch('documents').length > 0 && (
                <div className="space-y-4 p-4 border rounded-md">
                  <h3 className="font-medium text-sm">Document Details</h3>
                  {Array.from(projectForm.watch('documents')).map((file, index) => (
                    <div key={index} className="space-y-3 pb-3 border-b last:border-0">
                      <p className="text-sm font-medium">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <FormLabel className="text-xs">Document Type</FormLabel>
                          <Select
                            value={projectForm.watch('documentTypes')?.[index] || 'General'}
                            onValueChange={(value) => {
                              const types = [...(projectForm.watch('documentTypes') || [])];
                              types[index] = value;
                              projectForm.setValue('documentTypes', types);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="General">General</SelectItem>
                              <SelectItem value="Contract">Contract</SelectItem>
                              <SelectItem value="Budget">Budget</SelectItem>
                              <SelectItem value="Plan">Project Plan</SelectItem>
                              <SelectItem value="Report">Report</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <FormLabel className="text-xs">Description (Optional)</FormLabel>
                          <Input
                            value={projectForm.watch('documentDescriptions')?.[index] || ''}
                            onChange={(e) => {
                              const descs = [...(projectForm.watch('documentDescriptions') || [])];
                              descs[index] = e.target.value;
                              projectForm.setValue('documentDescriptions', descs);
                            }}
                            placeholder="Brief description"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateProjectDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createProjectMutation.isPending}
                >
                  {createProjectMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Project
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Project Detail Dialog with Documents */}
      <Dialog open={projectDetailDialogOpen} onOpenChange={setProjectDetailDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Project Details: {selectedProject?.name}</DialogTitle>
            <DialogDescription>
              View project information and manage documents
            </DialogDescription>
          </DialogHeader>
          
          {selectedProject && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-sm">Budget</h3>
                  <p className="text-lg">{selectedProject.budget.toFixed(2)} JD</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm">Status</h3>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={selectedProject.isActive}
                      onCheckedChange={(checked) => handleToggleProjectStatus(selectedProject.id, checked)}
                      disabled={updateProjectStatusMutation.isPending}
                    />
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      selectedProject.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedProject.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {updateProjectStatusMutation.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary ml-2" />
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    {selectedProject.isActive 
                      ? 'Project is active and can be selected for trip requests' 
                      : 'Project is inactive and will show a warning on trip requests'}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-sm">Department</h3>
                  <p>
                    {selectedProject.departmentId ? (
                      <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                        {departments?.find((d: any) => d.id === selectedProject.departmentId)?.name || 'Unknown Department'}
                      </span>
                    ) : (
                      <span className="text-neutral-400">No department assigned</span>
                    )}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-sm">Created Date</h3>
                  <p>{format(new Date(selectedProject.createdAt), 'MMM d, yyyy')}</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm">Expiry Date</h3>
                  <p>
                    {selectedProject.expiryDate ? (
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        new Date(selectedProject.expiryDate) < new Date() 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {format(new Date(selectedProject.expiryDate), 'MMM d, yyyy')}
                      </span>
                    ) : (
                      <span className="text-neutral-400">No expiry date</span>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="pt-4">
                <ProjectDocuments 
                  projectId={selectedProject.id} 
                  isProjectManager={true}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setProjectDetailDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}