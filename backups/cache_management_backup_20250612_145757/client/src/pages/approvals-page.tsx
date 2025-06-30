import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import Layout from "@/components/layout";
import StatusBadge from "@/components/status-badge";
import ApproveRejectButtons from "@/components/approve-reject-buttons";
import { format } from "date-fns";
import { Loader2, User, MapPin, FileText, Building2, CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import JDCurrencyIcon from "@/components/jd-currency-icon";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pagination, PageSizeSelector } from "@/components/ui/pagination";
import { BudgetStatus } from "@/components/ui/budget-status";

export default function ApprovalsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("trip");
  const [selectedRequests, setSelectedRequests] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'approve' | 'reject' | null>(null);
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  
  // Pagination state
  const [tripCurrentPage, setTripCurrentPage] = useState(1);
  const [adminCurrentPage, setAdminCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch trip requests that need approval - using workflow-aware endpoint
  const { data: tripRequestsData, isLoading: isLoadingTrips, refetch: refetchTrips } = useQuery({
    queryKey: ["/api/trip-requests/pending-approval"],
    refetchInterval: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: false,
    staleTime: 0, // Always fetch fresh data
  });

  // Fetch administrative requests that need approval
  const { data: adminRequests, isLoading: isLoadingAdmin, refetch: refetchAdmin } = useQuery({
    queryKey: ["/api/admin-requests"],
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
  
  // Extract trips array from the response with proper typing
  const tripRequests = (tripRequestsData as any)?.trips || [];
  
  // Fetch users for submitter information
  const { data: users } = useQuery({
    queryKey: ["/api/users/basic"],
  });
  
  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
  });
  
  // Fetch projects
  const { data: projects } = useQuery({
    queryKey: ["/api/projects"],
  });

  // Database-first pending requests filtering
  const getPendingTripRequests = () => {
    if (!tripRequests) return [];
    
    return tripRequests.filter((req: any) => {
      // Filter by status based on user's role and what they can approve
      const userRole = user?.activeRole || user?.role;
      
      if (userRole === 'Admin') {
        // Admin can see all non-final status trips
        return !['Approved', 'Rejected', 'Paid', 'Cancelled'].includes(req.status);
      }
      
      if (userRole === 'Finance') {
        // Finance only sees trips pending their approval
        return req.status === 'Pending Finance Approval';
      }
      
      if (userRole === 'Manager') {
        // Managers only see trips pending their specific approval level
        return req.status === 'Pending Department Approval' || req.status === 'Pending Project Approval';
      }
      
      // Regular employees only see their own trips in pending status
      return req.userId === user?.id && !['Approved', 'Rejected', 'Paid', 'Cancelled'].includes(req.status);
    });
  };

  const getPendingAdminRequests = () => {
    if (!adminRequests) return [];
    
    // Only Finance and Admin can approve admin requests
    if (user?.role !== 'Finance' && user?.activeRole !== 'Finance' && user?.role !== 'Admin') return [];
    
    return adminRequests.filter((req: any) => req.status === 'Pending');
  };

  // Helper function to get user's name by ID
  const getUserName = (userId: number) => {
    if (!users) return "Unknown";
    const user = users.find((u: any) => u.id === userId);
    return user ? user.fullName : "Unknown";
  };
  
  // Helper function to get department name by ID
  const getDepartmentName = (departmentId: number) => {
    if (!departments) return "Unknown";
    const department = departments.find((d: any) => d.id === departmentId);
    return department ? department.name : "Unknown";
  };
  
  // Helper function to get project name by ID
  const getProjectName = (projectId: number) => {
    if (!projects) return "Unknown";
    const project = projects.find((p: any) => p.id === projectId);
    return project ? project.name : "Unknown";
  };

  // Get all pending requests
  const allPendingTripRequests = getPendingTripRequests();
  const allPendingAdminRequests = getPendingAdminRequests();
  
  // Pagination handling functions
  const handleTripPageChange = (page: number) => {
    setTripCurrentPage(page);
    // Clear selections when changing pages
    setSelectedRequests([]);
    setSelectAll(false);
  };
  
  const handleAdminPageChange = (page: number) => {
    setAdminCurrentPage(page);
    // Clear selections when changing pages
    setSelectedRequests([]);
    setSelectAll(false);
  };
  
  const handleItemsPerPageChange = (size: number) => {
    setItemsPerPage(size);
    // Reset to first page when changing items per page
    setTripCurrentPage(1);
    setAdminCurrentPage(1);
    // Clear selections
    setSelectedRequests([]);
    setSelectAll(false);
  };
  
  // Calculate paginated trip requests
  const startTrip = (tripCurrentPage - 1) * itemsPerPage;
  const endTrip = startTrip + itemsPerPage;
  const pendingTripRequests = allPendingTripRequests.slice(startTrip, endTrip);
  
  // Calculate paginated admin requests
  const startAdmin = (adminCurrentPage - 1) * itemsPerPage;
  const endAdmin = startAdmin + itemsPerPage;
  const pendingAdminRequests = allPendingAdminRequests.slice(startAdmin, endAdmin);

  // Mutation for approving/rejecting requests
  const approvalMutation = useMutation({
    mutationFn: async ({ requestId, requestType, approve, reason }: any) => {
      // Store the approval status in the mutationFn context
      // so we can access it later in onSuccess
      const res = await apiRequest("POST", "/api/approvals", {
        requestId,
        requestType,
        approve,
        reason
      });
      const responseData = await res.json();
      // Return both the API response and the original approve value
      return { ...responseData, wasApproved: approve };
    },
    onSuccess: (data) => {
      // Use the stored approve value for messaging
      const wasApproved = data.wasApproved;
      toast({
        title: `Request ${wasApproved ? 'approved' : 'rejected'}`,
        description: `The request has been successfully ${wasApproved ? 'approved' : 'rejected'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trip-requests/pending-approval"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trip-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin-requests"] });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      // Parse budget validation errors for better user experience
      let title = "Action failed";
      let description = error.message;
      
      if (error.message.includes("Budget exceeded") || error.message.includes("budget exceeded")) {
        title = "Budget Exceeded";
        description = error.message.replace("Cannot approve: ", "");
      } else if (error.message.includes("permission")) {
        title = "Permission Denied";
      } else if (error.message.includes("not found")) {
        title = "Request Not Found";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    }
  });
  
  // Mutation for bulk approving/rejecting requests
  const bulkApprovalMutation = useMutation({
    mutationFn: async ({ requestIds, requestType, approve, reason }: any) => {
      // Store the approval status in the mutationFn context
      const res = await apiRequest("POST", "/api/approvals/bulk", {
        requestIds,
        requestType,
        approve,
        reason
      });
      const responseData = await res.json();
      // Return both the API response and the original approve value
      return { ...responseData, wasApproved: approve };
    },
    onSuccess: (data) => {
      // Use the stored approve value for messaging
      const wasApproved = data.wasApproved;
      const count = data.count || data.results?.length || selectedRequests.length;
      
      toast({
        title: `Requests ${wasApproved ? 'approved' : 'rejected'}`,
        description: `${count} requests have been successfully ${wasApproved ? 'approved' : 'rejected'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trip-requests/pending-approval"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trip-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin-requests"] });
      setBulkActionDialogOpen(false);
      setSelectedRequests([]);
      setSelectAll(false);
    },
    onError: (error: Error) => {
      // Parse budget validation errors for better user experience
      let title = "Bulk action failed";
      let description = error.message;
      
      if (error.message.includes("Budget exceeded")) {
        title = "Budget Exceeded";
        description = error.message.replace("Cannot approve: ", "");
      } else if (error.message.includes("permission")) {
        title = "Permission Denied";
      } else if (error.message.includes("not found")) {
        title = "Request Not Found";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    }
  });

  const handleViewDetails = (request: any, type: string) => {
    setSelectedRequest({ ...request, type });
    setDialogOpen(true);
  };

  const handleApprove = () => {
    if (!selectedRequest) return;
    
    approvalMutation.mutate({
      requestId: selectedRequest.id,
      requestType: selectedRequest.type === 'trip' ? 'Trip' : 'Administrative',
      approve: true,
    });
  };

  const handleReject = (reason: string) => {
    if (!selectedRequest) return;
    
    approvalMutation.mutate({
      requestId: selectedRequest.id,
      requestType: selectedRequest.type === 'trip' ? 'Trip' : 'Administrative',
      approve: false,
      reason,
    });
  };

  // Bulk action handlers
  const handleToggleSelectAll = () => {
    if (selectAll) {
      // If currently all selected, deselect all
      setSelectedRequests([]);
    } else {
      // Select all visible requests
      if (activeTab === "trip") {
        setSelectedRequests(pendingTripRequests.map((req: any) => req.id));
      } else {
        setSelectedRequests(pendingAdminRequests.map((req: any) => req.id));
      }
    }
    setSelectAll(!selectAll);
  };

  const handleToggleSelect = (requestId: number) => {
    if (selectedRequests.includes(requestId)) {
      // Remove from selection
      setSelectedRequests(selectedRequests.filter(id => id !== requestId));
      setSelectAll(false);
    } else {
      // Add to selection
      setSelectedRequests([...selectedRequests, requestId]);
      
      // Check if all items are now selected
      const currentList = activeTab === "trip" ? pendingTripRequests : pendingAdminRequests;
      if (selectedRequests.length + 1 === currentList.length) {
        setSelectAll(true);
      }
    }
  };

  const handleBulkApprove = () => {
    if (selectedRequests.length === 0) return;
    
    setBulkActionType('approve');
    setBulkActionDialogOpen(true);
  };

  const handleBulkReject = () => {
    if (selectedRequests.length === 0) return;
    
    setBulkActionType('reject');
    setBulkActionDialogOpen(true);
  };

  const handleConfirmBulkAction = () => {
    if (selectedRequests.length === 0) return;
    
    bulkApprovalMutation.mutate({
      requestIds: selectedRequests,
      requestType: activeTab === "trip" ? 'Trip' : 'Administrative',
      approve: bulkActionType === 'approve',
      reason: bulkActionType === 'reject' ? bulkRejectReason : undefined
    });
  };

  return (
    <Layout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-600">Pending Approvals</h1>
              <p className="mt-1 text-sm text-neutral-400">
                Review and approve or reject pending requests.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/trip-requests/pending-approval"] });
                queryClient.invalidateQueries({ queryKey: ["/api/admin-requests"] });
              }}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="mt-4">
            <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full md:w-[400px] grid-cols-2">
                <TabsTrigger value="trip">Trip Requests</TabsTrigger>
                <TabsTrigger value="admin">Administrative Requests</TabsTrigger>
              </TabsList>
              
              {/* Trip Requests Tab */}
              <TabsContent value="trip">
                {isLoadingTrips ? (
                  <div className="flex justify-center my-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : pendingTripRequests.length === 0 ? (
                  <div className="bg-white shadow overflow-hidden sm:rounded-md p-6 text-center">
                    <p className="text-neutral-500">No pending trip requests require your approval.</p>
                  </div>
                ) : (
                  <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    {/* Bulk Actions Toolbar */}
                    {pendingTripRequests.length > 0 && (
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            checked={selectAll}
                            onChange={handleToggleSelectAll}
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            {selectedRequests.length === 0 
                              ? 'Select all' 
                              : `Selected ${selectedRequests.length} of ${pendingTripRequests.length}`}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex items-center text-green-600 border-green-600 hover:bg-green-50"
                            onClick={handleBulkApprove}
                            disabled={selectedRequests.length === 0}
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Approve Selected
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex items-center text-red-600 border-red-600 hover:bg-red-50"
                            onClick={handleBulkReject}
                            disabled={selectedRequests.length === 0}
                          >
                            <XCircle className="mr-1 h-4 w-4" />
                            Reject Selected
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    <ul className="divide-y divide-neutral-200 min-h-[300px]">
                      {pendingTripRequests.length === 0 ? (
                        <li className="py-6 text-center text-neutral-500">No pending trip requests on this page.</li>
                      ) : pendingTripRequests.map((request: any) => (
                        <li key={`trip-${request.id}`}>
                          <div className="block hover:bg-neutral-50">
                            <div className="px-4 py-4 sm:px-6">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mr-3"
                                    checked={selectedRequests.includes(request.id)}
                                    onChange={() => handleToggleSelect(request.id)}
                                  />
                                  <p className="text-sm font-medium text-primary-500 truncate">
                                    Trip Request #{`TR-${new Date(request.createdAt).getFullYear()}-${request.id.toString().padStart(3, '0')}`}
                                  </p>
                                  <div className="ml-2 flex-shrink-0 flex">
                                    <StatusBadge status={request.status} />
                                  </div>
                                </div>
                                <div className="ml-2 flex-shrink-0 flex">
                                  <span className="mr-2 text-sm font-medium text-neutral-500">
                                    Submitted: {format(new Date(request.createdAt), 'MMM d, yyyy')}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-2 sm:flex sm:justify-between">
                                <div className="sm:flex">
                                  <p className="flex items-center text-sm text-neutral-500">
                                    <User className="flex-shrink-0 mr-1.5 h-5 w-5 text-neutral-400" />
                                    {getUserName(request.userId)}
                                  </p>
                                  <p className="mt-2 flex items-center text-sm text-neutral-500 sm:mt-0 sm:ml-6">
                                    <Building2 className="flex-shrink-0 mr-1.5 h-5 w-5 text-neutral-400" />
                                    {(request as any).departmentName || (request as any).userDepartment || (request as any).department || 'Unknown'} 
                                  </p>
                                  <p className="mt-2 flex items-center text-sm text-neutral-500 sm:mt-0 sm:ml-6">
                                    <MapPin className="flex-shrink-0 mr-1.5 h-5 w-5 text-neutral-400" />
                                    {request.destination}
                                  </p>
                                  <p className="mt-2 flex items-center text-sm text-neutral-500 sm:mt-0 sm:ml-6">
                                    <JDCurrencyIcon className="flex-shrink-0 mr-1.5 h-5 w-5 text-neutral-400" />
                                    {(request.cost || 0).toFixed(2)} JD
                                  </p>
                                  {request.tripType === "Urgent" && (
                                    <p className="mt-2 flex items-center text-sm text-amber-600 font-medium sm:mt-0 sm:ml-6">
                                      <AlertCircle className="flex-shrink-0 mr-1.5 h-5 w-5 text-amber-600" />
                                      URGENT
                                    </p>
                                  )}
                                </div>
                                <div className="mt-2 flex items-center text-sm text-neutral-500 sm:mt-0">
                                  <Button
                                    variant="outline"
                                    onClick={() => handleViewDetails(request, 'trip')}
                                    className="text-primary-500 hover:text-primary-600"
                                  >
                                    View Details
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    
                    {/* Trip Requests Pagination */}
                    {allPendingTripRequests.length > 0 && (
                      <div className="py-3 px-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="flex-1 flex justify-start">
                          <select
                            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                            value={itemsPerPage}
                            onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                          >
                            {[10, 25, 50, 100].map(size => (
                              <option key={size} value={size}>
                                {size} per page
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-700">
                            Showing {startTrip + 1}-{Math.min(endTrip, allPendingTripRequests.length)} of {allPendingTripRequests.length}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={tripCurrentPage === 1}
                              onClick={() => handleTripPageChange(tripCurrentPage - 1)}
                            >
                              Previous
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={endTrip >= allPendingTripRequests.length}
                              onClick={() => handleTripPageChange(tripCurrentPage + 1)}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
              
              {/* Administrative Requests Tab */}
              <TabsContent value="admin">
                {isLoadingAdmin ? (
                  <div className="flex justify-center my-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : pendingAdminRequests.length === 0 ? (
                  <div className="bg-white shadow overflow-hidden sm:rounded-md p-6 text-center">
                    <p className="text-neutral-500">No pending administrative requests require your approval.</p>
                  </div>
                ) : (
                  <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    {/* Bulk Actions Toolbar */}
                    {pendingAdminRequests.length > 0 && (
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            checked={selectAll}
                            onChange={handleToggleSelectAll}
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            {selectedRequests.length === 0 
                              ? 'Select all' 
                              : `Selected ${selectedRequests.length} of ${pendingAdminRequests.length}`}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex items-center text-green-600 border-green-600 hover:bg-green-50"
                            onClick={handleBulkApprove}
                            disabled={selectedRequests.length === 0}
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Approve Selected
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex items-center text-red-600 border-red-600 hover:bg-red-50"
                            onClick={handleBulkReject}
                            disabled={selectedRequests.length === 0}
                          >
                            <XCircle className="mr-1 h-4 w-4" />
                            Reject Selected
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    <ul className="divide-y divide-neutral-200 min-h-[300px]">
                      {pendingAdminRequests.length === 0 ? (
                        <li className="py-6 text-center text-neutral-500">No pending administrative requests on this page.</li>
                      ) : pendingAdminRequests.map((request: any) => (
                        <li key={`admin-${request.id}`}>
                          <div className="block hover:bg-neutral-50">
                            <div className="px-4 py-4 sm:px-6">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mr-3"
                                    checked={selectedRequests.includes(request.id)}
                                    onChange={() => handleToggleSelect(request.id)}
                                  />
                                  <p className="text-sm font-medium text-primary-500 truncate">
                                    Administrative Request #{`AR-${new Date(request.createdAt).getFullYear()}-${request.id.toString().padStart(3, '0')}`}
                                  </p>
                                  <div className="ml-2 flex-shrink-0 flex">
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                                      {request.requestType}
                                    </span>
                                  </div>
                                </div>
                                <div className="ml-2 flex-shrink-0 flex">
                                  <span className="mr-2 text-sm font-medium text-neutral-500">
                                    Submitted: {format(new Date(request.createdAt), 'MMM d, yyyy')}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-2 sm:flex sm:justify-between">
                                <div className="sm:flex">
                                  <p className="flex items-center text-sm text-neutral-500">
                                    <User className="flex-shrink-0 mr-1.5 h-5 w-5 text-neutral-400" />
                                    {getUserName(request.userId)}
                                  </p>
                                  <p className="mt-2 flex items-center text-sm text-neutral-500 sm:mt-0 sm:ml-6">
                                    <Building2 className="flex-shrink-0 mr-1.5 h-5 w-5 text-neutral-400" />
                                    {(request as any).departmentName || (request as any).userDepartment || (request as any).department || 'Unknown'}
                                  </p>
                                  <p className="mt-2 flex items-center text-sm text-neutral-500 sm:mt-0 sm:ml-6">
                                    <FileText className="flex-shrink-0 mr-1.5 h-5 w-5 text-neutral-400" />
                                    {request.subject}
                                  </p>
                                  {request.requestedAmount && (
                                    <p className="mt-2 flex items-center text-sm text-neutral-500 sm:mt-0 sm:ml-6">
                                      <JDCurrencyIcon className="flex-shrink-0 mr-1.5 h-5 w-5 text-neutral-400" />
                                      {request.requestedAmount.toFixed(2)} JD
                                    </p>
                                  )}
                                </div>
                                <div className="mt-2 flex items-center text-sm text-neutral-500 sm:mt-0">
                                  <Button
                                    variant="outline"
                                    onClick={() => handleViewDetails(request, 'admin')}
                                    className="text-primary-500 hover:text-primary-600"
                                  >
                                    View Details
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    
                    {/* Admin Requests Pagination */}
                    {allPendingAdminRequests.length > 0 && (
                      <div className="py-3 px-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="flex-1 flex justify-start">
                          <select
                            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                            value={itemsPerPage}
                            onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                          >
                            {[10, 25, 50, 100].map(size => (
                              <option key={size} value={size}>
                                {size} per page
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-700">
                            Showing {startAdmin + 1}-{Math.min(endAdmin, allPendingAdminRequests.length)} of {allPendingAdminRequests.length}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={adminCurrentPage === 1}
                              onClick={() => handleAdminPageChange(adminCurrentPage - 1)}
                            >
                              Previous
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={endAdmin >= allPendingAdminRequests.length}
                              onClick={() => handleAdminPageChange(adminCurrentPage + 1)}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Bulk Action Confirmation Dialog */}
      <Dialog open={bulkActionDialogOpen} onOpenChange={setBulkActionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {bulkActionType === 'approve' ? 'Approve Selected Requests' : 'Reject Selected Requests'}
            </DialogTitle>
            <DialogDescription>
              {bulkActionType === 'approve' 
                ? `You are about to approve ${selectedRequests.length} selected requests.` 
                : `You are about to reject ${selectedRequests.length} selected requests.`}
            </DialogDescription>
          </DialogHeader>
          
          {bulkActionType === 'reject' && (
            <div className="mb-4">
              <label htmlFor="rejection-reason" className="block text-sm font-medium text-neutral-700">
                Rejection Reason
              </label>
              <textarea
                id="rejection-reason"
                className="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Please provide a reason for rejection"
                rows={3}
                value={bulkRejectReason}
                onChange={(e) => setBulkRejectReason(e.target.value)}
              />
            </div>
          )}
          
          <div className="mt-4 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setBulkActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmBulkAction}
              disabled={bulkActionType === 'reject' && !bulkRejectReason.trim()}
              className={bulkActionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              Confirm {bulkActionType === 'approve' ? 'Approval' : 'Rejection'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Request Details Dialog */}
      {selectedRequest && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {selectedRequest.type === 'trip' ? 'Trip Request Details' : 'Administrative Request Details'}
              </DialogTitle>
              <DialogDescription>
                Review the request details before making a decision.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Trip request details */}
              {selectedRequest.type === 'trip' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Submitter:</p>
                      <p className="text-sm text-neutral-700">{getUserName(selectedRequest.userId)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Department/Project:</p>
                      <p className="text-sm text-neutral-700">
                        {(selectedRequest as any).departmentName || (selectedRequest as any).userDepartment || (selectedRequest as any).department || 'Unknown'}
                      </p>
                    </div>
                  </div>
                
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Trip Date:</p>
                      <p className="text-sm text-neutral-700">
                        {format(new Date(selectedRequest.tripDate), 'MMMM d, yyyy')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Status:</p>
                      <StatusBadge status={selectedRequest.status} />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Trip Type:</p>
                      <p className={`text-sm ${selectedRequest.tripType === "Urgent" ? "text-amber-600 font-medium flex items-center" : "text-neutral-700"}`}>
                        {selectedRequest.tripType === "Urgent" && (
                          <AlertCircle className="mr-1 h-4 w-4 text-amber-600" />
                        )}
                        {selectedRequest.tripType === "Urgent" ? "Urgent Trip/Unplanned" : 
                         selectedRequest.tripType === "Ticket" ? "Ticket Based Trip" : 
                         selectedRequest.tripType === "Planned" ? "Planned Trip" : 
                         "Unknown"}
                      </p>
                    </div>
                    <div>
                      {selectedRequest.tripType === "Urgent" && (
                        <div className="mt-1 px-3 py-1 bg-amber-50 border border-amber-100 rounded-md">
                          <p className="text-xs text-amber-700">Urgent trips bypass department approval and have no budget impact</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Origin:</p>
                      <p className="text-sm text-neutral-700">{selectedRequest.origin}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Destination:</p>
                      <p className="text-sm text-neutral-700">{selectedRequest.destination}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Cost:</p>
                      <p className="text-sm text-neutral-700">{(selectedRequest.cost || 0).toFixed(2)} JD</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Distance:</p>
                      <p className="text-sm text-neutral-700">{selectedRequest.kilometers || 0} km</p>
                    </div>
                  </div>
                  
                  {selectedRequest.ticketNo && (
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Ticket Number:</p>
                      <p className="text-sm text-neutral-700">{selectedRequest.ticketNo}</p>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-sm font-medium text-neutral-500">Purpose:</p>
                    <p className="text-sm text-neutral-700 mt-1">{selectedRequest.purpose}</p>
                  </div>
                  
                  {selectedRequest.attachmentPath && (
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Attachment:</p>
                      <a href={selectedRequest.attachmentPath} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-500 hover:text-primary-600">
                        View Attachment
                      </a>
                    </div>
                  )}

                  {/* Budget Status for Planned Trips */}
                  {selectedRequest.tripType === 'Planned' && selectedRequest.projectId && (
                    <div>
                      <BudgetStatus 
                        projectId={selectedRequest.projectId}
                        tripCost={selectedRequest.cost || 0}
                        showTripImpact={true}
                      />
                    </div>
                  )}
                  
                  {/* Department Budget Info for Department-based trips */}
                  {selectedRequest.tripType === 'Planned' && !selectedRequest.projectId && selectedRequest.departmentId && (
                    <div>
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            Department Budget Status
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">{(selectedRequest as any).departmentName || (selectedRequest as any).userDepartment || (selectedRequest as any).department || 'Unknown'}</p>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">Department-based trips use departmental budget allocation</p>
                          <div className="mt-2">
                            <p className="text-sm"><strong>Trip Cost:</strong> {(selectedRequest.cost || 0).toFixed(2)} JD</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}
              
              {/* Administrative request details */}
              {selectedRequest.type === 'admin' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Submitter:</p>
                      <p className="text-sm text-neutral-700">{getUserName(selectedRequest.userId)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Department:</p>
                      <p className="text-sm text-neutral-700">
                        {getUserName(selectedRequest.userId) && users 
                          ? ((selectedRequest as any).departmentName || (selectedRequest as any).userDepartment || (selectedRequest as any).department || 'Unknown')
                          : 'Unknown'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Request Type:</p>
                      <p className="text-sm text-neutral-700">{selectedRequest.requestType}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Status:</p>
                      <StatusBadge status={selectedRequest.status} />
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-neutral-500">Subject:</p>
                    <p className="text-sm text-neutral-700">{selectedRequest.subject}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-neutral-500">Description:</p>
                    <p className="text-sm text-neutral-700">{selectedRequest.description}</p>
                  </div>
                  
                  {selectedRequest.requestedAmount && (
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Requested Amount:</p>
                      <p className="text-sm text-neutral-700">{selectedRequest.requestedAmount.toFixed(2)} JD</p>
                    </div>
                  )}
                  
                  {selectedRequest.attachmentPath && (
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Attachment:</p>
                      <a href={selectedRequest.attachmentPath} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-500 hover:text-primary-600">
                        View Attachment
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex justify-end mt-4">
              <ApproveRejectButtons
                onApprove={handleApprove}
                onReject={handleReject}
                isLoading={approvalMutation.isPending}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Bulk Action Confirmation Dialog */}
      <Dialog open={bulkActionDialogOpen} onOpenChange={setBulkActionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {bulkActionType === 'approve' ? 'Approve' : 'Reject'} {selectedRequests.length} Requests
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to {bulkActionType === 'approve' ? 'approve' : 'reject'} the selected requests?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {bulkActionType === 'reject' && (
              <div>
                <label htmlFor="bulkRejectReason" className="block text-sm font-medium text-neutral-700">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="bulkRejectReason"
                  rows={3}
                  className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  placeholder="Enter reason for rejection"
                  value={bulkRejectReason}
                  onChange={(e) => setBulkRejectReason(e.target.value)}
                />
              </div>
            )}
            
            <div className="mt-2">
              <p className="text-sm text-neutral-500">
                This action will {bulkActionType === 'approve' ? 'approve' : 'reject'} {selectedRequests.length} {activeTab === 'trip' ? 'trip' : 'administrative'} requests.
              </p>
            </div>
          </div>
          
          <div className="flex justify-end mt-4 space-x-2">
            <Button
              variant="outline"
              onClick={() => setBulkActionDialogOpen(false)}
              disabled={bulkApprovalMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmBulkAction}
              disabled={bulkApprovalMutation.isPending || (bulkActionType === 'reject' && !bulkRejectReason)}
              className={bulkActionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {bulkApprovalMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>{bulkActionType === 'approve' ? 'Approve' : 'Reject'} Requests</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
