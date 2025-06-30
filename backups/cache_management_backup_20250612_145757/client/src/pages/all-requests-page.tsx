import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Department, TripRequest } from "@shared/schema";
import { Loader2, Filter, Search, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import StatusFilterBar from "@/components/dashboard/status-filter-bar";
import RequestTable from "@/components/dashboard/request-table";
import { Pagination } from "@/components/ui/pagination";
import { PageSizeSelector } from "@/components/ui/page-size-selector";

export default function AllRequestsPage() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState('All');
  
  // New filter state variables (same as finance payment dashboard)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [tripTypeFilter, setTripTypeFilter] = useState("All");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  
  // Fetch trip requests
  const { data: tripRequestData, isLoading: isLoadingTrips } = useQuery({
    queryKey: ["/api/trip-requests"],
  });
  
  // Fetch admin requests
  const { data: adminRequests = [], isLoading: isLoadingAdmin } = useQuery({
    queryKey: ["/api/admin-requests"],
  });
  
  // Fetch departments
  const { data: departments = [], isLoading: isLoadingDepartments } = useQuery<any[]>({
    queryKey: ["/api/departments"],
  });
  
  // Extract trips array from the response (API returns { trips: TripRequest[] })
  const tripRequests = (tripRequestData as { trips: any[] })?.trips || [];
  
  // Database-first approach: Trust backend permission system
  const filterRequestsByRole = () => {
    // Backend already applies proper permissions, so return all requests as-is
    return [
      ...(Array.isArray(tripRequests) ? tripRequests : []),
      ...(Array.isArray(adminRequests) ? adminRequests : [])
    ];
  };
  
  const allRequests = useMemo(() => filterRequestsByRole(), [tripRequests, adminRequests, departments, user]);
  
  // Helper function to apply advanced filters to requests
  const applyAdvancedFilters = useCallback((requests: any[]) => {
    return requests.filter(req => {
      // Date range filter
      if (dateRange?.from || dateRange?.to) {
        let dateToCheck: Date;
        
        if ('tripDate' in req) {
          dateToCheck = new Date(req.tripDate);
        } else if (req.createdAt) {
          dateToCheck = new Date(req.createdAt);
        } else {
          return false;
        }
        
        if (dateRange.from && dateToCheck < dateRange.from) {
          return false;
        }
        if (dateRange.to && dateToCheck > dateRange.to) {
          return false;
        }
      }
      
      // Employee search filter
      if (employeeSearch) {
        const userName = req.userName || req.fullName || '';
        if (!userName.toLowerCase().includes(employeeSearch.toLowerCase())) {
          return false;
        }
      }
      
      // Department filter
      if (departmentFilter !== "All") {
        // For trip requests, check departmentId first, then fall back to user's department
        let requestDepartment = '';
        if ('departmentId' in req && req.departmentId) {
          // Find department name by ID
          const dept = departments.find((d: any) => d.id === req.departmentId);
          requestDepartment = dept?.name || '';
        } else {
          // Fall back to user's home department
          requestDepartment = req.department || '';
        }
        
        if (requestDepartment !== departmentFilter) {
          return false;
        }
      }
      
      // Trip type filter (only applies to trip requests)
      if (tripTypeFilter !== "All" && 'tripType' in req) {
        if (req.tripType !== tripTypeFilter) {
          return false;
        }
      }
      
      return true;
    });
  }, [dateRange, employeeSearch, departmentFilter, tripTypeFilter]);
  
  // Apply status and advanced filters
  const filteredRequests = useMemo(() => {
    // First apply advanced filters (date range, employee search, etc.)
    let filtered = applyAdvancedFilters(allRequests);
    
    // Then apply status filter if not 'All'
    if (statusFilter !== 'All') {
      // Handle the special case for 'Pending' which should include all pending states
      if (statusFilter === 'Pending') {
        filtered = filtered.filter(req => req.status === 'Pending' || req.status.includes('Pending'));
      } else {
        filtered = filtered.filter(req => req.status === statusFilter);
      }
    }
    
    return filtered;
  }, [allRequests, statusFilter, applyAdvancedFilters]);
  
  // Calculate status counts for the filter bar based on advanced-filtered requests
  const statusCounts = useMemo(() => {
    // Apply only advanced filters for the status counts (excluding status filter)
    const advancedFilteredRequests = applyAdvancedFilters(allRequests);
    
    const counts = {
      All: advancedFilteredRequests.length,
      Pending: 0,
      Approved: 0,
      Rejected: 0,
      Paid: 0,
      Cancelled: 0
    };
    
    advancedFilteredRequests.forEach(req => {
      // Count both 'Pending' and any status containing 'Pending' as pending
      if (req.status === 'Pending' || req.status.includes('Pending')) {
        counts.Pending++;
      }
      if (req.status === 'Approved') {
        counts.Approved++;
      }
      if (req.status === 'Rejected') {
        counts.Rejected++;
      }
      if (req.status === 'Paid') {
        counts.Paid++;
      }
      if (req.status === 'Cancelled') {
        counts.Cancelled++;
      }
    });
    
    return counts;
  }, [allRequests, applyAdvancedFilters]);
  
  const isLoading = isLoadingTrips || isLoadingAdmin || isLoadingDepartments;
  
  // Sort requests by date (most recent first) and apply pagination
  const paginatedRequests = useMemo(() => {
    // Sort first (most recent first)
    const sortedRequests = [...filteredRequests].sort(
      (a, b) => {
        // Handle null createdAt values
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      }
    );
    
    // Calculate start and end indexes based on pagination
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    // Return the sliced array for the current page
    return sortedRequests.slice(startIndex, endIndex);
  }, [filteredRequests, currentPage, pageSize]);
  
  // Calculate total pages - make sure we don't divide by zero
  const totalPages = pageSize > 0 ? Math.ceil(filteredRequests.length / pageSize) : 0;

  return (
    <Layout>
      <div className="py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          {isLoading ? (
            <div className="flex justify-center my-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Recent Requests Table with Filters */}
              <div>
                <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-lg font-medium text-neutral-700">All Requests</h2>
                    <span className="text-sm text-neutral-500">
                      ({filteredRequests.length} {filteredRequests.length === 1 ? 'request' : 'requests'})
                    </span>
                  </div>
                  
                  <div className="text-xs text-neutral-400">
                    Use filters to refine results
                  </div>
                </div>

                {/* Compact Filters Section */}
                <div className="mb-3 p-2 bg-gray-50 rounded border">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
                    {/* Date Range Filter */}
                    <div>
                      <label className="text-[10px] font-medium text-neutral-600 block mb-1">Date Range</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal h-6 text-[10px] px-2"
                          >
                            <CalendarIcon className="mr-1 h-2.5 w-2.5" />
                            {dateRange?.from ? (
                              dateRange.to ? (
                                <>
                                  {format(dateRange.from, "MM/dd")} - {format(dateRange.to, "MM/dd")}
                                </>
                              ) : (
                                format(dateRange.from, "MM/dd/yy")
                              )
                            ) : (
                              <span>Select dates</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={setDateRange}
                            numberOfMonths={2}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Employee Search */}
                    <div>
                      <label className="text-[10px] font-medium text-neutral-600 block mb-1">Employee</label>
                      <div className="relative">
                        <Search className="absolute left-1.5 top-1/2 transform -translate-y-1/2 h-2.5 w-2.5 text-gray-400" />
                        <Input
                          placeholder="Search name..."
                          value={employeeSearch}
                          onChange={(e) => setEmployeeSearch(e.target.value)}
                          className="pl-6 h-6 text-[10px]"
                        />
                      </div>
                    </div>

                    {/* Department Filter */}
                    <div>
                      <label className="text-[10px] font-medium text-neutral-600 block mb-1">Department</label>
                      <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger className="h-6 text-[10px] px-2">
                          <SelectValue placeholder="All Depts" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">All Departments</SelectItem>
                          {departments && departments.map((dept: any) => (
                            <SelectItem key={dept.id} value={dept.name}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Trip Type Filter */}
                    <div>
                      <label className="text-[10px] font-medium text-neutral-600 block mb-1">Type</label>
                      <Select value={tripTypeFilter} onValueChange={setTripTypeFilter}>
                        <SelectTrigger className="h-6 text-[10px] px-2">
                          <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">All Types</SelectItem>
                          <SelectItem value="Ticket">Ticket</SelectItem>
                          <SelectItem value="Planned">Planned</SelectItem>
                          <SelectItem value="Urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Clear Filters Button */}
                    <div className="flex justify-end">
                      <button 
                        onClick={() => {
                          setDateRange(undefined);
                          setEmployeeSearch('');
                          setDepartmentFilter('All');
                          setTripTypeFilter('All');
                        }}
                        className="text-[10px] text-neutral-500 hover:text-neutral-700 flex items-center gap-1 h-6 px-2"
                      >
                        <X className="h-2.5 w-2.5" />
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center space-x-1 mr-1">
                    <Filter className="h-3.5 w-3.5 text-neutral-500" />
                    <span className="text-xs font-medium text-neutral-500">Status:</span>
                  </div>
                  
                  <StatusFilterBar 
                    onFilterChange={setStatusFilter} 
                    totalCounts={statusCounts}
                    className="mb-0"
                  />
                </div>
                
                {filteredRequests.length > 0 ? (
                  <>
                    <RequestTable requests={paginatedRequests} />
                    
                    {/* Pagination Controls */}
                    <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                      <PageSizeSelector 
                        currentLimit={pageSize}
                        onLimitChange={(newSize) => {
                          setPageSize(newSize);
                          setCurrentPage(1); // Reset to first page when changing page size
                        }}
                      />
                      
                      {/* Only show pagination if we have more than one page */}
                      {totalPages > 1 && (
                        <Pagination
                          total={filteredRequests.length}
                          limit={pageSize}
                          currentPage={currentPage}
                          onPageChange={setCurrentPage}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="bg-white shadow rounded-lg p-8 text-center">
                    <p className="text-neutral-500">
                      No {statusFilter !== 'All' ? statusFilter + ' ' : ''}
                      requests found
                      {(dateRange?.from || dateRange?.to) && ' for the selected date filters'}.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}