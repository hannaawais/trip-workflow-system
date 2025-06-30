import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, differenceInDays } from "date-fns";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Calendar, DollarSign, Users, Clock, Download, Filter, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

interface ApprovedTrip {
  id: number;
  userId: number;
  userName: string;
  department: string;
  destination: string;
  tripDate: string;
  tripType: string;
  cost: number;
  approvalDate: string;
  kilometers: number;
}

interface PaymentBatch {
  selectedTrips: number[];
  paymentMethod: string;
  referenceNumber: string;
  notes: string;
}

export default function FinancePaymentDashboard() {
  const { toast } = useToast();
  
  // State for filtering and pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [tripTypeFilter, setTripTypeFilter] = useState("all");
  const [costRange, setCostRange] = useState({ min: "", max: "" });
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [sortBy, setSortBy] = useState("approvalDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  // State for bulk payment processing
  const [selectedTrips, setSelectedTrips] = useState<Set<number>>(new Set());
  const [selectAllCurrentPage, setSelectAllCurrentPage] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentBatch>({
    selectedTrips: [],
    paymentMethod: "",
    referenceNumber: "",
    notes: ""
  });

  // Fetch approved trips ready for payment
  const { data: approvedTrips = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/finance/approved-trips', {
      page: currentPage,
      limit: itemsPerPage,
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      department: departmentFilter,
      tripType: tripTypeFilter,
      costMin: costRange.min,
      costMax: costRange.max,
      employeeSearch,
      sortBy,
      sortOrder
    }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        sortBy,
        sortOrder
      });
      
      if (dateRange.from) params.append('dateFrom', dateRange.from);
      if (dateRange.to) params.append('dateTo', dateRange.to);
      if (departmentFilter) params.append('department', departmentFilter);
      if (tripTypeFilter) params.append('tripType', tripTypeFilter);
      if (costRange.min) params.append('costMin', costRange.min);
      if (costRange.max) params.append('costMax', costRange.max);
      if (employeeSearch) params.append('employeeSearch', employeeSearch);
      
      const response = await fetch(`/api/finance/approved-trips?${params}`);
      if (!response.ok) throw new Error('Failed to fetch approved trips');
      return response.json();
    },
    staleTime: 0, // Always consider data stale
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnMount: true, // Always refetch on component mount
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch departments for filter dropdown
  const { data: departments = [] } = useQuery({
    queryKey: ['/api/departments'],
    queryFn: async () => {
      const response = await fetch('/api/departments');
      if (!response.ok) throw new Error('Failed to fetch departments');
      return response.json();
    }
  });

  // Bulk payment mutation
  const bulkPaymentMutation = useMutation({
    mutationFn: async (paymentBatch: PaymentBatch) => {
      const response = await apiRequest('POST', '/api/finance/bulk-payment', paymentBatch);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Payment Successful",
        description: `${paymentDetails.selectedTrips.length} trips marked as paid successfully.`,
      });
      setSelectedTrips(new Set());
      setSelectAllCurrentPage(false);
      setIsPaymentDialogOpen(false);
      setPaymentDetails({
        selectedTrips: [],
        paymentMethod: "",
        referenceNumber: "",
        notes: ""
      });
      queryClient.invalidateQueries({ queryKey: ['/api/finance/approved-trips'] });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Calculate summary statistics
  const totalTrips = approvedTrips.data?.length || 0;
  const totalAmount = approvedTrips.data?.reduce((sum: number, trip: ApprovedTrip) => sum + trip.cost, 0) || 0;
  const selectedTripsData = approvedTrips.data?.filter((trip: ApprovedTrip) => selectedTrips.has(trip.id)) || [];
  const selectedAmount = selectedTripsData.reduce((sum: number, trip: ApprovedTrip) => sum + trip.cost, 0);
  const totalDistance = approvedTrips.data?.reduce((sum: number, trip: ApprovedTrip) => sum + trip.kilometers, 0) || 0;

  // Handle individual trip selection
  const handleTripSelection = (tripId: number, checked: boolean) => {
    const newSelected = new Set(selectedTrips);
    if (checked) {
      newSelected.add(tripId);
    } else {
      newSelected.delete(tripId);
      setSelectAllCurrentPage(false);
    }
    setSelectedTrips(newSelected);
  };

  // Handle select all for current page
  const handleSelectAllCurrentPage = (checked: boolean) => {
    if (checked) {
      const currentPageTripIds = approvedTrips.data?.map((trip: ApprovedTrip) => trip.id) || [];
      const newSelected = new Set([...selectedTrips, ...currentPageTripIds]);
      setSelectedTrips(newSelected);
      setSelectAllCurrentPage(true);
    } else {
      const currentPageTripIds = new Set(approvedTrips.data?.map((trip: ApprovedTrip) => trip.id) || []);
      const newSelected = new Set([...selectedTrips].filter(id => !currentPageTripIds.has(id)));
      setSelectedTrips(newSelected);
      setSelectAllCurrentPage(false);
    }
  };

  // Handle bulk payment
  const handleBulkPayment = () => {
    if (selectedTrips.size === 0) {
      toast({
        title: "No Trips Selected",
        description: "Please select at least one trip to process payment.",
        variant: "destructive",
      });
      return;
    }
    
    setPaymentDetails({
      ...paymentDetails,
      selectedTrips: [...selectedTrips]
    });
    setIsPaymentDialogOpen(true);
  };

  // Process the payment
  const processPayment = () => {
    if (!paymentDetails.paymentMethod || !paymentDetails.referenceNumber) {
      toast({
        title: "Missing Information",
        description: "Please provide payment method and reference number.",
        variant: "destructive",
      });
      return;
    }
    
    bulkPaymentMutation.mutate(paymentDetails);
  };

  // Export to Excel functionality
  const handleExportToExcel = () => {
    const exportData = selectedTripsData.map(trip => ({
      'Trip ID': trip.id,
      'Employee': trip.userName,
      'Department': trip.department,
      'Destination': trip.destination,
      'Trip Date': format(new Date(trip.tripDate), 'yyyy-MM-dd'),
      'Trip Type': trip.tripType,
      'Cost (JD)': trip.cost,
      'Approval Date': format(new Date(trip.approvalDate), 'yyyy-MM-dd'),
      'Days Since Approval': trip.daysSinceApproval
    }));
    
    // Convert to CSV for download
    const csvContent = [
      Object.keys(exportData[0] || {}).join(','),
      ...exportData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `approved_trips_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="space-y-6">
      {/* Compact Header with Inline Stats */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Payment Processing</h1>
            <p className="text-sm text-gray-600">Manage approved trip payments and process bulk transactions</p>
          </div>
          
          {/* Inline Summary Stats with Refresh Button */}
          <div className="flex flex-wrap items-center gap-6 lg:gap-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-900">{approvedTrips.pagination?.total || 0}</div>
                <div className="text-xs text-gray-500">Total Trips</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-900">JD {(approvedTrips.totalAmount || 0).toFixed(2)}</div>
                <div className="text-xs text-gray-500">Total Amount</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-900">{selectedTrips.size}</div>
                <div className="text-xs text-gray-500">Selected (JD {selectedAmount.toFixed(2)})</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-900">{totalDistance.toFixed(0)}</div>
                <div className="text-xs text-gray-500">Total KM</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Input
                placeholder="Search employee..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="w-40 h-8"
              />
            </div>
            
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-36 h-8">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Depts</SelectItem>
                {departments.map((dept: any) => (
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
            
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="w-36 h-8"
                title="Date From"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="w-36 h-8"
                title="Date To"
              />
            </div>
            
            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
              const [field, order] = value.split('-');
              setSortBy(field);
              setSortOrder(order as "asc" | "desc");
            }}>
              <SelectTrigger className="w-44 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approvalDate-asc">Date (Old→New)</SelectItem>
                <SelectItem value="approvalDate-desc">Date (New→Old)</SelectItem>
                <SelectItem value="cost-desc">Cost (High→Low)</SelectItem>
                <SelectItem value="cost-asc">Cost (Low→High)</SelectItem>
                <SelectItem value="tripDate-asc">Trip (Early→Late)</SelectItem>
                <SelectItem value="tripDate-desc">Trip (Late→Early)</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
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
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Checkbox
            id="select-all-page"
            checked={selectAllCurrentPage}
            onCheckedChange={handleSelectAllCurrentPage}
          />
          <Label htmlFor="select-all-page" className="text-sm">
            Select All ({totalTrips} trips on this page)
          </Label>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportToExcel}
            disabled={selectedTrips.size === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Selected
          </Button>
          
          <Button 
            onClick={handleBulkPayment}
            disabled={selectedTrips.size === 0 || bulkPaymentMutation.isPending}
          >
            Mark as Paid ({selectedTrips.size})
          </Button>
        </div>
      </div>

      {/* Trip Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Loading approved trips...</div>
          ) : totalTrips === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No approved trips found matching your criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="p-4 w-12">
                      <Checkbox
                        checked={selectAllCurrentPage}
                        onCheckedChange={handleSelectAllCurrentPage}
                      />
                    </th>
                    <th className="p-4">Trip ID</th>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Department</th>
                    <th className="p-4">Destination</th>
                    <th className="p-4">Trip Date</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Cost (JD)</th>
                    <th className="p-4">Distance (KM)</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedTrips.data?.map((trip: ApprovedTrip) => (
                    <tr key={trip.id} className="border-b hover:bg-muted/50">
                      <td className="p-4">
                        <Checkbox
                          checked={selectedTrips.has(trip.id)}
                          onCheckedChange={(checked) => handleTripSelection(trip.id, checked as boolean)}
                        />
                      </td>
                      <td className="p-4 font-medium">#{trip.id}</td>
                      <td className="p-4">{trip.userName}</td>
                      <td className="p-4">{trip.department}</td>
                      <td className="p-4">{trip.destination}</td>
                      <td className="p-4">{format(new Date(trip.tripDate), 'MMM dd, yyyy')}</td>
                      <td className="p-4">
                        <Badge variant={trip.tripType === 'Urgent' ? 'destructive' : 'default'}>
                          {trip.tripType}
                        </Badge>
                      </td>
                      <td className="p-4 font-medium">{trip.cost.toFixed(2)}</td>
                      <td className="p-4">
                        <Badge variant={trip.kilometers > 100 ? 'destructive' : trip.kilometers > 50 ? 'secondary' : 'default'}>
                          {trip.kilometers} km
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {approvedTrips.pagination && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, approvedTrips.pagination.total)} of {approvedTrips.pagination.total} trips
          </p>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <span className="text-sm">
              Page {currentPage} of {approvedTrips.pagination.pages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(approvedTrips.pagination.pages, currentPage + 1))}
              disabled={currentPage === approvedTrips.pagination.pages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Process Bulk Payment</DialogTitle>
            <DialogDescription>
              You are about to mark {selectedTrips.size} trips as paid with a total amount of JD {selectedAmount.toFixed(2)}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-method">Payment Method *</Label>
              <Select value={paymentDetails.paymentMethod} onValueChange={(value) => 
                setPaymentDetails({ ...paymentDetails, paymentMethod: value })
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="petty-cash">Petty Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reference-number">Reference Number *</Label>
              <Input
                id="reference-number"
                placeholder="Payment reference or transaction ID"
                value={paymentDetails.referenceNumber}
                onChange={(e) => setPaymentDetails({ ...paymentDetails, referenceNumber: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notes (Optional)</Label>
              <Textarea
                id="payment-notes"
                placeholder="Additional notes about this payment batch"
                value={paymentDetails.notes}
                onChange={(e) => setPaymentDetails({ ...paymentDetails, notes: e.target.value })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={processPayment}
              disabled={bulkPaymentMutation.isPending || !paymentDetails.paymentMethod || !paymentDetails.referenceNumber}
            >
              {bulkPaymentMutation.isPending ? "Processing..." : `Mark as Paid (${selectedTrips.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </Layout>
  );
}