import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Car, ClipboardList, ChevronLeft, ChevronRight, Calendar, User, Building2, MapPin, Download, FileSpreadsheet, Eye, Clock, DollarSign, FileText, Activity, AlertCircle, CheckCircle, Briefcase, ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import type { Department } from "@shared/schema";
import RequestTable from "@/components/dashboard/request-table";

export default function AllRequestsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("trips");
  
  // Trip Requests State
  const [tripEmployeeSearch, setTripEmployeeSearch] = useState("");
  const [tripDepartmentFilter, setTripDepartmentFilter] = useState("all");
  const [tripTypeFilter, setTripTypeFilter] = useState("all");
  const [tripStatusFilter, setTripStatusFilter] = useState("all");
  const [tripDateRange, setTripDateRange] = useState({ from: "", to: "" });
  const [tripSortBy, setTripSortBy] = useState("id");
  const [tripSortOrder, setTripSortOrder] = useState<"asc" | "desc">("desc");
  const [tripCurrentPage, setTripCurrentPage] = useState(1);
  const [tripItemsPerPage, setTripItemsPerPage] = useState(25);
  const [forceRerender, setForceRerender] = useState(0);
  const [tableKey, setTableKey] = useState(0);

  // Force table re-render when sorting changes
  useEffect(() => {
    setTableKey(prev => prev + 1);
  }, [tripSortBy, tripSortOrder]);

  // Admin Requests State
  const [adminEmployeeSearch, setAdminEmployeeSearch] = useState("");
  const [adminDepartmentFilter, setAdminDepartmentFilter] = useState("all");
  const [adminRequestTypeFilter, setAdminRequestTypeFilter] = useState("all");
  const [adminStatusFilter, setAdminStatusFilter] = useState("all");
  const [adminDateRange, setAdminDateRange] = useState({ from: "", to: "" });
  const [adminSortBy, setAdminSortBy] = useState("date");
  const [adminSortOrder, setAdminSortOrder] = useState<"asc" | "desc">("desc");
  const [adminCurrentPage, setAdminCurrentPage] = useState(1);
  const [adminItemsPerPage, setAdminItemsPerPage] = useState(25);

  // ENHANCED TRIP REQUEST DETAILS DIALOG - FUTURE MODIFICATIONS
  // Enhanced dialog state for trip request details
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);

  // Fetch detailed trip data with JOINs when dialog opens
  const { data: detailedTripData, isLoading: isLoadingDetail } = useQuery({
    queryKey: [`/api/trip-requests/${selectedTripId}`, selectedTripId],
    enabled: !!selectedTripId && isDialogOpen,
    staleTime: 0, // Always fetch fresh data for dialog
  });

  // Handler to open enhanced dialog with trip details
  const handleRowClick = (request: any) => {
    console.log('Opening enhanced dialog for request:', request);
    console.log('Request department info:', {
      departmentName: request.departmentName,
      userDepartment: request.userDepartment,
      department: request.department
    });
    setSelectedTripId(request.id);
    setSelectedRequest(request);
    setIsDialogOpen(true);
    
    // Refetch workflow steps to ensure current approval status
    setTimeout(() => {
      refetchWorkflow();
    }, 100);
  };

  // Column sorting handler for trip requests
  const handleTripSort = (column: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    console.log('Sorting by column:', column, 'Current sort:', tripSortBy, tripSortOrder);
    
    if (tripSortBy === column) {
      setTripSortOrder(tripSortOrder === "asc" ? "desc" : "asc");
    } else {
      setTripSortBy(column);
      setTripSortOrder("asc");
    }
    setTripCurrentPage(1); // Reset to first page when sorting
    setForceRerender(prev => prev + 1); // Force table re-render
  };

  // Get sort icon for column headers
  const getSortIcon = (column: string, sortBy: string, sortOrder: "asc" | "desc") => {
    if (sortBy === column) {
      return sortOrder === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
    }
    return <ArrowUpDown className="h-4 w-4 opacity-50" />;
  };

  // Fetch data with proper pagination
  const { data: tripRequestData, isLoading: isLoadingTrips, refetch: refetchTrips } = useQuery({
    queryKey: ["/api/trip-requests", { limit: 150 }], // Fetch more than 110 to get all trips
    queryFn: async () => {
      const response = await fetch('/api/trip-requests?limit=150');
      if (!response.ok) throw new Error('Failed to fetch trips');
      return response.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
  
  const { data: adminRequests = [], isLoading: isLoadingAdmin, refetch: refetchAdmin } = useQuery({
    queryKey: ["/api/admin-requests"],
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
  
  const { data: departments = [], isLoading: isLoadingDepartments } = useQuery({
    queryKey: ["/api/departments"],
  });

  // User data is already included in trip responses via database JOIN
  // No need for separate user API call

  const { data: sites = [], isLoading: isLoadingSites } = useQuery({
    queryKey: ["/api/sites"],
  });

  const { data: systemSettings = [], isLoading: isLoadingSettings } = useQuery({
    queryKey: ["/api/system-settings"],
  });

  const { data: kmRates = [], isLoading: isLoadingKmRates } = useQuery({
    queryKey: ["/api/km-rates"],
  });

  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ["/api/projects"],
  });

  // Fetch workflow steps for the selected request
  const { data: workflowSteps = [], isLoading: isLoadingWorkflow, refetch: refetchWorkflow } = useQuery({
    queryKey: [`/api/trip-requests/${selectedRequest?.id}/workflow`],
    enabled: !!selectedRequest?.id,
    staleTime: 0,
  });

  const tripRequests = Array.isArray(tripRequestData?.trips) ? tripRequestData.trips : [];
  const departmentsArray = Array.isArray(departments) ? departments : [];
  const adminRequestsArray = Array.isArray(adminRequests) ? adminRequests : [];
  const sitesArray = Array.isArray(sites) ? sites : [];
  const kmRatesArray = Array.isArray(kmRates) ? kmRates : [];

  // Helper functions for displaying authentic data
  const getUserInfo = (trip: any) => {
    // User data is already included in trip response via database JOIN
    return {
      fullName: trip.fullName || 'Unknown User',
      companyNumber: trip.companyNumber || 'N/A',
      department: trip.departmentName || trip.userDepartment || trip.department || 'Unknown'
    };
  };

  const getSiteInfo = (abbreviation: string) => {
    const site = sitesArray.find((s: any) => s.abbreviation === abbreviation);
    return site ? {
      abbreviation: site.abbreviation,
      englishName: site.englishName || 'Unknown Site',
      city: site.city || 'Unknown City',
      fullDisplay: `${site.abbreviation} - ${site.englishName}, ${site.city || 'Unknown City'}`
    } : { 
      abbreviation: abbreviation, 
      englishName: 'Unknown Site', 
      city: 'Unknown City',
      fullDisplay: `${abbreviation} - Unknown Site, Unknown City`
    };
  };

  const getCurrentKmRate = () => {
    if (kmRatesArray.length === 0) return null;
    // Get the most recent rate
    const sortedRates = kmRatesArray.sort((a: any, b: any) => 
      new Date(b.effectiveFrom || 0).getTime() - new Date(a.effectiveFrom || 0).getTime()
    );
    return sortedRates[0];
  };

  const getApproverName = (username: string) => {
    // For approval workflow, we can display the username directly
    // In future, approver names could be included in workflow response if needed
    return username || 'System';
  };

  const getProjectInfo = (projectId: number | null) => {
    if (!projectId) return null;
    const project = Array.isArray(projects) ? projects.find((p: any) => p.id === projectId) : null;
    return project ? {
      name: project.name,
      budget: project.budget,
      managerId: project.managerId,
      secondManagerId: project.secondManagerId,
      managerName: getUserInfo(project.managerId).fullName,
      secondManagerName: project.secondManagerId ? getUserInfo(project.secondManagerId).fullName : null
    } : null;
  };

  const getDepartmentInfo = (departmentId: number | null) => {
    if (!departmentId) return null;
    const department = departmentsArray.find((d: any) => d.id === departmentId);
    return department ? {
      name: department.name,
      managerId: department.managerId,
      secondManagerId: department.secondManagerId,
      thirdManagerId: department.thirdManagerId,
      managerName: department.managerId ? getUserInfo(department.managerId).fullName : 'Not assigned',
      secondManagerName: department.secondManagerId ? getUserInfo(department.secondManagerId).fullName : null,
      thirdManagerName: department.thirdManagerId ? getUserInfo(department.thirdManagerId).fullName : null
    } : null;
  };

  // Database-first workflow display - replaced hardcoded logic
  const getApprovalWorkflow = (request: any) => {
    // This function is now deprecated in favor of database workflow steps
    // Return empty array to force usage of database workflow
    return [];
  };

  // Role-based filtering
  const filterRequestsByRole = (requests: any[], type: 'trip' | 'admin') => {
    // Database-first approach: Trust the backend permission system
    // The backend already applies proper permissions, so return all requests as-is
    return Array.isArray(requests) ? requests : [];
  };

  const filteredTripRequests = useMemo(() => {
    let filtered = filterRequestsByRole(tripRequests, 'trip');
    
    // Apply filters
    if (tripEmployeeSearch) {
      filtered = filtered.filter((req: any) => {
        // User data is already included in trip response via database JOIN
        const userName = req.fullName || '';
        return userName.toLowerCase().includes(tripEmployeeSearch.toLowerCase());
      });
    }
    
    if (tripDepartmentFilter !== "all") {
      filtered = filtered.filter((req: any) => {
        const dept = departmentsArray.find((d: any) => d.id === req.departmentId);
        return dept?.name === tripDepartmentFilter;
      });
    }
    
    if (tripTypeFilter !== "all") {
      filtered = filtered.filter((req: any) => req.tripType === tripTypeFilter);
    }
    
    if (tripStatusFilter !== "all") {
      if (tripStatusFilter === 'Pending') {
        filtered = filtered.filter((req: any) => req.status.includes('Pending'));
      } else {
        filtered = filtered.filter((req: any) => req.status === tripStatusFilter);
      }
    }
    
    if (tripDateRange.from) {
      filtered = filtered.filter((req: any) => {
        if (!req.tripDate) return false;
        const tripDate = new Date(req.tripDate);
        const fromDate = new Date(tripDateRange.from);
        return tripDate >= fromDate;
      });
    }
    
    if (tripDateRange.to) {
      filtered = filtered.filter((req: any) => {
        if (!req.tripDate) return false;
        const tripDate = new Date(req.tripDate);
        const toDate = new Date(tripDateRange.to);
        // Set to end of day to include the full to date
        toDate.setHours(23, 59, 59, 999);
        return tripDate <= toDate;
      });
    }
    
    // Sort
    filtered.sort((a: any, b: any) => {
      let aVal, bVal;
      switch (tripSortBy) {
        case 'id':
          aVal = a.id;
          bVal = b.id;
          break;
        case 'employee':
          // User data is already included in trip response via database JOIN
          aVal = a.fullName || '';
          bVal = b.fullName || '';
          return tripSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'department':
          const deptA = departmentsArray.find((d: any) => d.id === a.departmentId);
          const deptB = departmentsArray.find((d: any) => d.id === b.departmentId);
          aVal = deptA?.name || '';
          bVal = deptB?.name || '';
          return tripSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'origin':
          aVal = a.origin || '';
          bVal = b.origin || '';
          return tripSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'destination':
          aVal = a.destination || '';
          bVal = b.destination || '';
          return tripSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'tripDate':
          aVal = new Date(a.tripDate).getTime();
          bVal = new Date(b.tripDate).getTime();
          break;
        case 'type':
          aVal = a.tripType || '';
          bVal = b.tripType || '';
          return tripSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'cost':
          aVal = a.cost;
          bVal = b.cost;
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          return tripSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        default:
          aVal = a.id;
          bVal = b.id;
      }
      return tripSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    return filtered;
  }, [tripRequests, departmentsArray, tripEmployeeSearch, tripDepartmentFilter, tripTypeFilter, tripStatusFilter, tripDateRange, tripSortBy, tripSortOrder, forceRerender]);

  const filteredAdminRequests = useMemo(() => {
    let filtered = filterRequestsByRole(adminRequestsArray, 'admin');
    
    // Apply filters
    if (adminEmployeeSearch) {
      // Filter by user ID since we don't have user names in admin requests
      filtered = filtered.filter((req: any) => {
        return req.userId.toString().includes(adminEmployeeSearch.toLowerCase());
      });
    }
    
    if (adminDepartmentFilter !== "all") {
      filtered = filtered.filter((req: any) => req.department === adminDepartmentFilter);
    }
    
    if (adminRequestTypeFilter !== "all") {
      filtered = filtered.filter((req: any) => req.requestType === adminRequestTypeFilter);
    }
    
    if (adminStatusFilter !== "all") {
      if (adminStatusFilter === 'Pending') {
        filtered = filtered.filter((req: any) => req.status.includes('Pending'));
      } else {
        filtered = filtered.filter((req: any) => req.status === adminStatusFilter);
      }
    }
    
    if (adminDateRange.from) {
      filtered = filtered.filter((req: any) => new Date(req.createdAt) >= new Date(adminDateRange.from));
    }
    
    if (adminDateRange.to) {
      filtered = filtered.filter((req: any) => new Date(req.createdAt) <= new Date(adminDateRange.to));
    }
    
    // Sort
    filtered.sort((a: any, b: any) => {
      let aVal, bVal;
      switch (adminSortBy) {
        case 'date':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case 'amount':
          aVal = a.requestedAmount || 0;
          bVal = b.requestedAmount || 0;
          break;
        default:
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
      }
      return adminSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    return filtered;
  }, [adminRequests, departments, adminEmployeeSearch, adminDepartmentFilter, adminRequestTypeFilter, adminStatusFilter, adminDateRange, adminSortBy, adminSortOrder, user]);

  // Pagination
  const paginatedTripRequests = useMemo(() => {
    const startIndex = (tripCurrentPage - 1) * tripItemsPerPage;
    return filteredTripRequests.slice(startIndex, startIndex + tripItemsPerPage);
  }, [filteredTripRequests, tripCurrentPage, tripItemsPerPage, forceRerender]);

  const paginatedAdminRequests = useMemo(() => {
    const startIndex = (adminCurrentPage - 1) * adminItemsPerPage;
    return filteredAdminRequests.slice(startIndex, startIndex + adminItemsPerPage);
  }, [filteredAdminRequests, adminCurrentPage, adminItemsPerPage]);

  const tripTotalPages = Math.ceil(filteredTripRequests.length / tripItemsPerPage);
  const adminTotalPages = Math.ceil(filteredAdminRequests.length / adminItemsPerPage);

  const getStatusBadge = (status: string) => {
    if (status === 'Approved') return <Badge variant="default" className="bg-green-100 text-green-800">{status}</Badge>;
    if (status === 'Rejected') return <Badge variant="destructive">{status}</Badge>;
    if (status === 'Paid') return <Badge variant="default" className="bg-blue-100 text-blue-800">{status}</Badge>;
    if (status.includes('Pending')) return <Badge variant="secondary">{status}</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const getUserName = (userId: number) => {
    // For admin requests, we'll display the userId directly since user data isn't joined
    return `User ${userId}`;
  };

  const getDepartmentName = (departmentId: number) => {
    const dept = departmentsArray.find((d: any) => d.id === departmentId);
    return dept?.name || 'Unknown';
  };

  const isLoading = isLoadingTrips || isLoadingAdmin || isLoadingDepartments || isLoadingSites;

  // Excel Export Functions
  const exportToExcel = (data: any[], filename: string, type: 'trip' | 'admin') => {
    const csvContent = generateCSV(data, type);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateCSV = (data: any[], type: 'trip' | 'admin') => {
    if (type === 'trip') {
      const headers = [
        'Request ID',
        'Employee Name',
        'Company Number',
        'Department',
        'Origin',
        'Destination',
        'Trip Date',
        'Trip Type',
        'Cost (JD)',
        'Status',
        'Created Date',
        'Purpose',
        'Project Name',
        'Distance (KM)',
        'Notes'
      ];

      const rows = data.map((trip: any) => {
        const dept = departmentsArray.find((d: any) => d.id === trip.departmentId);
        return [
          trip.id,
          trip.fullName || 'Unknown',
          trip.companyNumber || '',
          trip.departmentName || trip.userDepartment || trip.department || 'Unknown',
          trip.origin || '',
          trip.destination || '',
          format(new Date(trip.tripDate), 'yyyy-MM-dd'),
          trip.tripType || '',
          trip.cost?.toFixed(2) || '0.00',
          trip.status || '',
          format(new Date(trip.createdAt), 'yyyy-MM-dd HH:mm'),
          trip.purpose || '',
          trip.projectName || '',
          trip.distance || '',
          trip.notes || ''
        ];
      });

      return [headers, ...rows].map(row => 
        row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
      ).join('\n');
    } else {
      const headers = [
        'Request ID',
        'Employee Name',
        'Company Number',
        'Department',
        'Subject',
        'Request Type',
        'Description',
        'Requested Amount (JD)',
        'Status',
        'Created Date',
        'Admin Comments'
      ];

      const rows = data.map((request: any) => {
        return [
          request.id,
          `User ${request.userId}`,
          '',
          request.department || '',
          request.subject || '',
          request.requestType?.replace('-', ' ') || '',
          request.description || '',
          request.requestedAmount?.toFixed(2) || '0.00',
          request.status || '',
          format(new Date(request.createdAt), 'yyyy-MM-dd HH:mm'),
          request.adminComments || ''
        ];
      });

      return [headers, ...rows].map(row => 
        row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
      ).join('\n');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Styled Tabs at Top */}
        <div className="bg-white rounded-lg shadow-sm border">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b border-gray-200 px-6 pt-4">
              <TabsList className="grid w-full max-w-lg grid-cols-2 bg-gray-100 p-1 rounded-lg">
                <TabsTrigger 
                  value="trips" 
                  className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
                >
                  <Car className="h-4 w-4" />
                  Trip Requests ({filteredTripRequests.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="admin" 
                  className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
                >
                  <ClipboardList className="h-4 w-4" />
                  Administrative Requests ({filteredAdminRequests.length})
                </TabsTrigger>
              </TabsList>
            </div>

          <TabsContent value="trips" className="space-y-6">
            {/* Trip Requests Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <span>Filters:</span>
                    </div>
                    
                    <Input
                      placeholder="Search employee..."
                      value={tripEmployeeSearch}
                      onChange={(e) => setTripEmployeeSearch(e.target.value)}
                      className="w-40 h-8"
                    />
                    
                    <Select value={tripDepartmentFilter} onValueChange={setTripDepartmentFilter}>
                      <SelectTrigger className="w-36 h-8">
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Depts</SelectItem>
                        {Array.isArray(departments) && departments.map((dept: any) => (
                          <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select value={tripTypeFilter} onValueChange={setTripTypeFilter}>
                      <SelectTrigger className="w-28 h-8">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="Ticket">Ticket</SelectItem>
                        <SelectItem value="Planned">Planned</SelectItem>
                        <SelectItem value="Urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={tripStatusFilter} onValueChange={setTripStatusFilter}>
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                        <SelectItem value="Paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <div className="flex items-center gap-1">
                      <Input
                        type="date"
                        value={tripDateRange.from}
                        onChange={(e) => setTripDateRange({ ...tripDateRange, from: e.target.value })}
                        className="w-36 h-8"
                        title="Date From"
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input
                        type="date"
                        value={tripDateRange.to}
                        onChange={(e) => setTripDateRange({ ...tripDateRange, to: e.target.value })}
                        className="w-36 h-8"
                        title="Date To"
                      />
                    </div>
                    
                    <Select value={`${tripSortBy}-${tripSortOrder}`} onValueChange={(value) => {
                      const [field, order] = value.split('-');
                      setTripSortBy(field);
                      setTripSortOrder(order as "asc" | "desc");
                    }}>
                      <SelectTrigger className="w-44 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date-desc">Trip Date (New→Old)</SelectItem>
                        <SelectItem value="date-asc">Trip Date (Old→New)</SelectItem>
                        <SelectItem value="createdAt-desc">Created (New→Old)</SelectItem>
                        <SelectItem value="createdAt-asc">Created (Old→New)</SelectItem>
                        <SelectItem value="cost-desc">Cost (High→Low)</SelectItem>
                        <SelectItem value="cost-asc">Cost (Low→High)</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={tripItemsPerPage.toString()} onValueChange={(value) => setTripItemsPerPage(Number(value))}>
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="150">150</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Export Button for Trip Requests */}
                  <Button
                    onClick={() => exportToExcel(filteredTripRequests, 'trip_requests', 'trip')}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                  >
                    <Download className="h-4 w-4" />
                    Export Excel
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Trip Requests Table */}
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="text-muted-foreground">Loading...</div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-gray-800 to-gray-900 text-white">
                        <tr>
                          <th className="text-left p-4 font-semibold text-sm">
                            <button 
                              className="flex items-center gap-2 hover:text-blue-200 transition-colors"
                              onClick={(e) => handleTripSort('id', e)}
                            >
                              <span>#</span>
                              {getSortIcon('id', tripSortBy, tripSortOrder)}
                            </button>
                          </th>
                          <th className="text-left p-4 font-semibold text-sm">
                            <button 
                              className="flex items-center gap-2 hover:text-blue-200 transition-colors"
                              onClick={(e) => handleTripSort('employee', e)}
                            >
                              <User className="h-4 w-4" />
                              <span>Employee</span>
                              {getSortIcon('employee', tripSortBy, tripSortOrder)}
                            </button>
                          </th>
                          <th className="text-left p-4 font-semibold text-sm">
                            <button 
                              className="flex items-center gap-2 hover:text-blue-200 transition-colors"
                              onClick={(e) => handleTripSort('department', e)}
                            >
                              <Building2 className="h-4 w-4" />
                              <span>Department</span>
                              {getSortIcon('department', tripSortBy, tripSortOrder)}
                            </button>
                          </th>
                          <th className="text-left p-4 font-semibold text-sm">
                            <button 
                              className="flex items-center gap-2 hover:text-blue-200 transition-colors"
                              onClick={(e) => handleTripSort('origin', e)}
                            >
                              <MapPin className="h-4 w-4" />
                              <span>Origin</span>
                              {getSortIcon('origin', tripSortBy, tripSortOrder)}
                            </button>
                          </th>
                          <th className="text-left p-4 font-semibold text-sm">
                            <button 
                              className="flex items-center gap-2 hover:text-blue-200 transition-colors"
                              onClick={(e) => handleTripSort('destination', e)}
                            >
                              <MapPin className="h-4 w-4" />
                              <span>Destination</span>
                              {getSortIcon('destination', tripSortBy, tripSortOrder)}
                            </button>
                          </th>
                          <th className="text-left p-4 font-semibold text-sm">
                            <button 
                              className="flex items-center gap-2 hover:text-blue-200 transition-colors"
                              onClick={(e) => handleTripSort('tripDate', e)}
                            >
                              <Calendar className="h-4 w-4" />
                              <span>Trip Date</span>
                              {getSortIcon('tripDate', tripSortBy, tripSortOrder)}
                            </button>
                          </th>
                          <th className="text-left p-4 font-semibold text-sm">
                            <button 
                              className="flex items-center gap-2 hover:text-blue-200 transition-colors"
                              onClick={(e) => handleTripSort('type', e)}
                            >
                              <span>Type</span>
                              {getSortIcon('type', tripSortBy, tripSortOrder)}
                            </button>
                          </th>
                          <th className="text-left p-4 font-semibold text-sm">
                            <button 
                              className="flex items-center gap-2 hover:text-blue-200 transition-colors"
                              onClick={(e) => handleTripSort('cost', e)}
                            >
                              <span>Cost (JD)</span>
                              {getSortIcon('cost', tripSortBy, tripSortOrder)}
                            </button>
                          </th>
                          <th className="text-left p-4 font-semibold text-sm">
                            <button 
                              className="flex items-center gap-2 hover:text-blue-200 transition-colors"
                              onClick={(e) => handleTripSort('status', e)}
                            >
                              <span>Trip Status</span>
                              {getSortIcon('status', tripSortBy, tripSortOrder)}
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody key={`${tripSortBy}-${tripSortOrder}-${tripCurrentPage}-${forceRerender}`}>
                        {paginatedTripRequests.map((trip: any) => (
                              <tr key={trip.id} className="border-b hover:bg-blue-50 cursor-pointer transition-colors"
                                  onClick={() => handleRowClick(trip)}>
                                <td className="p-4 font-medium">#{trip.id}</td>
                                <td className="p-4">{getUserInfo(trip).fullName}</td>
                                <td className="p-4">{trip.departmentName || trip.userDepartment || trip.department || 'Unknown'}</td>
                                <td className="p-4">{trip.origin || '-'}</td>
                                <td className="p-4">{trip.destination}</td>
                                <td className="p-4">{format(new Date(trip.tripDate), 'MMM dd, yyyy')}</td>
                                <td className="p-4">
                                  <Badge variant={trip.tripType === 'Urgent' ? 'destructive' : 'default'}>
                                    {trip.tripType}
                                  </Badge>
                                </td>
                                <td className="p-4 font-medium">{trip.cost.toFixed(2)}</td>
                                <td className="p-4">{getStatusBadge(trip.status)}</td>
                              </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Trip Requests Pagination */}
            {tripTotalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {((tripCurrentPage - 1) * tripItemsPerPage) + 1} to {Math.min(tripCurrentPage * tripItemsPerPage, filteredTripRequests.length)} of {filteredTripRequests.length} trips
                </p>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTripCurrentPage(Math.max(1, tripCurrentPage - 1))}
                    disabled={tripCurrentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <span className="text-sm">
                    Page {tripCurrentPage} of {tripTotalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTripCurrentPage(Math.min(tripTotalPages, tripCurrentPage + 1))}
                    disabled={tripCurrentPage === tripTotalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="admin" className="space-y-6">
            {/* Admin Requests Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <span>Filters:</span>
                    </div>
                    
                    <Input
                      placeholder="Search employee..."
                      value={adminEmployeeSearch}
                      onChange={(e) => setAdminEmployeeSearch(e.target.value)}
                      className="w-40 h-8"
                    />
                    
                    <Select value={adminDepartmentFilter} onValueChange={setAdminDepartmentFilter}>
                      <SelectTrigger className="w-36 h-8">
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Depts</SelectItem>
                        {Array.isArray(departments) && departments.map((dept: any) => (
                          <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select value={adminRequestTypeFilter} onValueChange={setAdminRequestTypeFilter}>
                      <SelectTrigger className="w-36 h-8">
                        <SelectValue placeholder="Request Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="budget-increase">Budget Increase</SelectItem>
                        <SelectItem value="special-approval">Special Approval</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={adminStatusFilter} onValueChange={setAdminStatusFilter}>
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <div className="flex items-center gap-1">
                      <Input
                        type="date"
                        value={adminDateRange.from}
                        onChange={(e) => setAdminDateRange({ ...adminDateRange, from: e.target.value })}
                        className="w-36 h-8"
                        title="Date From"
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input
                        type="date"
                        value={adminDateRange.to}
                        onChange={(e) => setAdminDateRange({ ...adminDateRange, to: e.target.value })}
                        className="w-36 h-8"
                        title="Date To"
                      />
                    </div>
                    
                    <Select value={`${adminSortBy}-${adminSortOrder}`} onValueChange={(value) => {
                      const [field, order] = value.split('-');
                      setAdminSortBy(field);
                      setAdminSortOrder(order as "asc" | "desc");
                    }}>
                      <SelectTrigger className="w-44 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date-desc">Created (New→Old)</SelectItem>
                        <SelectItem value="date-asc">Created (Old→New)</SelectItem>
                        <SelectItem value="amount-desc">Amount (High→Low)</SelectItem>
                        <SelectItem value="amount-asc">Amount (Low→High)</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={adminItemsPerPage.toString()} onValueChange={(value) => setAdminItemsPerPage(Number(value))}>
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Export Button for Admin Requests */}
                  <Button
                    onClick={() => exportToExcel(filteredAdminRequests, 'admin_requests', 'admin')}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                  >
                    <Download className="h-4 w-4" />
                    Export Excel
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Admin Requests Table */}
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="text-muted-foreground">Loading...</div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-gray-800 to-gray-900 text-white">
                        <tr>
                          <th className="text-left p-4 font-semibold text-sm">
                            <div className="flex items-center gap-2">
                              <span>#</span>
                            </div>
                          </th>
                          <th className="text-left p-4 font-semibold text-sm">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span>Employee</span>
                            </div>
                          </th>
                          <th className="text-left p-4 font-semibold text-sm">Subject</th>
                          <th className="text-left p-4 font-semibold text-sm">Request Type</th>
                          <th className="text-left p-4 font-semibold text-sm">Amount (JD)</th>
                          <th className="text-left p-4 font-semibold text-sm">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>Created</span>
                            </div>
                          </th>
                          <th className="text-left p-4 font-semibold text-sm">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedAdminRequests.map((request: any) => (
                              <tr key={request.id} className="border-b hover:bg-purple-50 cursor-pointer transition-colors">
                                <td className="p-4 font-medium">#{request.id}</td>
                                <td className="p-4">{request.fullName || getUserInfo(request).fullName}</td>
                                <td className="p-4">{request.subject}</td>
                                <td className="p-4">
                                  <Badge variant="outline">
                                    {request.requestType?.replace('-', ' ') || 'Other'}
                                  </Badge>
                                </td>
                                <td className="p-4 font-medium">{request.requestedAmount?.toFixed(2) || '0.00'}</td>
                                <td className="p-4">{format(new Date(request.createdAt), 'MMM dd, yyyy')}</td>
                                <td className="p-4">{getStatusBadge(request.status)}</td>
                              </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Admin Requests Pagination */}
            {adminTotalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {((adminCurrentPage - 1) * adminItemsPerPage) + 1} to {Math.min(adminCurrentPage * adminItemsPerPage, filteredAdminRequests.length)} of {filteredAdminRequests.length} requests
                </p>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAdminCurrentPage(Math.max(1, adminCurrentPage - 1))}
                    disabled={adminCurrentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <span className="text-sm">
                    Page {adminCurrentPage} of {adminTotalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAdminCurrentPage(Math.min(adminTotalPages, adminCurrentPage + 1))}
                    disabled={adminCurrentPage === adminTotalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ENHANCED TRIP REQUEST DETAILS DIALOG - FUTURE MODIFICATIONS */}
      {/* Enhanced dialog for displaying comprehensive trip request details */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto bg-white">
          <DialogHeader className="sticky top-0 bg-white z-10 pb-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold text-gray-900">
                  Trip Request #{selectedRequest?.id}
                </DialogTitle>
                <p className="text-sm text-gray-500 mt-1">Complete request details and approval workflow</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge 
                  variant={selectedRequest?.status === 'Paid' ? 'default' : selectedRequest?.status === 'Rejected' ? 'destructive' : 'secondary'}
                  className="text-sm px-3 py-1"
                >
                  {selectedRequest?.status}
                </Badge>
              </div>
            </div>
          </DialogHeader>
          
          {(detailedTripData || selectedRequest) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Employee & Trip Information */}
              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Employee Information</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Employee Name</span>
                      <span className="text-sm font-semibold text-gray-900">{detailedTripData?.userName || detailedTripData?.fullName || selectedRequest?.userName || selectedRequest?.fullName || 'Unknown User'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Department</span>
                      <Badge variant="outline" className="text-xs">
                        {detailedTripData?.departmentName || detailedTripData?.userDepartment || selectedRequest?.departmentName || selectedRequest?.userDepartment || 'Unknown'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Employee No</span>
                      <span className="text-sm font-mono font-semibold text-gray-900">{detailedTripData?.userCompanyNumber || detailedTripData?.companyNumber || selectedRequest?.userCompanyNumber || selectedRequest?.companyNumber || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Trip Details</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-gray-600">From</span>
                      <span className="text-sm font-semibold text-gray-900 text-right max-w-xs">
                        {selectedRequest.originName ? `${selectedRequest.originName}, ${selectedRequest.originCity}` : getSiteInfo(selectedRequest.origin || '').fullDisplay}
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-gray-600">To</span>
                      <span className="text-sm font-semibold text-gray-900 text-right max-w-xs">
                        {selectedRequest.destinationName ? `${selectedRequest.destinationName}, ${selectedRequest.destinationCity}` : getSiteInfo(selectedRequest.destination).fullDisplay}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Trip Date</span>
                      <span className="text-sm font-semibold text-gray-900">{format(new Date(selectedRequest.tripDate), 'MMM dd, yyyy')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Trip Type</span>
                      <Badge variant={selectedRequest.tripType === 'Urgent' ? 'destructive' : 'secondary'} className="text-xs">
                        {selectedRequest.tripType || 'Standard'}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Distance Used</span>
                        <span className="text-sm font-bold text-gray-900">{selectedRequest.kilometers || 0} km</span>
                      </div>
                      {selectedRequest.originalDistance && (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600">Originally Recommended</span>
                            <span className="text-sm font-semibold text-gray-900">{selectedRequest.originalDistance} km</span>
                          </div>
                          {selectedRequest.originalDistance !== selectedRequest.kilometers && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-600">Distance Adjustment</span>
                              <span className="text-xs text-amber-600">
                                {((selectedRequest.kilometers || 0) - selectedRequest.originalDistance).toFixed(2)} km difference
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Calculation Method</span>
                        <Badge variant="outline" className="text-xs">
                          {selectedRequest.kilometers > 0 ? 'Distance-based' : 'Direct cost entry'}
                        </Badge>
                      </div>
                      {selectedRequest.costUpdatedBy && selectedRequest.costUpdatedBy !== selectedRequest.userId && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Distance Adjusted By</span>
                          <span className="text-xs text-blue-600">{selectedRequest.costUpdatedByName || 'Administrator'}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-gray-600">Purpose</span>
                      <span className="text-sm text-gray-900 text-right max-w-xs">{selectedRequest.purpose || selectedRequest.description || 'Not specified'}</span>
                    </div>
                    {selectedRequest.ticketNo && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Ticket Number</span>
                        <span className="text-sm font-mono font-bold text-gray-900">{selectedRequest.ticketNo}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Cost & Approval Information */}
              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-amber-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Cost Calculation</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Total Cost</span>
                      <span className="text-lg font-bold text-amber-700">{selectedRequest.cost ? `${selectedRequest.cost.toFixed(2)} JD` : 'Not calculated'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">KM Rate</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {selectedRequest.kmRateValue 
                          ? `${selectedRequest.kmRateValue} JD/km` 
                          : getCurrentKmRate() 
                            ? `${getCurrentKmRate()?.rateValue} JD/km` 
                            : 'Rate not set'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Calculation Method</span>
                      <Badge variant="outline" className="text-xs">
                        {selectedRequest.kilometers > 0 ? 'Distance-based' : 'Direct cost entry'}
                      </Badge>
                    </div>
                    {selectedRequest.costUpdatedAt && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Last Updated</span>
                        <span className="text-sm text-gray-900">{format(new Date(selectedRequest.costUpdatedAt), 'MMM dd, yyyy HH:mm')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Project Information */}
                {selectedRequest.projectId && (selectedRequest.projectName || getProjectInfo(selectedRequest.projectId)) && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <Briefcase className="w-5 h-5 text-indigo-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">Project Information</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Project Name</span>
                        <span className="text-sm font-semibold text-gray-900">{selectedRequest.projectName || getProjectInfo(selectedRequest.projectId)?.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Project Manager</span>
                        <span className="text-sm font-semibold text-gray-900">{(detailedTripData as any)?.projectManagerName || (selectedRequest as any)?.projectManagerName || getProjectInfo(selectedRequest?.projectId)?.managerName || 'Unknown User'}</span>
                      </div>
                      {(selectedRequest.projectSecondManagerName || getProjectInfo(selectedRequest.projectId)?.secondManagerName) && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Second Manager</span>
                          <span className="text-sm font-semibold text-gray-900">{selectedRequest.projectSecondManagerName || getProjectInfo(selectedRequest.projectId)?.secondManagerName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Approval Workflow</h3>
                  </div>
                  <div className="space-y-4">
                    {/* Real Approval Workflow from Database */}
                    {workflowSteps.length > 0 ? workflowSteps.map((step: any, index: number) => (
                      <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          step.status === 'Approved' ? 'bg-green-100' : 
                          step.status === 'Rejected' ? 'bg-red-100' : 'bg-gray-200'
                        }`}>
                          {step.status === 'Approved' ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : step.status === 'Rejected' ? (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          ) : (
                            <Clock className="w-5 h-5 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {step.stepType}
                            {step.displayApproverName && ` (${step.displayApproverName})`}
                          </div>
                          <div className="text-xs text-gray-500">
                            {step.status === 'Approved' ? `Approved ${step.approvedAt ? format(new Date(step.approvedAt), 'MMM dd, yyyy') : ''}` : 
                             step.status === 'Rejected' ? 'Rejected' : 'Pending approval'}
                            {step.status === 'Approved' && step.displayActualApprover && (
                              <span className="ml-2 text-blue-600">by {step.displayActualApprover}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="text-sm text-gray-500">Loading workflow...</div>
                    )}

                    {/* Finance Payment Step - Always show as final step */}
                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        (detailedTripData?.paid || selectedRequest.paid) ? 'bg-green-100' : 'bg-gray-200'
                      }`}>
                        {(detailedTripData?.paid || selectedRequest.paid) ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <Clock className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">Finance Payment</div>
                        <div className="text-xs text-gray-500">
                          {(detailedTripData?.paid || selectedRequest.paid) && (detailedTripData?.paidAt || selectedRequest.paidAt) ? 
                            `Paid on ${format(new Date(detailedTripData?.paidAt || selectedRequest.paidAt), 'MMM dd, yyyy')}` : 
                            'Pending payment'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}