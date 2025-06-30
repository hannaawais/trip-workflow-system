import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Plus, Trash2, Edit2, CheckCircle, UserCog, FileText, Save, Settings, History, Ruler, Filter, RefreshCw, Search } from "lucide-react";
import ProjectDocuments from "@/components/project-documents";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function AdminPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("users");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userRoleDialogOpen, setUserRoleDialogOpen] = useState(false);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [projectDetailDialogOpen, setProjectDetailDialogOpen] = useState(false);
  
  // System settings states
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
  // Audit logs states
  const [textFilter, setTextFilter] = useState("");
  const [actionTypeFilter, setActionTypeFilter] = useState<string | null>(null);
  const [userIdFilter, setUserIdFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // KM rates states
  const [isAddRateModalOpen, setIsAddRateModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<any | null>(null);
  const [isDeleteRateDialogOpen, setIsDeleteRateDialogOpen] = useState(false);
  const [deletingRateId, setDeletingRateId] = useState<number | null>(null);
  const [isRecalculateDialogOpen, setIsRecalculateDialogOpen] = useState(false);

  // Fetch users
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/users"],
  });

  // Fetch departments
  const { data: departments, isLoading: isLoadingDepartments } = useQuery({
    queryKey: ["/api/departments"],
  });

  // Fetch projects
  const { data: projects, isLoading: isLoadingProjects } = useQuery({
    queryKey: ["/api/projects"],
  });
  
  // Fetch system settings
  const { data: systemSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["/api/system-settings"],
  });
  
  // Fetch audit logs
  const { data: auditLogs, isLoading: isLoadingAuditLogs, refetch: refetchAuditLogs } = useQuery({
    queryKey: ["/api/audit-logs"],
  });
  
  // Fetch KM rates
  const { data: kmRates, isLoading: isLoadingKmRates } = useQuery<any[]>({
    queryKey: ['/api/km-rates'],
  });

  // Department form schema
  const departmentSchema = z.object({
    name: z.string().min(1, "Department name is required"),
    budget: z.string().refine(val => !isNaN(Number(val)) && Number(val) >= 0, {
      message: "Budget must be a positive number",
    }),
    managerId: z.number({
      required_error: "Department manager is required",
    }),
    secondManagerId: z.number().optional(),
    isActive: z.boolean().default(true),
  });

  // Project form schema
  const projectSchema = z.object({
    name: z.string().min(1, "Project name is required"),
    budget: z.string().refine(val => !isNaN(Number(val)) && Number(val) >= 0, {
      message: "Budget must be a positive number",
    }),
    departmentId: z.number({
      required_error: "Department is required",
    }),
    managerId: z.number({
      required_error: "Project manager is required",
    }),
    secondManagerId: z.number().optional(),
    expiryDate: z.union([
      z.date().optional(),
      z.string().transform((str) => str ? new Date(str) : undefined).optional()
    ]),
    isActive: z.boolean().default(true),
  });

  // Role change schema
  const roleChangeSchema = z.object({
    role: z.string().min(1, "Role is required"),
  });
  
  // User creation schema
  const userSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email("Must be a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    department: z.string().min(1, "Department is required"),
    companyNumber: z.string().min(1, "Company number is required"),
    homeAddress: z.string().min(1, "Home address is required"),
    role: z.string().min(1, "Role is required"),
  });
  
  // User edit schema
  const userEditSchema = z.object({
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email("Must be a valid email address"),
    department: z.string().min(1, "Department is required"),
    companyNumber: z.string().min(1, "Company number is required"),
    homeAddress: z.string().min(1, "Home address is required"),
  });
  
  // System setting schema
  const systemSettingSchema = z.object({
    maxKilometers: z.string().refine(val => !isNaN(Number(val)) && Number(val) >= 0, {
      message: "Value must be a positive number",
    }),
  });
  
  // System settings form setup
  const systemSettingsForm = useForm<z.infer<typeof systemSettingSchema>>({
    resolver: zodResolver(systemSettingSchema),
    defaultValues: {
      maxKilometers: "0",
    }
  });
  
  // Mutation for updating system settings
  const updateSystemSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await apiRequest("PATCH", `/api/system-settings/${key}`, { value });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Setting updated",
        description: "The system setting has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings"] });
      setIsSavingSettings(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update setting",
        description: error.message,
        variant: "destructive",
      });
      setIsSavingSettings(false);
    }
  });

  // Department form setup
  const departmentForm = useForm<z.infer<typeof departmentSchema>>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: "",
      budget: "0",
      managerId: undefined,
      secondManagerId: undefined,
      isActive: true,
    }
  });

  // Project form setup
  const projectForm = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      budget: "0",
      departmentId: undefined,
      managerId: undefined,
      secondManagerId: undefined,
      expiryDate: undefined,
      isActive: true,
    }
  });

  // Role change form setup
  const roleChangeForm = useForm<z.infer<typeof roleChangeSchema>>({
    resolver: zodResolver(roleChangeSchema),
    defaultValues: {
      role: "",
    }
  });
  
  // User creation form setup
  const userForm = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: "",
      fullName: "",
      email: "",
      password: "",
      department: "",
      companyNumber: "",
      homeAddress: "",
      role: "Employee",
    }
  });
  
  // User edit form setup
  const userEditForm = useForm<z.infer<typeof userEditSchema>>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      fullName: "",
      email: "",
      department: "",
      companyNumber: "",
      homeAddress: "",
    }
  });

  // Mutation for creating departments
  const createDepartmentMutation = useMutation({
    mutationFn: async (data: { name: string; budget: number; managerId: number; secondManagerId?: number; isActive: boolean }) => {
      const res = await apiRequest("POST", "/api/departments", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Department created",
        description: "The department has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      departmentForm.reset();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create department",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for creating projects
  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; budget: number; departmentId: number; managerId: number; secondManagerId?: number; expiryDate?: Date; isActive: boolean }) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Project created",
        description: "The project has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      projectForm.reset();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create project",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for creating users
  const createUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof userSchema>) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "User created",
        description: "The user has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      userForm.reset();
      setCreateUserDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create user",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for updating user role
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/role`, { role });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "User role updated",
        description: "The user's role has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setUserRoleDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update user role",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutation for updating user information
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: number; data: z.infer<typeof userEditSchema> }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "User updated",
        description: "The user's information has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      userEditForm.reset();
      setEditUserDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update user",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutation for updating departments
  const updateDepartmentMutation = useMutation({
    mutationFn: async (data: { id: number; name: string; budget: number; managerId?: number; secondManagerId?: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/departments/${data.id}`, {
        name: data.name,
        budget: data.budget,
        managerId: data.managerId,
        secondManagerId: data.secondManagerId,
        isActive: data.isActive
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Department updated",
        description: "The department has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      departmentForm.reset();
      setDialogOpen(false);
      setIsEditing(false);
      setSelectedDepartment(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update department",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutation for updating projects
  const updateProjectMutation = useMutation({
    mutationFn: async (data: { id: number; name: string; budget: number; departmentId?: number; managerId?: number; secondManagerId?: number; expiryDate?: Date; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/projects/${data.id}`, {
        name: data.name,
        budget: data.budget,
        departmentId: data.departmentId,
        managerId: data.managerId,
        secondManagerId: data.secondManagerId,
        expiryDate: data.expiryDate,
        isActive: data.isActive
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Project updated",
        description: "The project has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      projectForm.reset();
      setDialogOpen(false);
      setIsEditing(false);
      setSelectedProject(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update project",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleCreateDepartment = (data: z.infer<typeof departmentSchema>) => {
    if (isEditing && selectedDepartment) {
      updateDepartmentMutation.mutate({
        id: selectedDepartment.id,
        name: data.name,
        budget: parseFloat(data.budget),
        managerId: data.managerId,
        secondManagerId: data.secondManagerId,
        isActive: data.isActive,
      });
    } else {
      createDepartmentMutation.mutate({
        name: data.name,
        budget: parseFloat(data.budget),
        managerId: data.managerId,
        secondManagerId: data.secondManagerId,
        isActive: data.isActive,
      });
    }
  };

  const handleCreateProject = (data: z.infer<typeof projectSchema>) => {
    if (isEditing && selectedProject) {
      updateProjectMutation.mutate({
        id: selectedProject.id,
        name: data.name,
        budget: parseFloat(data.budget),
        departmentId: data.departmentId,
        managerId: data.managerId,
        secondManagerId: data.secondManagerId,
        expiryDate: data.expiryDate,
        isActive: data.isActive,
      });
    } else {
      createProjectMutation.mutate({
        name: data.name,
        budget: parseFloat(data.budget),
        departmentId: data.departmentId,
        managerId: data.managerId,
        secondManagerId: data.secondManagerId,
        expiryDate: data.expiryDate,
        isActive: data.isActive,
      });
    }
  };

  const handleOpenCreateDialog = () => {
    setIsEditing(false);
    setSelectedDepartment(null);
    setSelectedProject(null);
    
    if (activeTab === "departments") {
      departmentForm.reset();
    } else if (activeTab === "projects") {
      projectForm.reset();
    }
    setDialogOpen(true);
  };
  
  const handleOpenEditDepartmentDialog = (department: any) => {
    setIsEditing(true);
    setSelectedDepartment(department);
    
    departmentForm.reset({
      name: department.name,
      budget: department.budget.toString(),
      managerId: department.managerId || undefined,
      secondManagerId: department.secondManagerId || undefined,
      isActive: department.isActive,
    });
    
    setDialogOpen(true);
  };
  
  const handleOpenEditProjectDialog = (project: any) => {
    setIsEditing(true);
    setSelectedProject(project);
    
    projectForm.reset({
      name: project.name,
      budget: project.budget.toString(),
      departmentId: project.departmentId || undefined,
      managerId: project.managerId || undefined,
      secondManagerId: project.secondManagerId || undefined,
      expiryDate: project.expiryDate ? new Date(project.expiryDate) : undefined,
      isActive: project.isActive,
    });
    
    setDialogOpen(true);
  };
  
  const handleOpenProjectDetailDialog = (project: any) => {
    setSelectedProject(project);
    setProjectDetailDialogOpen(true);
  };

  const handleOpenRoleChangeDialog = (user: any) => {
    setSelectedUser(user);
    roleChangeForm.setValue("role", user.role);
    setUserRoleDialogOpen(true);
  };

  const handleRoleChange = (data: z.infer<typeof roleChangeSchema>) => {
    if (!selectedUser) return;
    
    updateUserRoleMutation.mutate({
      userId: selectedUser.id,
      role: data.role,
    });
  };
  
  const handleCreateUser = (data: z.infer<typeof userSchema>) => {
    createUserMutation.mutate(data);
  };
  
  const handleOpenEditUserDialog = (user: any) => {
    setSelectedUser(user);
    userEditForm.reset({
      fullName: user.fullName,
      email: user.email,
      department: user.department,
      companyNumber: user.companyNumber,
      homeAddress: user.homeAddress,
    });
    setEditUserDialogOpen(true);
  };
  
  const handleUpdateUser = (data: z.infer<typeof userEditSchema>) => {
    if (!selectedUser) return;
    
    updateUserMutation.mutate({
      userId: selectedUser.id,
      data
    });
  };


    
  // Effect to set system settings form values when settings are loaded
  useEffect(() => {
    if (systemSettings && systemSettings.length > 0) {
      const maxKmSetting = systemSettings.find((setting: any) => setting.key === 'maxKilometers');
      if (maxKmSetting) {
        systemSettingsForm.setValue('maxKilometers', maxKmSetting.value);
      }
    }
  }, [systemSettings, systemSettingsForm]);
  
  // Handler for system settings update
  const handleUpdateSettings = (data: z.infer<typeof systemSettingSchema>) => {
    setIsSavingSettings(true);
    updateSystemSettingMutation.mutate({
      key: 'maxKilometers',
      value: data.maxKilometers
    });
  };

  return (
    <Layout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <h1 className="text-2xl font-semibold text-neutral-600">Administration</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Manage system settings, users, and data
          </p>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex flex-col md:flex-row gap-6 mt-6">
            <div className="md:w-64 bg-gray-50 border rounded-lg p-4">
              <div className="space-y-2">
                <button 
                  onClick={() => setActiveTab("users")} 
                  className={`w-full text-left px-4 py-2 rounded-md flex items-center ${activeTab === "users" ? "bg-primary text-white" : "hover:bg-gray-100"}`}
                >
                  <UserCog className="mr-2 h-4 w-4" />
                  <span>Users</span>
                </button>
                <button 
                  onClick={() => setActiveTab("departments")} 
                  className={`w-full text-left px-4 py-2 rounded-md flex items-center ${activeTab === "departments" ? "bg-primary text-white" : "hover:bg-gray-100"}`}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Departments</span>
                </button>
                <button 
                  onClick={() => setActiveTab("projects")} 
                  className={`w-full text-left px-4 py-2 rounded-md flex items-center ${activeTab === "projects" ? "bg-primary text-white" : "hover:bg-gray-100"}`}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Projects</span>
                </button>
                <button 
                  onClick={() => setActiveTab("settings")} 
                  className={`w-full text-left px-4 py-2 rounded-md flex items-center ${activeTab === "settings" ? "bg-primary text-white" : "hover:bg-gray-100"}`}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </button>
                <button 
                  onClick={() => setActiveTab("audit-logs")} 
                  className={`w-full text-left px-4 py-2 rounded-md flex items-center ${activeTab === "audit-logs" ? "bg-primary text-white" : "hover:bg-gray-100"}`}
                >
                  <History className="mr-2 h-4 w-4" />
                  <span>Audit Logs</span>
                </button>
                <button 
                  onClick={() => setActiveTab("km-rates")} 
                  className={`w-full text-left px-4 py-2 rounded-md flex items-center ${activeTab === "km-rates" ? "bg-primary text-white" : "hover:bg-gray-100"}`}
                >
                  <Ruler className="mr-2 h-4 w-4" />
                  <span>KM Rates</span>
                </button>
              </div>
            </div>
            
            <div className="mt-4">
              {activeTab === "users" ? (
                <Button onClick={() => setCreateUserDialogOpen(true)} className="mb-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create User
                </Button>
              ) : activeTab === "departments" || activeTab === "projects" ? (
                <Button onClick={handleOpenCreateDialog} className="mb-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create {activeTab === "departments" ? "Department" : "Project"}
                </Button>
              ) : null}
            </div>
            
            {/* Users Tab */}
            {activeTab === "users" && (
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    View and manage user accounts and permissions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingUsers ? (
                    <div className="flex justify-center my-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : !users || users.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-neutral-500">No users found.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user: any) => (
                          <TableRow key={user.id}>
                            <TableCell>{user.id}</TableCell>
                            <TableCell>{user.fullName}</TableCell>
                            <TableCell>{user.username}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>{user.department}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                user.role === 'Admin' 
                                  ? 'bg-purple-100 text-purple-800' 
                                  : user.role === 'Finance' 
                                    ? 'bg-blue-100 text-blue-800'
                                    : user.role === 'Manager'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                              }`}>
                                {user.role}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenEditUserDialog(user)}
                                >
                                  <Edit2 className="h-4 w-4 mr-1" />
                                  Edit User
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenRoleChangeDialog(user)}
                                >
                                  <UserCog className="h-4 w-4 mr-1" />
                                  Change Role
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
              

            )}
            
            {/* Departments Tab */}
            {activeTab === "departments" && (
              <Card>
                <CardHeader>
                  <CardTitle>Department Management</CardTitle>
                  <CardDescription>
                    Create and manage departments and their budgets.
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
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-right">Monthly Budget</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {departments.map((dept: any) => (
                          <TableRow key={dept.id}>
                            <TableCell>{dept.id}</TableCell>
                            <TableCell>{dept.name}</TableCell>
                            <TableCell className="text-right">${dept.budget.toFixed(2)}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                dept.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {dept.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </TableCell>
                            <TableCell>
                              {format(new Date(dept.createdAt), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mr-2"
                                onClick={() => handleOpenEditDepartmentDialog(dept)}
                              >
                                <Edit2 className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Projects Tab */}
            <TabsContent value="projects">
              <Card>
                <CardHeader>
                  <CardTitle>Project Management</CardTitle>
                  <CardDescription>
                    Create and manage projects and their budgets.
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
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead className="text-right">Budget</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created Date</TableHead>
                          <TableHead>Expiry Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projects.map((proj: any) => (
                          <TableRow key={proj.id}>
                            <TableCell>{proj.id}</TableCell>
                            <TableCell>{proj.name}</TableCell>
                            <TableCell>
                              {departments?.find((dept: any) => dept.id === proj.departmentId)?.name || 'Not assigned'}
                            </TableCell>
                            <TableCell className="text-right">${proj.budget.toFixed(2)}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                proj.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {proj.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </TableCell>
                            <TableCell>
                              {format(new Date(proj.createdAt), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              {proj.expiryDate ? (
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  new Date(proj.expiryDate) < new Date() 
                                    ? 'bg-red-100 text-red-800' 
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {format(new Date(proj.expiryDate), 'MMM d, yyyy')}
                                </span>
                              ) : (
                                <span className="text-neutral-400">No expiry date</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mr-2"
                                onClick={() => handleOpenEditProjectDialog(proj)}
                              >
                                <Edit2 className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenProjectDetailDialog(proj)}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                Documents
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Settings Tab */}
            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle>System Settings</CardTitle>
                  <CardDescription>
                    Configure system-wide settings for the transportation workflow.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingSettings ? (
                    <div className="flex justify-center my-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <Form {...systemSettingsForm}>
                      <form onSubmit={systemSettingsForm.handleSubmit(handleUpdateSettings)} className="space-y-8">
                        <FormField
                          control={systemSettingsForm.control}
                          name="maxKilometers"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Maximum Kilometers Without Required Attachment</FormLabel>
                              <FormControl>
                                <Input type="number" min="0" step="1" {...field} />
                              </FormControl>
                              <FormDescription>
                                Trip requests with kilometers exceeding this value will require an attachment. Set to 0 to always require attachments.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <Button type="submit" disabled={isSavingSettings}>
                          {isSavingSettings ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save Settings
                            </>
                          )}
                        </Button>
                      </form>
                    </Form>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Create/Edit Department/Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit" : "Create"} {activeTab === "departments" ? "Department" : "Project"}
            </DialogTitle>
            <DialogDescription>
              {activeTab === "departments" 
                ? isEditing ? "Edit department details and budget allocation." : "Add a new department with budget allocation."
                : isEditing ? "Edit project details and budget allocation." : "Add a new project with budget allocation."
              }
            </DialogDescription>
          </DialogHeader>
          
          {activeTab === "departments" && (
            <Form {...departmentForm}>
              <form onSubmit={departmentForm.handleSubmit(handleCreateDepartment)} className="space-y-4">
                <FormField
                  control={departmentForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter department name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={departmentForm.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Budget</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-neutral-500 sm:text-sm">$</span>
                          </div>
                          <Input 
                            type="number" 
                            min="0" 
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
                  control={departmentForm.control}
                  name="managerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department Manager (Role: Manager) <span className="text-red-500">*</span></FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department manager" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users?.filter((user: any) => 
                            user.role === 'Manager' || user.role === 'Admin'
                          ).map((user: any) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The primary department manager who must approve all requests.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={departmentForm.control}
                  name="secondManagerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Second Approval Manager (Optional)</FormLabel>
                      <Select 
                        onValueChange={(value) => value === "0" ? field.onChange(undefined) : field.onChange(parseInt(value))}
                        value={field.value?.toString() || "0"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select second manager (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">None</SelectItem>
                          {users?.filter((user: any) => 
                            user.role === 'Manager' || user.role === 'Admin'
                          ).map((user: any) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        If selected, this manager must approve requests after the primary manager.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={departmentForm.control}
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
                          Mark this department as active
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={isEditing ? updateDepartmentMutation.isPending : createDepartmentMutation.isPending}
                  >
                    {(isEditing ? updateDepartmentMutation.isPending : createDepartmentMutation.isPending) ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {isEditing ? "Update Department" : "Create Department"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
          
          {activeTab === "projects" && (
            <Form {...projectForm}>
              <form onSubmit={projectForm.handleSubmit(handleCreateProject)} className="space-y-4">
                <FormField
                  control={projectForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter project name" {...field} />
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
                      <FormLabel>Budget</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-neutral-500 sm:text-sm">$</span>
                          </div>
                          <Input 
                            type="number" 
                            min="0" 
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
                  control={projectForm.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department <span className="text-red-500">*</span></FormLabel>
                      <Select 
                        value={field.value?.toString() || "0"}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">Select a department</SelectItem>
                          {departments?.filter((dept: any) => dept.isActive).map((dept: any) => (
                            <SelectItem key={dept.id} value={dept.id.toString()}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The department that owns this project.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={projectForm.control}
                  name="managerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Manager (Role: Manager) <span className="text-red-500">*</span></FormLabel>
                      <Select 
                        value={field.value?.toString() || "0"}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a manager" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">Select a manager</SelectItem>
                          {users?.filter((user: any) => 
                            user.role === 'Manager' || user.role === 'Admin'
                          ).map((user: any) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The primary manager responsible for approving trip requests for this project.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={projectForm.control}
                  name="secondManagerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Second Approval Manager</FormLabel>
                      <Select 
                        value={field.value?.toString() || "none"}
                        onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a secondary manager (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {users?.filter((user: any) => 
                            user.role === 'Manager' || user.role === 'Admin'
                          ).map((user: any) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        If selected, this manager must approve requests after the primary manager.
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
                      <FormLabel>Project Expiry Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={`w-full pl-3 text-left font-normal ${!field.value ? "text-muted-foreground" : ""}`}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Select expiry date (optional)</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        When a project expires, it will be automatically deactivated and cannot be selected for trip requests.
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
                          Mark this project as active
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={isEditing ? updateProjectMutation.isPending : createProjectMutation.isPending}
                  >
                    {(isEditing ? updateProjectMutation.isPending : createProjectMutation.isPending) ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {isEditing ? "Update Project" : "Create Project"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...userForm}>
            <form onSubmit={userForm.handleSubmit(handleCreateUser)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={userForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="johndoe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={userForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={userForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="john.doe@example.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={userForm.control}
                  name="companyNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Number</FormLabel>
                      <FormControl>
                        <Input placeholder="EMP12345" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={userForm.control}
                  name="homeAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Home Address</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main St, City, Country" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={userForm.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select 
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments?.filter((dept: any) => dept.isActive).map((dept: any) => (
                            <SelectItem key={dept.id} value={dept.name}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={userForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select 
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Employee">Employee</SelectItem>
                          <SelectItem value="Manager">Manager</SelectItem>
                          <SelectItem value="Finance">Finance</SelectItem>
                          <SelectItem value="Admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={userForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormDescription>
                        Must be at least 6 characters.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setCreateUserDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createUserMutation.isPending}
                >
                  {createUserMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Create User
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Change User Role Dialog */}
      <Dialog open={userRoleDialogOpen} onOpenChange={setUserRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update role for {selectedUser?.fullName}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...roleChangeForm}>
            <form onSubmit={roleChangeForm.handleSubmit(handleRoleChange)} className="space-y-4">
              <FormField
                control={roleChangeForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select 
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Employee">Employee</SelectItem>
                        <SelectItem value="Manager">Manager</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="Admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setUserRoleDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={updateUserRoleMutation.isPending}
                >
                  {updateUserRoleMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Update Role
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Edit User Dialog */}
      <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Information</DialogTitle>
            <DialogDescription>
              Update profile information for {selectedUser?.fullName}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...userEditForm}>
            <form onSubmit={userEditForm.handleSubmit(handleUpdateUser)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={userEditForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={userEditForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="user@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={userEditForm.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select 
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments?.filter((dept: any) => dept.isActive).map((dept: any) => (
                            <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={userEditForm.control}
                  name="companyNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Number</FormLabel>
                      <FormControl>
                        <Input placeholder="12345" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={userEditForm.control}
                  name="homeAddress"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Home Address</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main St, City" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditUserDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateUserMutation.isPending}
                >
                  {updateUserMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update User
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
                  <p className="text-lg">${selectedProject.budget.toFixed(2)}</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm">Status</h3>
                  <p>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      selectedProject.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedProject.isActive ? 'Active' : 'Inactive'}
                    </span>
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
                  isProjectManager={
                    ['Admin'].includes(user?.role) || ['Admin'].includes(user?.activeRole) || 
                    (['Manager'].includes(user?.role) && 
                     (user?.id === selectedProject.managerId || user?.id === selectedProject.secondManagerId))
                  }
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
