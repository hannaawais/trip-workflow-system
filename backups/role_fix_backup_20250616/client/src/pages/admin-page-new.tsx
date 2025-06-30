import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient, criticalDataQueryOptions, referenceDataQueryOptions } from "@/lib/queryClient";
import { insertSiteSchema, type Site, type InsertSite } from "@shared/schema";
import { Loader2, Plus, Trash2, Edit2, CheckCircle, UserCog, FileText, Save, Settings, History, Ruler, Filter, RefreshCw, Search, UserCheck, UserX, CalendarIcon, MapPin, Shield } from "lucide-react";

// Helper function for role styling - database-first approach
const getRoleColorClass = (role: string) => {
  const roleStyles = {
    'Admin': 'bg-purple-100 text-purple-800',
    'Finance': 'bg-blue-100 text-blue-800',
    'Manager': 'bg-green-100 text-green-800',
    'Employee': 'bg-gray-100 text-gray-800'
  };
  return roleStyles[role as keyof typeof roleStyles] || 'bg-gray-100 text-gray-800';
};
import { Combobox } from "@/components/ui/combobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import ProjectDocuments from "@/components/project-documents";
import PermissionSummaryPage from "./permission-summary-page";
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
import { ResizableDialogContent } from "@/components/ui/resizable-dialog-content";
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
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Site form schema
const siteFormSchema = insertSiteSchema.extend({
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
});

type SiteFormData = z.infer<typeof siteFormSchema>;


