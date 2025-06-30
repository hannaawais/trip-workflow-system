import { useState, useEffect } from "react";
import { TripRequest, AdminRequest, User as UserType, KmRate } from "@shared/schema";
import StatusBadge from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CreditCard, Clock, CheckCircle, XCircle, AlertTriangle, Ban, Calendar, FileText, Car, User, Building2, MapPin, DollarSign, Route, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { calculateTripCost, getTripCost } from "@/lib/cost-calculator";
import { getUserName, formatDate, safeDate, isTripRequest, isAdminRequest, safeArray } from "@/lib/utils-helpers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Request = TripRequest | AdminRequest;

interface RequestTableProps {
  requests: Request[];
}

// Define the StatusHistoryEntry type
interface StatusHistoryEntry {
  status: string;
  timestamp: string;
  userId: number;
  reason?: string;
}

export default function RequestTable({ requests }: RequestTableProps) {
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitterData, setSubmitterData] = useState<Record<number, { name: string, department: string, email: string, companyNumber: string }>>({});
  const [departments, setDepartments] = useState<Record<number, string>>({});
  const [projects, setProjects] = useState<Record<number, string>>({});
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [requestToCancel, setRequestToCancel] = useState<TripRequest | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch users data for submitter information
  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Fetch departments data
  const { data: departmentsData } = useQuery<any[]>({
    queryKey: ["/api/departments"],
  });
  
  // Fetch projects data
  const { data: projectsData } = useQuery<any[]>({
    queryKey: ["/api/projects"],
  });
  
  // Prepare submitter and department data
  useEffect(() => {
    if (users && Array.isArray(users) && requests.length > 0) {
      const userData: Record<number, { name: string, department: string, email: string, companyNumber: string }> = {};
      users.forEach((user) => {
        userData[user.id] = { 
          name: user.fullName,
          department: user.department,
          email: user.email || 'Not available',
          companyNumber: user.companyNumber || 'Not available'
        };
      });
      setSubmitterData(userData);
    }

    if (departmentsData && Array.isArray(departmentsData)) {
      const deptData: Record<number, string> = {};
      departmentsData.forEach((dept) => {
        deptData[dept.id] = dept.name;
      });
      setDepartments(deptData);
    }
    
    if (projectsData && Array.isArray(projectsData)) {
      const projData: Record<number, string> = {};
      projectsData.forEach((proj) => {
        projData[proj.id] = proj.name;
      });
      setProjects(projData);
    }
  }, [users, departmentsData, projectsData, requests]);

  if (!requests || requests.length === 0) {
    return (
      <div className="mt-2 bg-white shadow overflow-hidden sm:rounded-lg p-6 text-center">
        <p className="text-neutral-500">No requests found.</p>
      </div>
    );
  }

  const handleViewRequest = (request: Request) => {
    console.log('handleViewRequest called with:', request);
    setSelectedRequest(request);
    setDialogOpen(true);
  };
  
  // Mutation to cancel a trip request
  const cancelTripMutation = useMutation({
    mutationFn: async (tripId: number) => {
      const response = await apiRequest(
        "POST", 
        `/api/trip-requests/${tripId}/cancel`,
        { reason: cancelReason }
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Trip cancelled successfully",
        description: "Your trip request has been cancelled.",
        variant: "default",
      });
      setCancelDialogOpen(false);
      setRequestToCancel(null);
      setCancelReason('');
      // Invalidate the trip requests query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/trip-requests"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to cancel trip",
        description: error.message || "There was an error cancelling your trip request.",
        variant: "destructive",
      });
    }
  });
  
  const handleCancelRequest = (request: TripRequest) => {
    setRequestToCancel(request);
    setCancelDialogOpen(true);
  };
  
  const confirmCancel = () => {
    if (requestToCancel) {
      cancelTripMutation.mutate(requestToCancel.id);
    }
  };

  const getRequestType = (request: Request): string => {
    if ('destination' in request) {
      return 'Trip';
    } else {
      return 'Administrative';
    }
  };
  
  // Calculate consistent cost for trip requests
  const getRequestCost = (request: Request): number => {
    // Use our centralized utility function for consistent calculation
    const result = getTripCost(request);
    return typeof result === 'number' ? result : result.cost;
  };

  const getRequestId = (request: Request): string => {
    const type = getRequestType(request);
    const prefix = type === 'Trip' ? 'TR' : 'AR';
    const id = request.id.toString().padStart(3, '0');
    const date = request.createdAt ? new Date(request.createdAt) : new Date();
    return `#${prefix}-${date.getFullYear()}-${id}`;
  };

  const getDestinationOrSubject = (request: Request): string => {
    if ('destination' in request) {
      return request.destination;
    } else {
      return request.subject;
    }
  };
  
  const getStatusIcon = (status: string) => {
    if (status === 'Approved') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === 'Rejected') return <XCircle className="h-4 w-4 text-red-500" />;
    if (status === 'Paid') return <CreditCard className="h-4 w-4 text-blue-500" />;
    if (status.includes('Pending')) return <Clock className="h-4 w-4 text-yellow-500" />;
    return <AlertTriangle className="h-4 w-4 text-gray-500" />;
  };
  
  const renderStatusHistory = (request: Request) => {
    const statusHistory = 'statusHistory' in request ? (request.statusHistory as StatusHistoryEntry[] || []) : [];
    
    if (!statusHistory || statusHistory.length === 0) {
      return (
        <div className="text-sm text-neutral-500 italic text-center py-4">
          No status history available
        </div>
      );
    }
    
    return (
      <div className="space-y-4 mt-2">
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute top-0 left-5 bottom-0 w-0.5 bg-neutral-200"></div>
          
          {/* Timeline entries */}
          {statusHistory.map((entry, index) => (
            <div key={index} className="relative pl-12 pb-6">
              {/* Status icon */}
              <div className="absolute top-0 left-3 -ml-1 bg-white">
                {getStatusIcon(entry.status)}
              </div>
              
              {/* Status content */}
              <div className="bg-white p-3 rounded-md border border-neutral-200">
                <div className="flex justify-between items-start">
                  <StatusBadge status={entry.status} showTooltip />
                  <span className="text-xs text-neutral-500">
                    {format(new Date(entry.timestamp), 'MMM dd, yyyy h:mm a')}
                  </span>
                </div>
                
                <p className="text-sm text-neutral-700 mt-1">
                  Updated by: {submitterData[entry.userId]?.name || `User #${entry.userId}`}
                </p>
                
                {entry.reason && (
                  <p className="text-sm text-neutral-600 mt-1 italic">
                    <span className="font-medium">Reason: </span>
                    {entry.reason}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  const isPaymentRelated = (request: Request) => {
    return request.status === 'Paid' || request.status === 'Approved';
  };
  
  const renderPaymentInfo = (request: Request) => {
    const isPaid = 'paid' in request && request.paid;
    const paidAt = 'paidAt' in request && request.paidAt ? new Date(request.paidAt) : null;
    const paidBy = 'paidBy' in request && request.paidBy ? submitterData[request.paidBy]?.name || `User #${request.paidBy}` : null;
    
    if (!isPaid) {
      return (
        <div className="space-y-4 mt-2">
          <div className="border border-yellow-200 bg-yellow-50 rounded-md p-4 flex items-center">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-yellow-700">Not Yet Paid</p>
              <p className="text-sm text-yellow-600 mt-1">
                {request.status === 'Approved' 
                  ? 'This request is approved but has not been processed for payment yet.'
                  : 'This request must be fully approved before payment can be processed.'}
              </p>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="space-y-4 mt-2">
        <div className="border border-green-200 bg-green-50 rounded-md p-4">
          <div className="flex items-center">
            <CreditCard className="h-5 w-5 text-green-500 mr-3" />
            <p className="text-sm font-medium text-green-700">Payment Processed</p>
          </div>
          
          <div className="mt-3 space-y-2">
            <div className="flex justify-between">
              <p className="text-sm text-neutral-600">Paid On:</p>
              <p className="text-sm font-medium text-neutral-700">
                {paidAt ? format(paidAt, 'MMMM dd, yyyy') : 'N/A'}
              </p>
            </div>
            
            <div className="flex justify-between">
              <p className="text-sm text-neutral-600">Processed By:</p>
              <p className="text-sm font-medium text-neutral-700">{paidBy || 'N/A'}</p>
            </div>
            
            {'cost' in request && (
              <div className="flex justify-between">
                <p className="text-sm text-neutral-600">Amount:</p>
                {(request.userId === user?.id) ? (
                  <p className="text-sm font-medium text-green-600">{getRequestCost(request).toFixed(2)} JD</p>
                ) : (
                  <p className="text-sm font-medium text-neutral-500">
                    <span className="italic">Hidden for privacy</span>
                  </p>
                )}
              </div>
            )}
            
            {'requestedAmount' in request && request.requestedAmount && (
              <div className="flex justify-between">
                <p className="text-sm text-neutral-600">Amount:</p>
                {(request.userId === user?.id) ? (
                  <p className="text-sm font-medium text-green-600">{getRequestCost(request).toFixed(2)} JD</p>
                ) : (
                  <p className="text-sm font-medium text-neutral-500">
                    <span className="italic">Hidden for privacy</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-2 flex flex-col">
      <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div className="shadow-lg overflow-hidden border border-neutral-200 sm:rounded-xl bg-white">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800">
                <tr>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-white tracking-wide border-b border-slate-600">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-slate-300" />
                      <span>Reference</span>
                    </div>
                  </th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-white tracking-wide border-b border-slate-600">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-slate-300" />
                      <span>Trip Date</span>
                    </div>
                  </th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-white tracking-wide border-b border-slate-600">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-slate-300" />
                      <span>Employee</span>
                    </div>
                  </th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-white tracking-wide border-b border-slate-600">
                    <span className="text-slate-200">Origin</span>
                  </th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-white tracking-wide border-b border-slate-600">
                    <span className="text-slate-200">Destination</span>
                  </th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-white tracking-wide border-b border-slate-600">
                    <span className="text-slate-200">Department</span>
                  </th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-white tracking-wide border-b border-slate-600">
                    <span className="text-slate-200">Ticket No.</span>
                  </th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-white tracking-wide border-b border-slate-600">
                    <span className="text-slate-200">Project</span>
                  </th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-white tracking-wide border-b border-slate-600">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                      <span>Status</span>
                    </div>
                  </th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-white tracking-wide border-b border-slate-600">
                    <div className="flex items-center space-x-2">
                      <CreditCard className="h-4 w-4 text-slate-300" />
                      <span>Cost</span>
                    </div>
                  </th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-white tracking-wide border-b border-slate-600">
                    <span className="text-slate-200">KM</span>
                  </th>
                  <th scope="col" className="relative px-4 py-4 border-b border-slate-600">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {requests.map((request) => (
                  <tr key={`${getRequestType(request)}-${request.id}`} 
                      className="hover:bg-neutral-50 transition-colors cursor-pointer"
                      onClick={(e) => {
                        console.log('Row clicked!', request);
                        alert(`Clicked on request ${request.id}`);
                        handleViewRequest(request);
                      }}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {getRequestId(request)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {'tripDate' in request && request.tripDate 
                        ? format(new Date(request.tripDate), 'MMM dd, yyyy') 
                        : (request.createdAt ? format(new Date(request.createdAt), 'MMM dd, yyyy') : '-')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="h-4 w-4 text-gray-500" />
                          </div>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">
                            {(request as any).fullName || `User #${request.userId}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            #{(request as any).companyNumber || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {'origin' in request ? request.origin : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {'destination' in request ? request.destination : getDestinationOrSubject(request)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {((request as any).departmentName || (request as any).userDepartment || (request as any).department || submitterData[request.userId]?.department || 'Unknown')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {'ticketNo' in request ? request.ticketNo || '-' : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {'projectId' in request && request.projectId
                        ? <span className="text-blue-600">{projects[request.projectId] || `-`}</span>
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={request.status} showTooltip />
                      {'paid' in request && request.paid && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <CreditCard className="h-3 w-3 mr-1" />
                          Paid
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {(request.userId === user?.id) ? (
                        <span className="font-medium text-green-600">{getRequestCost(request).toFixed(2)} JD</span>
                      ) : (
                        <span className="italic text-neutral-400">Hidden</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {'kilometers' in request ? `${request.kilometers} km` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {/* Only show Cancel button for trip requests that belong to the current user and are in cancellable state */}
                      {getRequestType(request) === 'Trip' && user?.id === request.userId && 
                        (request.status === 'Pending Department Approval' || 
                         request.status === 'Pending Project Approval' || 
                         request.status === 'Pending Finance Approval' || 
                         request.status === 'Rejected') ? (
                        <Button 
                          variant="link" 
                          className="text-red-500 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row click when clicking cancel button
                            handleCancelRequest(request as TripRequest);
                          }}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>





      {/* ENHANCED TRIP REQUEST DETAILS DIALOG - FUTURE MODIFICATIONS: This is the main dialog implementation */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRequest && getRequestType(selectedRequest) === 'Trip Request' ? (
                <Car className="h-5 w-5" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
              {selectedRequest ? `${getRequestType(selectedRequest)} Details - #${getRequestId(selectedRequest)}` : 'Request Details'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-6">
              {/* Basic Information Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Employee</label>
                    <p className="text-sm font-medium">
                      {(selectedRequest as any).fullName || `User ID: ${selectedRequest.userId}`}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Department</label>
                    <p className="text-sm">{((selectedRequest as any).departmentName || (selectedRequest as any).userDepartment || (selectedRequest as any).department || submitterData[selectedRequest.userId]?.department || 'Unknown')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div className="mt-1">
                      <StatusBadge status={selectedRequest.status} />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Trip-specific Information */}
              {getRequestType(selectedRequest) === 'Trip Request' && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Route className="h-4 w-4" />
                      Trip Details
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Origin</label>
                          <p className="text-sm font-medium flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {isTripRequest(selectedRequest) ? selectedRequest.origin : 'Not specified'}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Destination</label>
                          <p className="text-sm font-medium flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {getDestinationOrSubject(selectedRequest)}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Trip Date</label>
                          <p className="text-sm flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date((selectedRequest as TripRequest).tripDate), 'EEEE, MMMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Trip Type</label>
                          <p className="text-sm">{(selectedRequest as TripRequest).tripType || 'Standard'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Urgency</label>
                          <p className="text-sm">{isTripRequest(selectedRequest) ? 'Normal' : 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Distance</label>
                          <p className="text-sm">{(selectedRequest as TripRequest).kilometers || 'Calculating...'} km</p>
                        </div>
                      </div>
                    </div>
                    
                    {(selectedRequest as TripRequest).purpose && (
                      <div className="mt-4">
                        <label className="text-sm font-medium text-gray-500">Purpose</label>
                        <p className="text-sm mt-1 p-3 bg-gray-50 rounded-md">{(selectedRequest as TripRequest).purpose}</p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Project Information */}
                  {(selectedRequest as TripRequest).projectId && (
                    <>
                      <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Project Information
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-500">Project ID</label>
                            <p className="text-sm">{(selectedRequest as TripRequest).projectId}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-500">Budget Tracking</label>
                            <p className="text-sm">Enabled</p>
                          </div>
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}
                </>
              )}

              {/* Admin Request Information */}
              {getRequestType(selectedRequest) === 'Admin Request' && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Request Details
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Subject</label>
                        <p className="text-sm font-medium">{(selectedRequest as AdminRequest).subject}</p>
                      </div>
                      {(selectedRequest as AdminRequest).description && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Description</label>
                          <p className="text-sm mt-1 p-3 bg-gray-50 rounded-md">{(selectedRequest as AdminRequest).description}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-gray-500">Request Type</label>
                        <p className="text-sm">{(selectedRequest as AdminRequest).requestType?.replace('-', ' ') || 'Other'}</p>
                      </div>
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Financial Information */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Financial Information
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      {getRequestType(selectedRequest) === 'Trip Request' ? 'Estimated Cost' : 'Requested Amount'}
                    </label>
                    <p className="text-lg font-semibold">
                      {getRequestCost(selectedRequest).toFixed(2)} JD
                    </p>
                  </div>
                  {getRequestType(selectedRequest) === 'Trip Request' && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Rate per KM</label>
                        <p className="text-sm">0.15 JD</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Cost Breakdown</label>
                        <p className="text-sm">Distance × Rate</p>
                      </div>
                    </>
                  )}
                </div>
                
                {/* Budget Impact Assessment */}
                <div className="mt-4 p-3 bg-blue-50 rounded-md">
                  <label className="text-sm font-medium text-gray-500">Budget Impact</label>
                  <p className="text-sm">
                    {getRequestCost(selectedRequest) > 1000 ? 'High Impact (>1000 JD)' : 
                     getRequestCost(selectedRequest) > 500 ? 'Medium Impact (500-1000 JD)' : 
                     'Low Impact (<500 JD)'}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Process Information */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Process Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created Date</label>
                    <p className="text-sm">{selectedRequest.createdAt ? formatDate(selectedRequest.createdAt) : 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Last Updated</label>
                    <p className="text-sm">{selectedRequest.createdAt ? formatDate(selectedRequest.createdAt) : 'N/A'}</p>
                  </div>
                </div>

                {/* Approval Workflow Status */}
                <div className="mt-4">
                  <label className="text-sm font-medium text-gray-500">Approval Workflow</label>
                  <div className="mt-2 flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${
                        ['Pending Department Approval', 'Pending Project Approval', 'Pending Finance Approval', 'Approved', 'Paid'].includes(selectedRequest.status) 
                          ? 'bg-green-500' : 'bg-gray-300'
                      }`} />
                      <span className="text-xs">Department</span>
                    </div>
                    {getRequestType(selectedRequest) === 'Trip Request' && (selectedRequest as TripRequest).projectId && (
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${
                          ['Pending Project Approval', 'Pending Finance Approval', 'Approved', 'Paid'].includes(selectedRequest.status) 
                            ? 'bg-green-500' : 'bg-gray-300'
                        }`} />
                        <span className="text-xs">Project</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${
                        ['Pending Finance Approval', 'Approved', 'Paid'].includes(selectedRequest.status) 
                          ? 'bg-green-500' : 'bg-gray-300'
                      }`} />
                      <span className="text-xs">Finance</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${
                        ['Paid'].includes(selectedRequest.status) ? 'bg-green-500' : 'bg-gray-300'
                      }`} />
                      <span className="text-xs">Payment</span>
                    </div>
                  </div>
                </div>

                {/* Status History */}
                {renderStatusHistory(selectedRequest)}

                {/* Comments and Notes */}
                {isTripRequest(selectedRequest) && selectedRequest.purpose && (
                  <div className="mt-4">
                    <label className="text-sm font-medium text-gray-500">Trip Purpose</label>
                    <p className="text-sm mt-1 p-3 bg-blue-50 rounded-md">{selectedRequest.purpose}</p>
                  </div>
                )}
                
                {isAdminRequest(selectedRequest) && selectedRequest.description && (
                  <div className="mt-4">
                    <label className="text-sm font-medium text-gray-500">Description</label>
                    <p className="text-sm mt-1 p-3 bg-yellow-50 rounded-md">{selectedRequest.description}</p>
                  </div>
                )}
              </div>

              {/* Payment Information (if applicable) */}
              {isPaymentRelated(selectedRequest) && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Payment Information
                    </h3>
                    {renderPaymentInfo(selectedRequest)}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Trip Request Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Trip Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this trip request? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 space-y-4">
            <div className="grid w-full gap-1.5">
              <label htmlFor="cancelReason" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Reason for cancellation (optional)
              </label>
              <textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="flex h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Please provide a reason for cancelling this trip request"
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCancelDialogOpen(false);
                  setRequestToCancel(null);
                  setCancelReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmCancel}
                disabled={cancelTripMutation.isPending}
              >
                {cancelTripMutation.isPending ? (
                  <>
                    <span className="mr-2">Cancelling...</span>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-b-transparent" />
                  </>
                ) : (
                  'Confirm Cancellation'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
