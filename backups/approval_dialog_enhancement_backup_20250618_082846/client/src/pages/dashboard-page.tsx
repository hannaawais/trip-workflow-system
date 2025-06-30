import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useCallback } from "react";
import Layout from "@/components/layout";
import StatCard from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import RequestTable from "@/components/dashboard/request-table";
import { Loader2, Filter, Clock, CheckSquare, AlertCircle, CreditCard, CalendarRange } from "lucide-react";
import StatusFilterBar, { StatusFilter } from "@/components/dashboard/status-filter-bar";
import DateFilterBar from "@/components/dashboard/date-filter-bar";
import { Badge } from "@/components/ui/badge";
import { Pagination, PageSizeSelector } from "@/components/ui/pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [monthFilter, setMonthFilter] = useState<number | null>(null);
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, monthFilter, yearFilter]);

  // Fetch trip requests - use server's default pagination
  const { data: tripRequestsResponse, isLoading: isLoadingTrips } = useQuery({
    queryKey: ["/api/trip-requests"],
  });

  // Safely extract trip data from the response
  let tripRequests: any[] = [];
  if (tripRequestsResponse) {
    try {
      // Handle the object format with 'data' property
      if (Array.isArray(tripRequestsResponse)) {
        tripRequests = tripRequestsResponse;
      } else if (tripRequestsResponse && typeof tripRequestsResponse === 'object' && 'data' in tripRequestsResponse) {
        tripRequests = Array.isArray((tripRequestsResponse as any).data) ? (tripRequestsResponse as any).data : [];
      } else {
        console.error("Unexpected trip requests response format:", tripRequestsResponse);
      }
    } catch (err) {
      console.error("Error processing trip requests:", err);
    }
  }
  
  console.log("Fetched trip requests:", tripRequests?.length || 0);

  // Fetch admin requests
  const { data: adminRequestsData, isLoading: isLoadingAdmin } = useQuery({
    queryKey: ["/api/admin-requests"],
  });
  const adminRequests = Array.isArray(adminRequestsData) ? adminRequestsData : [];

  // Conditionally fetch departments based on user role
  const { data: departmentsData, isLoading: isLoadingDepartments } = useQuery({
    queryKey: ["/api/departments"],
    enabled: !!user,
  });
  const departments = Array.isArray(departmentsData) ? departmentsData : [];

  // Database-first approach: Trust backend permission system
  const filterRequestsByRole = () => {
    const allTrips = tripRequests || [];
    const allAdminRequests = adminRequests || [];
    
    // Backend already applies proper permissions, so return all requests as-is
    return [...allTrips, ...allAdminRequests];
  };
  
  const allRequests = useMemo(() => filterRequestsByRole(), [tripRequests, adminRequests, departments, user]);
  
  // Helper function to apply date filters to requests
  const applyDateFilters = useCallback((requests: any[], month: number | null, year: number | null) => {
    if (month === null && year === null) return requests;
    
    return requests.filter((req: any) => {
      let dateToCheck: Date;
      
      // Use tripDate for trip requests, createdAt for admin requests
      if ('tripDate' in req) {
        // Trip request - use tripDate field
        dateToCheck = new Date(req.tripDate);
      } else if (req.createdAt) {
        // Admin request - use createdAt field
        dateToCheck = new Date(req.createdAt);
      } else {
        // No valid date field available
        return false;
      }
      
      const dateMonth = dateToCheck.getMonth() + 1; // getMonth() is 0-indexed
      const dateYear = dateToCheck.getFullYear();
      
      // Apply month filter if set
      if (month !== null && dateMonth !== month) {
        return false;
      }
      
      // Apply year filter if set
      if (year !== null && dateYear !== year) {
        return false;
      }
      
      return true;
    });
  }, []);
  
  // Apply status and date filters
  const filteredRequests = useMemo(() => {
    // First apply date filters
    let filtered = applyDateFilters(allRequests, monthFilter, yearFilter);
    
    // Then apply status filter if not 'All'
    if (statusFilter !== 'All') {
      // Handle the special case for 'Pending' which should include all pending states
      if (statusFilter === 'Pending') {
        filtered = filtered.filter((req: any) => req.status === 'Pending' || req.status.includes('Pending'));
      } else {
        filtered = filtered.filter((req: any) => req.status === statusFilter);
      }
    }
    
    return filtered;
  }, [allRequests, statusFilter, monthFilter, yearFilter, applyDateFilters]);
  
  // Calculate status counts for the filter bar based on date-filtered requests
  const statusCounts = useMemo(() => {
    // Apply only date filters for the status counts
    const dateFilteredRequests = applyDateFilters(allRequests, monthFilter, yearFilter);
    
    const counts = {
      All: dateFilteredRequests.length,
      Pending: 0,
      Approved: 0,
      Rejected: 0,
      Paid: 0,
      Cancelled: 0
    };
    
    dateFilteredRequests.forEach((req: any) => {
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
  }, [allRequests, monthFilter, yearFilter, applyDateFilters]);
  
  // Calculate dashboard statistics - use the same date filtering logic
  const stats = useMemo(() => {
    if (!allRequests.length) return null;
    
    // Apply only date filters for the dashboard stats
    const dateFilteredRequests = applyDateFilters(allRequests, monthFilter, yearFilter);
    
    const pendingCount = dateFilteredRequests.filter((req: any) => req.status.includes('Pending')).length;
    const approvedCount = dateFilteredRequests.filter((req: any) => req.status === 'Approved').length;
    const rejectedCount = dateFilteredRequests.filter((req: any) => req.status === 'Rejected').length;
    const paidCount = dateFilteredRequests.filter((req: any) => req.status === 'Paid').length;
    
    // Calculate department budget if available
    let departmentBudget = 0;
    if (departments && user) {
      const userDepartment = departments.find(dept => dept.name === user.department);
      if (userDepartment) {
        departmentBudget = userDepartment.budget;
      }
    }
    
    return {
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      paid: paidCount,
      budget: departmentBudget
    };
  }, [allRequests, departments, user, monthFilter, yearFilter, applyDateFilters]);
  
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
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-xl font-medium text-neutral-600">All Requests</h2>
                      <div className="text-sm text-neutral-500 self-end ml-2">
                        {filteredRequests.length} {filteredRequests.length === 1 ? 'request' : 'requests'} found
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap items-center">
                    <div className="flex items-center space-x-1 mr-2">
                      <CalendarRange className="h-4 w-4 text-neutral-500" />
                      <span className="text-xs font-medium text-neutral-500">Date:</span>
                    </div>
                    <DateFilterBar 
                      onMonthChange={setMonthFilter} 
                      onYearChange={setYearFilter}
                      className="mb-0"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center space-x-1 mr-1">
                    <Filter className="h-4 w-4 text-neutral-500" />
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
                      {(monthFilter !== null || yearFilter !== null) && ' for the selected date filters'}.
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