export default function AdminPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("users");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [currentDepartmentId, setCurrentDepartmentId] = useState<number | null>(null);
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

  // Sites states
  const [isCreateSiteDialogOpen, setIsCreateSiteDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<any | null>(null);
  const [siteSearchTerm, setSiteSearchTerm] = useState("");

  // Search states for other tabs
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState("");
  const [projectSearchTerm, setProjectSearchTerm] = useState("");

  // Fetch users for display (basic info) - critical admin data
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/users"],
    ...criticalDataQueryOptions,
  });

  // Fetch basic user info for non-admin operations - reference data
  const { data: basicUsers = [], isLoading: isLoadingBasicUsers } = useQuery({
    queryKey: ["/api/users/basic"],
    ...referenceDataQueryOptions,
  });

  // Fetch departments - critical admin data
  const { data: departments = [], isLoading: isLoadingDepartments } = useQuery({
    queryKey: ["/api/departments"],
    ...criticalDataQueryOptions,
  });

  // Fetch projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ["/api/projects"],
  });
  
  // Fetch system settings (only for Admin users)
  const { data: systemSettings = [], isLoading: isLoadingSettings } = useQuery({
    queryKey: ["/api/system-settings"],
    enabled: user?.role === 'Admin' || user?.activeRole === 'Admin',
  });
  
  // Fetch audit logs (only for Admin users)
  const { data: auditLogs = [], isLoading: isLoadingAuditLogs, refetch: refetchAuditLogs } = useQuery({
    queryKey: ["/api/audit-logs"],
    enabled: user?.role === 'Admin' || user?.activeRole === 'Admin',
  });
  
  // Fetch KM rates
  const { data: kmRates = [], isLoading: isLoadingKmRates } = useQuery({
    queryKey: ['/api/km-rates'],
  });

  // Fetch sites
  const { data: sites = [], isLoading: isLoadingSites } = useQuery({
    queryKey: ['/api/sites'],
  });

  // Set default values for system settings form after loading
  useEffect(() => {
    if (systemSettings && Array.isArray(systemSettings) && systemSettings.length > 0) {
      const maxKmSetting = (systemSettings as any[]).find((setting: any) => setting.settingKey === 'maxKilometers');
      
      if (maxKmSetting) {
        systemSettingsForm.setValue('maxKilometers', maxKmSetting.settingValue);
      }
    }
  }, [systemSettings]);

  // Department form schema
  const departmentSchema = z.object({
    name: z.string().min(1, "Department name is required"),
    budget: z.string().refine(val => !isNaN(Number(val)) && Number(val) >= 0, {
      message: "Budget must be a positive number",
    }),
    managerId: z.number({
      required_error: "Department manager is required",
    }),
    secondManagerId: z.number().nullable().optional(),
    thirdManagerId: z.number().nullable().optional(),
    parentDepartmentId: z.number().optional(),
    monthlyBudgetBonus: z.string().refine(val => !isNaN(Number(val)) && Number(val) >= 0, {
      message: "Monthly budget bonus must be a positive number",
    }).default("0"),
    monthlyBudgetBonusResetDate: z.date().optional(),
    isActive: z.boolean().default(true),
  }).refine(data => {
    // Check if secondManagerId is the same as managerId
    if (data.secondManagerId && data.managerId === data.secondManagerId) {
      return false;
    }
    // Check if thirdManagerId is the same as managerId or secondManagerId
    if (data.thirdManagerId && 
        (data.managerId === data.thirdManagerId || 
         (data.secondManagerId && data.secondManagerId === data.thirdManagerId))) {
      return false;
    }
    return true;
  }, {
    message: "The same manager cannot be assigned to multiple management roles",
    path: ["thirdManagerId"], // This will show the error under thirdManagerId field
  }).superRefine((data, ctx) => {
    // Prevent circular references in department hierarchy
    // If we're editing an existing department with its ID set
    if (currentDepartmentId && data.parentDepartmentId === currentDepartmentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A department cannot be its own parent",
        path: ["parentDepartmentId"]
      });
    }
    
    // Check if selected parent is in the department's own child chain
    if (data.parentDepartmentId && Array.isArray(departments) && departments.length > 0) {
      // Find all potential child departments recursively
      const childDepartments = new Set<number>();
      
      // Function to recursively find all children
      const findChildren = (deptId: number) => {
        for (const dept of (departments as any[])) {
          if (dept.parentDepartmentId === deptId) {
            childDepartments.add(dept.id);
            findChildren(dept.id);
          }
        }
      };
      
      // If we have a current department ID (editing mode), find its children
      if (currentDepartmentId) {
        findChildren(currentDepartmentId);
      }
      
      // If the parent department is actually one of this department's children,
      // it would create a circular reference
      if (childDepartments.has(data.parentDepartmentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Circular reference: a department cannot have its child as its parent",
          path: ["parentDepartmentId"]
        });
      }
    }
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
    expiryDate: z.date().optional(),
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
    homeLocation: z.string()
      .regex(/^-?\d+\.\d+,-?\d+\.\d+$/, "Home location must be in format: latitude,longitude (e.g., 31.9522,35.2332)")
      .optional(),
    role: z.string().min(1, "Role is required"),
    directManagerName: z.string().optional(),
    directCostEntryPermission: z.boolean().default(false),
  });
  
  // User edit schema
  const userEditSchema = z.object({
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email("Must be a valid email address"),
    department: z.string().min(1, "Department is required"),
    role: z.string().min(1, "Role is required"),
    companyNumber: z.string().min(1, "Company number is required"),
    homeAddress: z.string().min(1, "Home address is required"),
    homeLocation: z.string()
      .regex(/^-?\d+\.\d+,-?\d+\.\d+$/, "Home location must be in format: latitude,longitude (e.g., 31.9522,35.2332)")
      .optional(),
    directManagerName: z.string().optional(),
    directCostEntryPermission: z.boolean().default(false),
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
      managerId: undefined as any,
      secondManagerId: undefined as any,
      thirdManagerId: undefined as any,
      parentDepartmentId: undefined as any,
      monthlyBudgetBonus: "0",
      monthlyBudgetBonusResetDate: undefined,
      isActive: true,
    }
  });

  // Project form setup
  const projectForm = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      budget: "0",
      departmentId: undefined as any,
      managerId: undefined as any,
      secondManagerId: undefined as any,
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
      homeLocation: "",
      role: "Employee",
      directManagerName: "",
      directCostEntryPermission: false,
    }
  });
  
  // User edit form setup
  const userEditForm = useForm<z.infer<typeof userEditSchema>>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      fullName: "",
      email: "",
      department: "",
      role: "Employee",
      companyNumber: "",
      homeAddress: "",
      homeLocation: "",
      directManagerName: "",
      directCostEntryPermission: false,
    }
  });

  // Mutation for creating departments
  const createDepartmentMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      budget: number; 
      managerId: number; 
      secondManagerId?: number; 
      thirdManagerId?: number;
      parentDepartmentId?: number;
      monthlyBudgetBonus?: number;
      monthlyBudgetBonusResetDate?: Date;
      isActive: boolean 
    }) => {
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
      setCurrentDepartmentId(null);
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

  // Mutation for editing users
  const editUserMutation = useMutation({
    mutationFn: async (data: { id: number; fullName: string; email: string; department: string; companyNumber: string; homeAddress: string; homeLocation?: string; directManagerName?: string; directCostEntryPermission: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${data.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "User updated",
        description: "The user has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      userEditForm.reset();
      setEditUserDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update user",
        description: error.message,
        variant: "destructive",
      });
    }
  });


  
  // Mutation for activating a user
  const activateUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/users/${userId}/activate`, {});
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "User activated",
        description: "The user has been successfully activated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to activate user",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutation for deactivating a user
  const deactivateUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/users/${userId}/deactivate`, {});
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "User deactivated",
        description: "The user has been successfully deactivated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to deactivate user",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for activating a department
  const activateDepartmentMutation = useMutation({
    mutationFn: async (departmentId: number) => {
      const res = await apiRequest("POST", `/api/departments/${departmentId}/activate`, {});
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Department activated",
        description: "The department has been successfully activated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to activate department",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutation for deactivating a department
  const deactivateDepartmentMutation = useMutation({
    mutationFn: async (departmentId: number) => {
      const res = await apiRequest("POST", `/api/departments/${departmentId}/deactivate`, {});
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Department deactivated",
        description: "The department has been successfully deactivated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to deactivate department",
        description: error.message,
        variant: "destructive",
      });
    }
  });



  // Mutation for updating departments
  const updateDepartmentMutation = useMutation({
    mutationFn: async (data: { 
      id: number; 
      name: string; 
      budget: number; 
      managerId?: number; 
      secondManagerId?: number;
      thirdManagerId?: number;
      parentDepartmentId?: number;
      monthlyBudgetBonus?: number;
      monthlyBudgetBonusResetDate?: Date;
      isActive: boolean 
    }) => {
      const res = await apiRequest("PATCH", `/api/departments/${data.id}`, data);
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
      setSelectedDepartment(null);
      setCurrentDepartmentId(null);
      setIsEditing(false);
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
      const res = await apiRequest("PATCH", `/api/projects/${data.id}`, data);
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
      setSelectedProject(null);
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update project",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for creating KM rates
  const createKmRateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/km-rates", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "KM Rate created",
        description: "The new kilometer rate has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/km-rates"] });
      setIsAddRateModalOpen(false);
      setEditingRate(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create KM Rate",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for updating KM rates
  const updateKmRateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/km-rates/${data.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "KM Rate updated",
        description: "The kilometer rate has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/km-rates"] });
      setIsAddRateModalOpen(false);
      setEditingRate(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update KM Rate",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for deleting KM rates
  const deleteKmRateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/km-rates/${id}`, {});
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "KM Rate deleted",
        description: "The kilometer rate has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/km-rates"] });
      setIsDeleteRateDialogOpen(false);
      setDeletingRateId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete KM Rate",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for recalculating trip costs
  const recalculateTripCostsMutation = useMutation({
    mutationFn: async (rateId?: number) => {
      // If a specific rate ID is provided, use the rate-specific endpoint
      // Otherwise use the global recalculation endpoint
      const endpoint = rateId 
        ? `/api/km-rates/${rateId}/recalculate-trips` 
        : "/api/km-rates/recalculate-trips";
      
      const res = await apiRequest("POST", endpoint, {});
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Recalculation completed",
        description: data.message || `Successfully recalculated costs for ${data.updatedCount || 0} trip requests.`,
      });
      // Only close the dialog when doing global recalculation
      if (data.scope !== 'rate-specific') {
        setIsRecalculateDialogOpen(false);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/trip-requests"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Recalculation failed",
        description: error.message,
        variant: "destructive",
      });
      setIsRecalculateDialogOpen(false);
    }
  });

  // Site form for creating and editing sites
  const createSiteForm = useForm<SiteFormData>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: {
      abbreviation: "",
      englishName: "",
      city: "",
      region: "",
      gpsLat: undefined,
      gpsLng: undefined,
      siteType: "Other",
      isActive: true,
    },
  });

  const editSiteForm = useForm<SiteFormData>({
    resolver: zodResolver(siteFormSchema),
  });

  // Site mutations
  const createSiteMutation = useMutation({
    mutationFn: async (data: SiteFormData) => {
      const res = await apiRequest("POST", "/api/sites", data);
      return await res.json();
    },
    onSuccess: async (newSite) => {
      queryClient.setQueryData(["/api/sites"], (old: Site[] = []) => [...old, newSite]);
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsCreateSiteDialogOpen(false);
      createSiteForm.reset();
      toast({
        title: "Success",
        description: "Site created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSiteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SiteFormData> }) => {
      const res = await apiRequest("PATCH", `/api/sites/${id}`, data);
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      setEditingSite(null);
      toast({
        title: "Success",
        description: "Site updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/sites/${id}`);
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({
        title: "Success",
        description: "Site deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Site handlers
  const handleCreateSite = (data: SiteFormData) => {
    createSiteMutation.mutate(data);
  };

  const handleUpdateSite = (data: SiteFormData) => {
    if (editingSite) {
      updateSiteMutation.mutate({ id: editingSite.id, data });
    }
  };

  const handleEditSite = (site: Site) => {
    setEditingSite(site);
    editSiteForm.reset({
      abbreviation: site.abbreviation,
      englishName: site.englishName,
      city: site.city || "",
      region: site.region || "",
      gpsLat: site.gpsLat ? Number(site.gpsLat) : undefined,
      gpsLng: site.gpsLng ? Number(site.gpsLng) : undefined,
      siteType: site.siteType,
      isActive: site.isActive,
    });
  };

  const handleDeleteSite = (id: number) => {
    if (confirm("Are you sure you want to delete this site?")) {
      deleteSiteMutation.mutate(id);
    }
  };

  // Filter users based on search term
  const filteredUsers = Array.isArray(users) ? users.filter((user: any) => {
    if (!userSearchTerm) return true;
    const searchText = userSearchTerm.toLowerCase();
    return (
      user.fullName.toLowerCase().includes(searchText) ||
      user.username.toLowerCase().includes(searchText) ||
      user.companyNumber.toLowerCase().includes(searchText) ||
      user.role.toLowerCase().includes(searchText) ||
      user.department.toLowerCase().includes(searchText)
    );
  }) : [];

  // Filter departments based on search term
  const filteredDepartments = Array.isArray(departments) ? departments.filter((dept: any) => {
    if (!departmentSearchTerm) return true;
    const searchText = departmentSearchTerm.toLowerCase();
    return (
      dept.name.toLowerCase().includes(searchText) ||
      (dept.managerName && dept.managerName.toLowerCase().includes(searchText)) ||
      (dept.parentDepartmentName && dept.parentDepartmentName.toLowerCase().includes(searchText))
    );
  }) : [];

  // Filter projects based on search term
  const filteredProjects = Array.isArray(projects) ? projects.filter((project: any) => {
    if (!projectSearchTerm) return true;
    const searchText = projectSearchTerm.toLowerCase();
    return (
      project.name.toLowerCase().includes(searchText) ||
      (project.managerName && project.managerName.toLowerCase().includes(searchText)) ||
      (project.secondManagerName && project.secondManagerName.toLowerCase().includes(searchText)) ||
      (project.departmentName && project.departmentName.toLowerCase().includes(searchText))
    );
  }) : [];

  // Filter sites based on search term
  const filteredSites = Array.isArray(sites) ? sites.filter((site: Site) => {
    if (!siteSearchTerm) return true;
    const searchText = siteSearchTerm.toLowerCase();
    return (
      site.abbreviation.toLowerCase().includes(searchText) ||
      site.englishName.toLowerCase().includes(searchText) ||
      (site.city && site.city.toLowerCase().includes(searchText)) ||
      (site.region && site.region.toLowerCase().includes(searchText))
    );
  }) : [];

  // Filter audit logs based on selected filters
  const filteredAuditLogs = Array.isArray(auditLogs) ? auditLogs.filter((log: any) => {
    let matchesText = true;
    let matchesAction = true;
    let matchesUser = true;
    let matchesDate = true;
    
    if (textFilter) {
      const searchText = textFilter.toLowerCase();
      matchesText = 
        (log.action?.toLowerCase().includes(searchText) || false) ||
        (log.details?.toLowerCase().includes(searchText) || false) ||
        (log.userName && log.userName.toLowerCase().includes(searchText));
    }
    
    if (actionTypeFilter) {
      matchesAction = log.action === actionTypeFilter;
    }
    
    if (userIdFilter) {
      matchesUser = log.userId === parseInt(userIdFilter);
    }
    
    if (dateFilter) {
      try {
        const logDate = new Date(log.timestamp).setHours(0, 0, 0, 0);
        const filterDate = new Date(dateFilter).setHours(0, 0, 0, 0);
        matchesDate = logDate === filterDate;
      } catch (error) {
        matchesDate = false;
      }
    }
    
    return matchesText && matchesAction && matchesUser && matchesDate;
  }) : [];

  // Get unique action types from audit logs
  const uniqueActionTypes = Array.isArray(auditLogs) ? Array.from(new Set(auditLogs.map((log: any) => log.action).filter(Boolean))) : [];
  
  // Get unique user IDs and names from audit logs
  const uniqueUsers = Array.isArray(auditLogs) ? 
    Array.from(
      new Map(
        auditLogs
          .filter((log: any) => log.userId && log.userName)
          .map((log: any) => [log.userId, { id: log.userId, name: log.userName }])
      ).values()
    ) : [];

  // Handle opening create dialog
  const handleOpenCreateDialog = () => {
    setIsEditing(false);
    setSelectedDepartment(null);
    setSelectedProject(null);
    setCurrentDepartmentId(null);
    
    if (activeTab === "departments") {
      departmentForm.reset({
        name: "",
        budget: "0",
        managerId: undefined as any,
        secondManagerId: undefined as any,
        thirdManagerId: undefined as any,
        parentDepartmentId: undefined as any,
        monthlyBudgetBonus: "0",
        monthlyBudgetBonusResetDate: undefined,
        isActive: true,
      });
    } else {
      projectForm.reset({
        name: "",
        budget: "0",
        departmentId: undefined as any,
        managerId: undefined as any,
        secondManagerId: undefined as any,
        expiryDate: undefined,
        isActive: true,
      });
    }
    
    setDialogOpen(true);
  };

  // Handle opening edit department dialog with fresh data fetch
  const handleOpenEditDepartmentDialog = async (department: any) => {
    setIsEditing(true);
    setSelectedDepartment(department);
    setCurrentDepartmentId(department.id);
    
    // Force refresh departments data before populating form to ensure latest values
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      await queryClient.refetchQueries({ queryKey: ["/api/departments"] });
      
      // Get the fresh department data
      const freshDepartments = queryClient.getQueryData(["/api/departments"]) as any[];
      const freshDepartment = freshDepartments?.find(d => d.id === department.id) || department;
      
      departmentForm.reset({
        name: freshDepartment.name,
        budget: freshDepartment.budget.toString(),
        managerId: freshDepartment.managerId,
        secondManagerId: freshDepartment.secondManagerId || undefined,
        thirdManagerId: freshDepartment.thirdManagerId || undefined,
        parentDepartmentId: freshDepartment.parentDepartmentId || undefined,
        monthlyBudgetBonus: freshDepartment.monthlyBudgetBonus?.toString() || "0",
        monthlyBudgetBonusResetDate: freshDepartment.monthlyBudgetBonusResetDate ? new Date(freshDepartment.monthlyBudgetBonusResetDate) : undefined,
        isActive: freshDepartment.isActive,
      });
    } catch (error) {
      console.error('Failed to fetch fresh department data:', error);
      // Fallback to existing data if fresh fetch fails
      departmentForm.reset({
        name: department.name,
        budget: department.budget.toString(),
        managerId: department.managerId,
        secondManagerId: department.secondManagerId || undefined,
        thirdManagerId: department.thirdManagerId || undefined,
        parentDepartmentId: department.parentDepartmentId || undefined,
        monthlyBudgetBonus: department.monthlyBudgetBonus?.toString() || "0",
        monthlyBudgetBonusResetDate: department.monthlyBudgetBonusResetDate ? new Date(department.monthlyBudgetBonusResetDate) : undefined,
        isActive: department.isActive,
      });
    }
    
    setDialogOpen(true);
  };

  // Handle opening edit project dialog
  const handleOpenEditProjectDialog = (project: any) => {
    setIsEditing(true);
    setSelectedProject(project);
    
    projectForm.reset({
      name: project.name,
      budget: project.budget.toString(),
      departmentId: project.departmentId,
      managerId: project.managerId,
      secondManagerId: project.secondManagerId || undefined,
      expiryDate: project.expiryDate ? new Date(project.expiryDate) : undefined,
      isActive: project.isActive,
    });
    
    setDialogOpen(true);
  };

  // Handle opening project detail dialog
  const handleOpenProjectDetailDialog = (project: any) => {
    setSelectedProject(project);
    setProjectDetailDialogOpen(true);
  };



  // Handle opening edit user dialog
  const handleOpenEditUserDialog = (user: any) => {
    setSelectedUser(user);
    userEditForm.reset({
      fullName: user.fullName,
      email: user.email,
      department: user.department,
      role: user.role,
      companyNumber: user.companyNumber,
      homeAddress: user.homeAddress,
      homeLocation: user.homeLocation || "",
      directManagerName: user.directManagerName || "",
      directCostEntryPermission: user.directCostEntryPermission || false,
    });
    setEditUserDialogOpen(true);
  };

  // Handle updating system settings
  const handleUpdateSettings = (data: z.infer<typeof systemSettingSchema>) => {
    setIsSavingSettings(true);
    updateSystemSettingMutation.mutate({
      key: 'maxKilometers',
      value: data.maxKilometers,
    });
  };

  // Handle creating department
  const handleCreateDepartment = (data: z.infer<typeof departmentSchema>) => {
    // Prevent double submission
    if (createDepartmentMutation.isPending || updateDepartmentMutation.isPending) {
      return;
    }
    
    const formData = {
      ...data,
      budget: Number(data.budget),
      monthlyBudgetBonus: data.monthlyBudgetBonus ? Number(data.monthlyBudgetBonus) : 0,
      monthlyBudgetBonusResetDate: data.monthlyBudgetBonusResetDate,
      secondManagerId: data.secondManagerId === null ? undefined : data.secondManagerId,
      thirdManagerId: data.thirdManagerId === null ? undefined : data.thirdManagerId,
    };
    
    if (isEditing && selectedDepartment) {
      console.log('Updating department:', selectedDepartment.id, formData);
      updateDepartmentMutation.mutate({
        id: selectedDepartment.id,
        ...formData,
      });
    } else {
      console.log('Creating department:', formData);
      createDepartmentMutation.mutate(formData);
    }
  };

  // Handle creating project
  const handleCreateProject = (data: z.infer<typeof projectSchema>) => {
    // Check for duplicate project name (except when editing the same project)
    const existingProject = (projects as any)?.find((p: any) => 
      p.name.toLowerCase() === data.name.toLowerCase() && 
      (!isEditing || p.id !== selectedProject?.id)
    );
    
    if (existingProject) {
      toast({
        title: "Duplicate project name",
        description: "A project with this name already exists. Please choose a different name.",
        variant: "destructive",
      });
      return;
    }
    
    const formData = {
      ...data,
      budget: Number(data.budget),
      expiryDate: data.expiryDate || undefined,
    };
    
    if (isEditing && selectedProject) {
      updateProjectMutation.mutate({
        id: selectedProject.id,
        ...formData,
      });
    } else {
      createProjectMutation.mutate(formData);
    }
  };

  // Handle creating user
  const handleCreateUser = (data: z.infer<typeof userSchema>) => {
    createUserMutation.mutate(data);
  };

  // Handle editing user
  const handleEditUser = (data: z.infer<typeof userEditSchema>) => {
    if (selectedUser) {
      editUserMutation.mutate({
        id: selectedUser.id,
        ...data,
      });
    }
  };
  
  // Handle user activation
  const handleActivateUser = (userId: number) => {
    activateUserMutation.mutate(userId);
  };
  
  // Handle user deactivation
  const handleDeactivateUser = (userId: number) => {
    deactivateUserMutation.mutate(userId);
  };
  
  // Handle activating a department
  const handleActivateDepartment = (departmentId: number) => {
    activateDepartmentMutation.mutate(departmentId);
  };
  
  // Handle deactivating a department
  const handleDeactivateDepartment = (departmentId: number) => {
    deactivateDepartmentMutation.mutate(departmentId);
  };

  // Handle adding or editing KM rate
  const handleAddOrEditKmRate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const rateValue = parseFloat(formData.get('rateValue') as string);
    const effectiveFrom = new Date(formData.get('effectiveFrom') as string);
    const effectiveToInput = formData.get('effectiveTo') as string;
    const effectiveTo = effectiveToInput ? new Date(effectiveToInput) : null;
    const description = formData.get('description') as string;
    
    if (isNaN(rateValue) || rateValue <= 0) {
      toast({
        title: "Invalid rate value",
        description: "Rate value must be a positive number.",
        variant: "destructive",
      });
      return;
    }
    
    const data = {
      rateValue,
      effectiveFrom,
      effectiveTo,
      description
    };
    
    if (editingRate) {
      updateKmRateMutation.mutate({
        id: editingRate.id,
        ...data
      });
    } else {
      createKmRateMutation.mutate(data);
    }
  };

  // Handle deleting KM rate
  const handleDeleteKmRate = () => {
    if (deletingRateId) {
      deleteKmRateMutation.mutate(deletingRateId);
    }
  };

  // Handle recalculating trip costs for a specific rate
  const handleRecalculateTrips = (rateId?: number) => {
    recalculateTripCostsMutation.mutate(rateId);
  };

  // Action type counts for audit logs
  const actionTypeCounts = uniqueActionTypes.map(action => {
    const count = Array.isArray(auditLogs) ? (auditLogs as any[]).filter((log: any) => log.action === action).length : 0;
    return { action, count };
  }).sort((a, b) => b.count - a.count);

  // User activity counts for audit logs
  const userActivityCounts = uniqueUsers.map((user: any) => {
    const count = Array.isArray(auditLogs) ? (auditLogs as any[]).filter((log: any) => log.userId === user.id).length : 0;
    return { user, count };
  }).sort((a, b) => b.count - a.count);

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
                <button 
                  onClick={() => setActiveTab("sites")} 
                  className={`w-full text-left px-4 py-2 rounded-md flex items-center ${activeTab === "sites" ? "bg-primary text-white" : "hover:bg-gray-100"}`}
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  <span>Sites</span>
                </button>
                <button 
                  onClick={() => setActiveTab("permissions")} 
                  className={`w-full text-left px-4 py-2 rounded-md flex items-center ${activeTab === "permissions" ? "bg-primary text-white" : "hover:bg-gray-100"}`}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  <span>Permission Summary</span>
                </button>
              </div>
            </div>
            
            <div className="flex-1">
              <div className="mb-4">
                {activeTab === "users" ? (
                  <Button onClick={() => setCreateUserDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create User
                  </Button>
                ) : activeTab === "departments" || activeTab === "projects" ? (
                  <Button onClick={handleOpenCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create {activeTab === "departments" ? "Department" : "Project"}
                  </Button>
                ) : activeTab === "km-rates" ? (
                  <div className="flex space-x-2">
                    <Button onClick={() => {
                      setEditingRate(null);
                      setIsAddRateModalOpen(true);
                    }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add KM Rate
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setIsRecalculateDialogOpen(true);
                      }}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Recalculate All Trip Costs
                    </Button>
                  </div>
                ) : activeTab === "sites" ? (
                  <Button onClick={() => setIsCreateSiteDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Site
                  </Button>
                ) : null}
              </div>
              
              {/* Users Tab */}
              {activeTab === "users" && (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>User Management</CardTitle>
                        <CardDescription>
                          View and manage user accounts and permissions.
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search users..."
                            value={userSearchTerm}
                            onChange={(e) => setUserSearchTerm(e.target.value)}
                            className="pl-8 w-64"
                          />
                        </div>

                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoadingUsers ? (
                      <div className="flex justify-center my-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-neutral-500">
                          {userSearchTerm ? "No users match your search." : "No users found."}
                        </p>
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
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUsers.map((user: any) => (
                            <TableRow key={user.id}>
                              <TableCell>{user.id}</TableCell>
                              <TableCell>{user.fullName}</TableCell>
                              <TableCell>{user.username}</TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell>{user.department}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  getRoleColorClass(user.role)
                                }`}>
                                  {user.role}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  user.isActive 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {user.isActive ? 'Active' : 'Inactive'}
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
                                    Edit
                                  </Button>
                                  {user.isActive ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeactivateUser(user.id)}
                                      className="border-red-200 text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-4 w-4 mr-1" />
                                      Deactivate
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleActivateUser(user.id)}
                                      className="border-green-200 text-green-700 hover:bg-green-50"
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Activate
                                    </Button>
                                  )}
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
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Department Management</CardTitle>
                        <CardDescription>
                          Create and manage departments and their budgets.
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search departments..."
                            value={departmentSearchTerm}
                            onChange={(e) => setDepartmentSearchTerm(e.target.value)}
                            className="pl-8 w-64"
                          />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoadingDepartments ? (
                      <div className="flex justify-center my-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : filteredDepartments.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-neutral-500">
                          {departmentSearchTerm ? "No departments match your search." : "No departments found."}
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Primary Manager</TableHead>
                            <TableHead>Parent Department</TableHead>
                            <TableHead className="text-right">Monthly Budget</TableHead>
                            <TableHead className="text-right">Monthly Bonus</TableHead>
                            <TableHead>Bonus Reset Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created Date</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredDepartments.map((dept: any) => {
                            // Find primary manager
                            const manager = users.find((user: any) => user.id === dept.managerId);
                            // Find parent department
                            const parentDept = departments.find((d: any) => d.id === dept.parentDepartmentId);
                            
                            return (
                              <TableRow key={dept.id}>
                                <TableCell>{dept.id}</TableCell>
                                <TableCell>{dept.name}</TableCell>
                                <TableCell>{manager ? manager.fullName : 'Not assigned'}</TableCell>
                                <TableCell>{parentDept ? parentDept.name : '-'}</TableCell>
                                <TableCell className="text-right">JD {Number(dept.budget).toFixed(2)}</TableCell>
                                <TableCell className="text-right">
                                  <div>
                                    {dept.monthlyBudgetBonus ? `JD ${Number(dept.monthlyBudgetBonus).toFixed(2)}` : 'JD 0.00'}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {dept.monthlyBudgetBonus > 0 && dept.monthlyBudgetBonusResetDate ? (
                                    <span className="text-sm">
                                      {(() => {
                                        try {
                                          const date = new Date(dept.monthlyBudgetBonusResetDate);
                                          if (isNaN(date.getTime())) return "Invalid date";
                                          return format(date, 'MMM d, yyyy');
                                        } catch (error) {
                                          return "Invalid date";
                                        }
                                      })()}
                                    </span>
                                  ) : (
                                    <span className="text-neutral-400">-</span>
                                  )}
                                </TableCell>
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
                                  {(() => {
                                    try {
                                      const date = new Date(dept.createdAt);
                                      if (isNaN(date.getTime())) return "Invalid date";
                                      return format(date, 'MMM d, yyyy');
                                    } catch (error) {
                                      return "Invalid date";
                                    }
                                  })()}
                                </TableCell>
                                <TableCell>
                                  <div className="flex space-x-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenEditDepartmentDialog(dept)}
                                    >
                                      <Edit2 className="h-4 w-4 mr-1" />
                                      Edit
                                    </Button>
                                    {dept.isActive ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeactivateDepartment(dept.id)}
                                        className="border-red-200 text-red-700 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-4 w-4 mr-1" />
                                        Deactivate
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleActivateDepartment(dept.id)}
                                        className="border-green-200 text-green-700 hover:bg-green-50"
                                      >
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Activate
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {/* Projects Tab */}
              {activeTab === "projects" && (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Project Management</CardTitle>
                        <CardDescription>
                          Create and manage projects and their budgets.
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search projects..."
                            value={projectSearchTerm}
                            onChange={(e) => setProjectSearchTerm(e.target.value)}
                            className="pl-8 w-64"
                          />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoadingProjects ? (
                      <div className="flex justify-center my-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : filteredProjects.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-neutral-500">
                          {projectSearchTerm ? "No projects match your search." : "No projects found."}
                        </p>
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
                          {filteredProjects.map((proj: any) => (
                            <TableRow key={proj.id}>
                              <TableCell>{proj.id}</TableCell>
                              <TableCell>{proj.name}</TableCell>
                              <TableCell>
                                {departments.find((dept: any) => dept.id === proj.departmentId)?.name || 'Not assigned'}
                              </TableCell>
                              <TableCell className="text-right">JD {proj.budget.toFixed(2)}</TableCell>
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
                                {(() => {
                                  try {
                                    return format(new Date(proj.createdAt), 'MMM d, yyyy')
                                  } catch (error) {
                                    return "Invalid date"
                                  }
                                })()}
                              </TableCell>
                              <TableCell>
                                {proj.expiryDate ? (
                                  (() => {
                                    try {
                                      const expiryDate = new Date(proj.expiryDate);
                                      const isExpired = expiryDate < new Date();
                                      return (
                                        <span className={`px-2 py-1 rounded-full text-xs ${
                                          isExpired
                                            ? 'bg-red-100 text-red-800' 
                                            : 'bg-blue-100 text-blue-800'
                                        }`}>
                                          {format(expiryDate, 'MMM d, yyyy')}
                                        </span>
                                      );
                                    } catch (error) {
                                      return "Invalid date";
                                    }
                                  })()
                                ) : (
                                  <span className="text-neutral-400">No expiry date</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
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
                                    Docs
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
              
              {/* Settings Tab */}
              {activeTab === "settings" && (
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
              )}
              
              {/* Audit Logs Tab */}
              {activeTab === "audit-logs" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Audit Logs</CardTitle>
                    <CardDescription>
                      View system activity logs for auditing and security purposes.
                    </CardDescription>
                    <div className="flex items-center mt-4 justify-between">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowFilters(!showFilters)}
                        className="mr-2"
                      >
                        <Filter className="mr-2 h-4 w-4" />
                        {showFilters ? "Hide Filters" : "Show Filters"}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setTextFilter("");
                          setActionTypeFilter(null);
                          setUserIdFilter(null);
                          setDateFilter(null);
                          refetchAuditLogs();
                        }}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh Logs
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {showFilters && (
                      <div className="border rounded-lg p-4 mb-6 bg-gray-50">
                        <h3 className="font-medium mb-4">Filter Logs</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="mb-4">
                              <label className="block text-sm font-medium mb-1">Search Text</label>
                              <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                  placeholder="Search in logs..."
                                  className="pl-8"
                                  value={textFilter}
                                  onChange={(e) => setTextFilter(e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="mb-4">
                              <label className="block text-sm font-medium mb-1">Action Type</label>
                              <Select 
                                value={actionTypeFilter || "all_actions"} 
                                onValueChange={(val) => {
                                  if (val === "all_actions") {
                                    setActionTypeFilter(null);
                                  } else {
                                    setActionTypeFilter(val);
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select action type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all_actions">All actions</SelectItem>
                                  {uniqueActionTypes.map(action => (
                                    <SelectItem key={action} value={action}>{action}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <div className="mb-4">
                              <label className="block text-sm font-medium mb-1">User</label>
                              <Select 
                                value={userIdFilter || "all_users"} 
                                onValueChange={(val) => {
                                  if (val === "all_users") {
                                    setUserIdFilter(null);
                                  } else {
                                    setUserIdFilter(val);
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select user" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all_users">All users</SelectItem>
                                  {uniqueUsers.map((user: any) => (
                                    <SelectItem key={user.id} value={user.id.toString()}>{user.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="mb-4">
                              <label className="block text-sm font-medium mb-1">Date</label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="w-full justify-start text-left font-normal"
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateFilter ? format(dateFilter, "PPP") : "Select date..."}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar
                                    mode="single"
                                    selected={dateFilter || undefined}
                                    onSelect={(date) => {
                                      // When user clicks the same date, toggle it off (clear the filter)
                                      if (dateFilter && date && 
                                          date.getDate() === dateFilter.getDate() && 
                                          date.getMonth() === dateFilter.getMonth() && 
                                          date.getFullYear() === dateFilter.getFullYear()) {
                                        setDateFilter(null);
                                      } else {
                                        setDateFilter(date || null);
                                      }
                                    }}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setTextFilter("");
                              setActionTypeFilter(null);
                              setUserIdFilter(null);
                              setDateFilter(null);
                            }}
                            className="mr-2"
                          >
                            Clear Filters
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    <div className="lg:grid lg:grid-cols-3 gap-6 mb-6">
                      <Card className="col-span-2 mb-6 lg:mb-0">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">Actions Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-3">
                          <div className="space-y-3">
                            {actionTypeCounts.slice(0, 5).map(item => (
                              <div key={item.action} className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <span className="font-medium">{item.action}</span>
                                </div>
                                <Badge variant="secondary">{item.count}</Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">Top Users</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-3">
                          <div className="space-y-3">
                            {userActivityCounts.slice(0, 5).map(item => (
                              <div key={item.user.id} className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <span className="font-medium">{item.user.name}</span>
                                </div>
                                <Badge variant="secondary">{item.count}</Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    
                    {isLoadingAuditLogs ? (
                      <div className="flex justify-center my-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : filteredAuditLogs.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-neutral-500">No audit logs found with the current filters.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAuditLogs.map((log: any) => (
                            <TableRow key={log.id}>
                              <TableCell className="whitespace-nowrap">
                                {log.timestamp ? 
                                  (() => {
                                    try {
                                      return format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')
                                    } catch (error) {
                                      return "Invalid date"
                                    }
                                  })() 
                                  : "No timestamp"}
                              </TableCell>
                              <TableCell>
                                {log.userName || `User ID: ${log.userId}`}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    log.action.includes('CREATE') ? 'default' :
                                    log.action.includes('UPDATE') ? 'secondary' :
                                    log.action.includes('DELETE') ? 'destructive' :
                                    log.action.includes('LOGIN') || log.action.includes('LOGOUT') ? 'outline' :
                                    'default'
                                  }
                                >
                                  {log.action}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <p className="max-w-md truncate">
                                  {typeof log.details === 'object' 
                                    ? JSON.stringify(log.details) 
                                    : log.details}
                                </p>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {/* KM Rates Tab */}
              {activeTab === "km-rates" && (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Kilometer Rates Management</CardTitle>
                        <CardDescription>
                          Manage kilometer rates for trip cost calculations.
                        </CardDescription>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsRecalculateDialogOpen(true)}
                        className="whitespace-nowrap"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Recalculate All Trip Costs
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoadingKmRates ? (
                      <div className="flex justify-center my-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : kmRates.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-neutral-500">No kilometer rates found.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead className="text-right">Rate Value (JD/km)</TableHead>
                            <TableHead>Effective From</TableHead>
                            <TableHead>Effective To</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {kmRates.map((rate: any) => {
                            let isCurrentRate = false;
                            try {
                              const now = new Date();
                              const effectiveFrom = new Date(rate.effectiveFrom);
                              const effectiveTo = rate.effectiveTo ? new Date(rate.effectiveTo) : null;
                              isCurrentRate = effectiveFrom <= now && (!effectiveTo || effectiveTo >= now);
                            } catch (error) {
                              console.error("Error parsing rate dates:", error);
                            }
                            
                            return (
                              <TableRow key={rate.id}>
                                <TableCell>{rate.id}</TableCell>
                                <TableCell className="text-right">
                                  <span className="font-medium">
                                    {rate.rateValue.toFixed(3)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    try {
                                      return format(new Date(rate.effectiveFrom), 'MMM d, yyyy')
                                    } catch (error) {
                                      return "Invalid date"
                                    }
                                  })()}
                                </TableCell>
                                <TableCell>
                                  {rate.effectiveTo ? (
                                    (() => {
                                      try {
                                        return format(new Date(rate.effectiveTo), 'MMM d, yyyy')
                                      } catch (error) {
                                        return "Invalid date"
                                      }
                                    })()
                                  ) : (
                                    <span className="text-neutral-400">No end date</span>
                                  )}
                                </TableCell>
                                <TableCell className="max-w-xs truncate">
                                  {rate.description || '-'}
                                  {isCurrentRate && (
                                    <Badge variant="default" className="ml-2">Current</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex space-x-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setEditingRate(rate);
                                        setIsAddRateModalOpen(true);
                                      }}
                                    >
                                      <Edit2 className="h-4 w-4 mr-1" />
                                      Edit
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-red-600 hover:text-red-700 border-red-200"
                                      onClick={() => {
                                        setDeletingRateId(rate.id);
                                        setIsDeleteRateDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 mr-1" />
                                      Delete
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        handleRecalculateTrips(rate.id);
                                      }}
                                    >
                                      <RefreshCw className="h-4 w-4 mr-1" />
                                      Recalc
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Sites Tab */}
              {activeTab === "sites" && (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Site Management</CardTitle>
                        <CardDescription>
                          Manage locations for trip origin and destination selection
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search sites..."
                            value={siteSearchTerm}
                            onChange={(e) => setSiteSearchTerm(e.target.value)}
                            className="pl-8 w-64"
                          />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoadingSites ? (
                      <div className="flex justify-center my-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : filteredSites.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-neutral-500">
                          {siteSearchTerm ? "No sites match your search." : "No sites found."}
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Abbreviation</TableHead>
                            <TableHead>English Name</TableHead>
                            <TableHead>City</TableHead>
                            <TableHead>Region</TableHead>
                            <TableHead>Site Type</TableHead>
                            <TableHead>GPS Coordinates</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSites.map((site: Site) => (
                            <TableRow key={site.id}>
                              <TableCell>{site.id}</TableCell>
                              <TableCell>
                                <span className="font-medium text-blue-600">
                                  {site.abbreviation}
                                </span>
                              </TableCell>
                              <TableCell>{site.englishName}</TableCell>
                              <TableCell>{site.city || "-"}</TableCell>
                              <TableCell>{site.region || "-"}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  site.siteType === "Hospital" 
                                    ? 'bg-red-100 text-red-800'
                                    : site.siteType === "Office"
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {site.siteType}
                                </span>
                              </TableCell>
                              <TableCell>
                                {site.gpsLat && site.gpsLng ? (
                                  <span className="text-xs text-gray-600">
                                    {Number(site.gpsLat).toFixed(4)}, {Number(site.gpsLng).toFixed(4)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">Not set</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  site.isActive 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {site.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditSite(site)}
                                  >
                                    <Edit2 className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteSite(site.id)}
                                    className="border-red-200 text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
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

              {/* Permission Summary Tab */}
              {activeTab === "permissions" && (
                <div className="space-y-6">
                  <PermissionSummaryPage />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Department/Project Dialog */}
      <Dialog 
        open={dialogOpen} 
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setCurrentDepartmentId(null);
          }
        }}
      >
        <ResizableDialogContent
          className="w-[700px] max-w-[90vw]"
        >
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
                          <span className="absolute left-2 top-2">JD</span>
                          <Input className="pl-8" type="number" step="0.01" min="0" {...field} />
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
                    <FormItem className="flex flex-col">
                      <FormLabel>Department Manager</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={(value) => field.onChange(value === "none" ? null : Number(value))}
                          value={field.value ? field.value.toString() : "none"}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a manager" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {users
                              .filter((user: any) => ["Manager", "Admin"].includes(user.role))
                              .map((user: any) => (
                                <SelectItem key={user.id} value={user.id.toString()}>
                                  {user.fullName}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={departmentForm.control}
                  name="secondManagerId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Secondary Manager (Optional)</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={(value) => field.onChange(value === "none" ? null : Number(value))}
                          value={field.value ? field.value.toString() : "none"}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a secondary manager" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {users
                              .filter((user: any) => ["Manager", "Admin"].includes(user.role))
                              .map((user: any) => (
                                <SelectItem key={user.id} value={user.id.toString()}>
                                  {user.fullName}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={departmentForm.control}
                  name="thirdManagerId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Third Manager (Optional)</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={(value) => field.onChange(value === "none" ? null : Number(value))}
                          value={field.value ? field.value.toString() : "none"}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a third manager" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {users
                              .filter((user: any) => ["Manager", "Admin"].includes(user.role))
                              .map((user: any) => (
                                <SelectItem key={user.id} value={user.id.toString()}>
                                  {user.fullName}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription>
                        The third manager is used for specialized approval situations
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={departmentForm.control}
                  name="parentDepartmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent Department (Optional)</FormLabel>
                      <Select 
                        value={field.value?.toString() || "none"}
                        onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a parent department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {departments?.filter((dept: any) => dept.isActive && (!selectedDepartment || dept.id !== selectedDepartment.id)).map((dept: any) => (
                            <SelectItem key={dept.id} value={dept.id.toString()}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The parent department establishes a hierarchical structure
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={departmentForm.control}
                  name="monthlyBudgetBonus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Budget Bonus</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-2 top-2">JD</span>
                          <Input className="pl-8" type="number" step="0.01" min="0" {...field} />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Temporary monthly budget increase that resets automatically every month. 
                        The system checks daily to reset bonuses that have reached their monthly expiration.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Add manual reset date selection */}
                <FormField
                  control={departmentForm.control}
                  name="monthlyBudgetBonusResetDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Bonus Reset Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a reset date</span>
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
                        The date when the monthly budget bonus will be reset to zero. 
                        If not specified, it will default to one month from today.
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
                          Active departments can be used in trip requests.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button type="submit">
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
                          <span className="absolute left-2 top-2">JD</span>
                          <Input className="pl-8" type="number" step="0.01" min="0" {...field} />
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
                      <FormLabel>Department</FormLabel>
                      <Select 
                        value={field.value?.toString() || "0"}
                        onValueChange={(value) => field.onChange(value === "0" ? undefined : parseInt(value))}
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={projectForm.control}
                  name="managerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Manager</FormLabel>
                      <Select 
                        value={field.value?.toString() || "0"}
                        onValueChange={(value) => field.onChange(value === "0" ? undefined : parseInt(value))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a project manager" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">Select a project manager</SelectItem>
                          {users?.filter((user: any) => ["Manager", "Admin"].includes(user.role)).map((user: any) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={projectForm.control}
                  name="secondManagerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Manager (Optional)</FormLabel>
                      <Select 
                        value={field.value?.toString() || "none"}
                        onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a secondary manager" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {users?.filter((user: any) => ["Manager", "Admin"].includes(user.role)).map((user: any) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={projectForm.control}
                  name="expiryDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Expiry Date (Optional)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
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
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        Projects with expired dates cannot be used for new trip requests.
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
                          Active projects can be used in trip requests.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button type="submit">
                    {isEditing ? "Update Project" : "Create Project"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </ResizableDialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
        <ResizableDialogContent className="w-[500px] max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>
              Add a new user to the system.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...userForm}>
            <form onSubmit={userForm.handleSubmit(handleCreateUser)} className="space-y-4">
              <FormField
                control={userForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter username" {...field} />
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
                      <Input placeholder="Enter full name" {...field} />
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
                      <Input placeholder="Enter email address" type="email" {...field} />
                    </FormControl>
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
                      <Input placeholder="Enter password" type="password" {...field} />
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
                    <FormControl>
                      <Input placeholder="Enter department" {...field} />
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
                      <Input placeholder="Enter company number" {...field} />
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
                      <Input placeholder="Enter home address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={userForm.control}
                name="homeLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Home Location (GPS)</FormLabel>
                    <FormControl>
                      <Input placeholder="31.9522,35.2332 (latitude,longitude)" {...field} />
                    </FormControl>
                    <FormDescription>
                      Optional GPS coordinates for home location in format: latitude,longitude
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={userForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <Combobox
                        options={[
                          { label: "Employee", value: "Employee" },
                          { label: "Manager", value: "Manager" },
                          { label: "Finance", value: "Finance" },
                          { label: "Admin", value: "Admin" }
                        ]}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select a role"
                        emptyMessage="No roles available"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={userForm.control}
                name="directManagerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Direct Manager</FormLabel>
                    <Select 
                      value={field.value || "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a manager" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {users?.filter((u: any) => ["Manager"].includes(u.role)).map((manager: any) => (
                          <SelectItem key={manager.id} value={manager.fullName}>
                            {manager.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Only users with Manager role can be selected as direct managers
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={userForm.control}
                name="directCostEntryPermission"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Direct Cost Entry Permission
                      </FormLabel>
                      <FormDescription>
                        Allow this user to directly enter trip costs instead of using the KM rates.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit">Create User</Button>
              </DialogFooter>
            </form>
          </Form>
        </ResizableDialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
        <ResizableDialogContent className="w-[500px] max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...userEditForm}>
            <form onSubmit={userEditForm.handleSubmit(handleEditUser)} className="space-y-4">
              <FormField
                control={userEditForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} />
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
                      <Input placeholder="Enter email address" type="email" {...field} />
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
                    <FormControl>
                      <Input placeholder="Enter department" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={userEditForm.control}
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
                control={userEditForm.control}
                name="companyNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter company number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={userEditForm.control}
                name="homeAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Home Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter home address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={userEditForm.control}
                name="homeLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Home Location (GPS)</FormLabel>
                    <FormControl>
                      <Input placeholder="31.9522,35.2332 (latitude,longitude)" {...field} />
                    </FormControl>
                    <FormDescription>
                      Optional GPS coordinates for home location in format: latitude,longitude
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={userEditForm.control}
                name="directManagerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Direct Manager</FormLabel>
                    <Select 
                      value={field.value || "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a manager" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {users?.filter((u: any) => ["Manager"].includes(u.role)).map((manager: any) => (
                          <SelectItem key={manager.id} value={manager.fullName}>
                            {manager.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Only users with Manager role can be selected as direct managers
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={userEditForm.control}
                name="directCostEntryPermission"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Direct Cost Entry Permission
                      </FormLabel>
                      <FormDescription>
                        Allow this user to directly enter trip costs instead of using the KM rates.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit">Update User</Button>
              </DialogFooter>
            </form>
          </Form>
        </ResizableDialogContent>
      </Dialog>



      {/* Project Documents Dialog */}
      <Dialog open={projectDetailDialogOpen} onOpenChange={setProjectDetailDialogOpen}>
        <ResizableDialogContent className="w-[800px] max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>Project Documents</DialogTitle>
            <DialogDescription>
              View and manage documents for {selectedProject?.name || "selected project"}.
            </DialogDescription>
          </DialogHeader>
          
          {selectedProject && (
            <ProjectDocuments projectId={selectedProject.id} />
          )}
        </ResizableDialogContent>
      </Dialog>

      {/* Add/Edit KM Rate Dialog */}
      <Dialog open={isAddRateModalOpen} onOpenChange={setIsAddRateModalOpen}>
        <ResizableDialogContent className="w-[500px] max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>{editingRate ? "Edit Rate" : "Add New KM Rate"}</DialogTitle>
            <DialogDescription>
              {editingRate 
                ? "Update the rate value and effective dates."
                : "Define a new kilometer rate with its effective date range."
              }
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAddOrEditKmRate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Rate Value (JD/km)</label>
              <Input 
                name="rateValue" 
                type="number" 
                step="0.001" 
                min="0"
                required
                placeholder="0.150"
                defaultValue={editingRate?.rateValue || ""}
              />
              <p className="text-xs text-gray-500">Amount in Jordanian Dinar per kilometer.</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Effective From</label>
              <Input 
                name="effectiveFrom" 
                type="date" 
                required
                defaultValue={editingRate?.effectiveFrom 
                  ? new Date(editingRate.effectiveFrom).toISOString().split('T')[0]
                  : new Date().toISOString().split('T')[0]
                }
              />
              <p className="text-xs text-gray-500">Date when this rate becomes effective.</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Effective To (Optional)</label>
              <Input 
                name="effectiveTo" 
                type="date"
                defaultValue={editingRate?.effectiveTo 
                  ? new Date(editingRate.effectiveTo).toISOString().split('T')[0]
                  : ""
                }
              />
              <p className="text-xs text-gray-500">Leave blank if this rate has no end date.</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (Optional)</label>
              <Textarea 
                name="description" 
                placeholder="Enter additional information about this rate..."
                defaultValue={editingRate?.description || ""}
              />
            </div>
            
            <DialogFooter>
              <Button type="submit">
                {editingRate ? "Update Rate" : "Add Rate"}
              </Button>
            </DialogFooter>
          </form>
        </ResizableDialogContent>
      </Dialog>

      {/* Delete KM Rate Confirmation Dialog */}
      <Dialog open={isDeleteRateDialogOpen} onOpenChange={setIsDeleteRateDialogOpen}>
        <ResizableDialogContent className="w-[450px] max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>Delete KM Rate</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this kilometer rate? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-red-500">
              Warning: Deleting this rate may affect trip costs calculated using this rate.
            </p>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteRateDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteKmRate}>
                Delete Rate
              </Button>
            </DialogFooter>
          </div>
        </ResizableDialogContent>
      </Dialog>

      {/* Recalculate Trips Confirmation Dialog */}
      <Dialog open={isRecalculateDialogOpen} onOpenChange={setIsRecalculateDialogOpen}>
        <ResizableDialogContent className="w-[450px] max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>Recalculate Trip Costs</DialogTitle>
            <DialogDescription>
              This will recalculate costs for all trips based on their kilometer values and rates.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm">
              This operation will update the cost of all trip requests that have their cost calculated from kilometers. This helps ensure consistency when rates change.
            </p>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRecalculateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => handleRecalculateTrips()}>
                Recalculate All Trips
              </Button>
            </DialogFooter>
          </div>
        </ResizableDialogContent>
      </Dialog>

      {/* Create Site Dialog */}
      <Dialog open={isCreateSiteDialogOpen} onOpenChange={setIsCreateSiteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Site</DialogTitle>
            <DialogDescription>
              Add a new location that can be selected for trip requests.
            </DialogDescription>
          </DialogHeader>
          <Form {...createSiteForm}>
            <form onSubmit={createSiteForm.handleSubmit(handleCreateSite)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createSiteForm.control}
                  name="abbreviation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site Abbreviation *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., AMN-H" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createSiteForm.control}
                  name="englishName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>English Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Amman Hospital" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createSiteForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Amman" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createSiteForm.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Central" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createSiteForm.control}
                name="siteType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select site type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Hospital">Hospital</SelectItem>
                        <SelectItem value="Office">Office</SelectItem>
                        <SelectItem value="Warehouse">Warehouse</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createSiteForm.control}
                  name="gpsLat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GPS Latitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="e.g., 31.9539"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createSiteForm.control}
                  name="gpsLng"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GPS Longitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="e.g., 35.9106"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createSiteForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <FormDescription>
                        Enable this site for trip selection
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateSiteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createSiteMutation.isPending}>
                  {createSiteMutation.isPending ? "Creating..." : "Create Site"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Site Dialog */}
      <Dialog open={!!editingSite} onOpenChange={() => setEditingSite(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
            <DialogDescription>
              Update the site information.
            </DialogDescription>
          </DialogHeader>
          <Form {...editSiteForm}>
            <form onSubmit={editSiteForm.handleSubmit(handleUpdateSite)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editSiteForm.control}
                  name="abbreviation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site Abbreviation *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., AMN-H" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editSiteForm.control}
                  name="englishName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>English Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Amman Hospital" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editSiteForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Amman" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editSiteForm.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Central" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editSiteForm.control}
                name="siteType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select site type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Hospital">Hospital</SelectItem>
                        <SelectItem value="Office">Office</SelectItem>
                        <SelectItem value="Warehouse">Warehouse</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editSiteForm.control}
                  name="gpsLat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GPS Latitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="e.g., 31.9539"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editSiteForm.control}
                  name="gpsLng"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GPS Longitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="e.g., 35.9106"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editSiteForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <FormDescription>
                        Enable this site for trip selection
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingSite(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateSiteMutation.isPending}>
                  {updateSiteMutation.isPending ? "Updating..." : "Update Site"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}