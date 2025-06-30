import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Layout from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ArrowUpRight, ArrowDownRight, Car, Clock, Clipboard, BarChart as BarChartIcon } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function DashboardHomePage() {
  const { user } = useAuth();
  const [monthFilter, setMonthFilter] = useState(new Date().getMonth() + 1); // Current month (1-12)
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  
  // Fetch dashboard statistics from server
  const { data: dashboardStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/dashboard/stats", { month: monthFilter, year: yearFilter }],
    queryFn: () => fetch(`/api/dashboard/stats?month=${monthFilter}&year=${yearFilter}`).then(res => res.json()),
  });
  
  // Filter requests by current month/year

  const currentMonthRequests = useMemo(() => {
    return requestsByRole.filter(req => {
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
      
      const reqMonth = dateToCheck.getMonth() + 1; // getMonth() is 0-indexed
      const reqYear = dateToCheck.getFullYear();
      

      
      return reqMonth === monthFilter && reqYear === yearFilter;
    });
  }, [requestsByRole, monthFilter, yearFilter]);
  
  // Get current KM rate
  const { data: kmRates } = useQuery({
    queryKey: ['/api/km-rates'],
  });

  const currentKmRate = useMemo(() => {
    if (!kmRates || !Array.isArray(kmRates) || kmRates.length === 0) {
      return 0.15; // Default rate if none is available
    }
    
    // Sort by effectiveFrom date, newest first
    const sortedRates = [...kmRates].sort((a, b) => {
      const dateA = new Date(a.effectiveFrom).getTime();
      const dateB = new Date(b.effectiveFrom).getTime();
      return dateB - dateA;
    });
    
    // Return the most recent rate
    return sortedRates[0].rateValue;
  }, [kmRates]);
  

  
  // Calculate status counts and costs
  const dashboardStats = useMemo(() => {
    const stats = {
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      paidCount: 0,
      cancelledCount: 0,
      totalTripCost: 0,
      pendingTripCost: 0,
      approvedTripCost: 0,
      pendingRejectionCost: 0,
      pendingApprovalCost: 0,
      paidTripCost: 0, // Add new property to track paid trip costs
      recentRequests: [] as any[],
    };
    

    
    // Calculate stats using stored costs from database - TRIP REQUESTS ONLY for overview
    currentMonthRequests.forEach(req => {
      if ('tripDate' in req) {
        // Only process trip requests for overview statistics
        const cost = req.cost || 0;
        
        // Count by status and add costs
        if (req.status === 'Pending' || (typeof req.status === 'string' && req.status.includes('Pending'))) {
          stats.pendingCount++;
          stats.pendingApprovalCost += cost;
          stats.totalTripCost += cost;
        } else if (req.status === 'Approved') {
          stats.approvedCount++;
          stats.approvedTripCost += cost;
          stats.totalTripCost += cost; // Add to total for approved trips

        } else if (req.status === 'Rejected') {
          stats.rejectedCount++;
          stats.pendingRejectionCost += cost;
        } else if (req.status === 'Paid') {
          stats.paidCount++;
          stats.paidTripCost += cost; // Track paid amount separately
          stats.totalTripCost += cost; // Add to total for paid trips
        } else if (req.status === 'Cancelled') {
          stats.cancelledCount++;
        }
      }
      // Admin requests are excluded from overview statistics but will still appear in recent activity
    });
    
    // Get 5 most recent requests
    stats.recentRequests = [...currentMonthRequests]
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5);
    
    return stats;
  }, [currentMonthRequests]);
  
  // Generate months for dropdown
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];
  
  // Generate years for dropdown (current year and 4 previous years)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  
  // Loading state
  const isLoading = isLoadingTrips || isLoadingAdmin || isLoadingDepartments;
  
  // Prepare chart data to show the distribution of requests by status
  const chartData = useMemo(() => {
    // Get days in the selected month
    const daysInMonth = new Date(yearFilter, monthFilter, 0).getDate();
    
    // Create data structure for chart (grouping by day)
    const data = Array.from({ length: daysInMonth }, (_, i) => {
      return {
        day: i + 1,
        Pending: 0,
        Approved: 0,
        Rejected: 0,
        Paid: 0,
        Cancelled: 0
      };
    });
    
    // Populate data from current month requests
    currentMonthRequests.forEach(req => {
      let dateToCheck: Date;
      
      // Use tripDate for trip requests, createdAt for admin requests
      if ('tripDate' in req) {
        dateToCheck = new Date(req.tripDate);
      } else if (req.createdAt) {
        dateToCheck = new Date(req.createdAt);
      } else {
        return; // Skip if no date
      }
      
      // Get the day of the month (1-31)
      const day = dateToCheck.getDate();
      
      // Skip if day is outside the range (shouldn't happen, but just in case)
      if (day < 1 || day > daysInMonth) return;
      
      // Group by status
      let status = req.status;
      
      // Standardize status to one of our chart categories
      if (typeof status === 'string' && status.includes('Pending')) status = 'Pending';
      
      // Increment count for this day and status if it's a valid status in our chart
      if (['Pending', 'Approved', 'Rejected', 'Paid', 'Cancelled'].includes(status)) {
        data[day - 1][status] += 1;
      }
    });
    
    // Only return data for days that have at least one request
    return data.filter(day => 
      day.Pending > 0 || day.Approved > 0 || day.Rejected > 0 || day.Paid > 0 || day.Cancelled > 0
    );
  }, [currentMonthRequests, monthFilter, yearFilter]);
  
  return (
    <Layout>
      <div className="py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex flex-col space-y-4">
            {/* Header and date filter */}
            <div className="flex flex-wrap justify-between items-center gap-4">
              <h1 className="text-2xl font-semibold text-neutral-800">Dashboard</h1>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-neutral-500" />
                  <span className="text-sm text-neutral-500">Period:</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Select value={monthFilter.toString()} onValueChange={(v) => setMonthFilter(parseInt(v))}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map(month => (
                        <SelectItem key={month.value} value={month.value.toString()}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={yearFilter.toString()} onValueChange={(v) => setYearFilter(parseInt(v))}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            {/* Dashboard stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Claimed Payments Overview Card */}
              <Card className="col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Claimed Payments Overview</CardTitle>
                  <CardDescription className="text-xs">
                    Month to date
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-neutral-500">Total Claimed Payment</p>
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-semibold">{dashboardStats.totalTripCost.toFixed(2)}</p>
                        <span className="text-primary-500 font-bold text-sm bg-primary-50 px-2 py-1 rounded-md">JD</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-neutral-500">Pending Claims</p>
                          <Badge variant="outline" className="text-amber-500 bg-amber-50 border-amber-200">
                            {dashboardStats.pendingApprovalCost.toFixed(2)} JD
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-neutral-500">Approved Claims</p>
                          <Badge variant="outline" className="text-green-500 bg-green-50 border-green-200">
                            {dashboardStats.approvedTripCost.toFixed(2)} JD
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-neutral-500">Rejected Claims</p>
                          <Badge variant="outline" className="text-red-500 bg-red-50 border-red-200">
                            {dashboardStats.pendingRejectionCost.toFixed(2)} JD
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-neutral-500">Paid Claims</p>
                          <Badge variant="outline" className="text-blue-500 bg-blue-50 border-blue-200">
                            {dashboardStats.paidTripCost.toFixed(2)} JD
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Recent Activity Card */}
              <Card className="col-span-1 md:col-span-2">
                <Tabs defaultValue="overview">
                  <CardHeader className="pb-0">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">Recent Activity</CardTitle>
                      <TabsList>
                        <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                        <TabsTrigger value="requests" className="text-xs">Recent Requests</TabsTrigger>
                      </TabsList>
                    </div>
                    <CardDescription className="text-xs">
                      Your activity for {months.find(m => m.value === monthFilter)?.label} {yearFilter}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="pt-4">
                    <TabsContent value="overview" className="mt-0 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Status Summary */}
                        <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-100">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs text-neutral-500">Pending</p>
                              <p className="text-lg font-semibold text-amber-500">{dashboardStats.pendingCount}</p>
                            </div>
                            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                              <Clock className="h-4 w-4 text-amber-500" />
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-100">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs text-neutral-500">Approved</p>
                              <p className="text-lg font-semibold text-green-500">{dashboardStats.approvedCount}</p>
                            </div>
                            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                              <Clipboard className="h-4 w-4 text-green-500" />
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-100">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs text-neutral-500">Rejected</p>
                              <p className="text-lg font-semibold text-red-500">{dashboardStats.rejectedCount}</p>
                            </div>
                            <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                              <ArrowDownRight className="h-4 w-4 text-red-500" />
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-100">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs text-neutral-500">Paid</p>
                              <p className="text-lg font-semibold text-blue-500">{dashboardStats.paidCount}</p>
                            </div>
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <ArrowUpRight className="h-4 w-4 text-blue-500" />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Monthly Activity Summary Chart */}
                      <div className="h-[160px] bg-white rounded-lg border border-neutral-100">
                        {chartData.length === 0 ? (
                          <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                              <BarChartIcon className="h-8 w-8 mx-auto text-neutral-300" />
                              <p className="text-sm text-neutral-400 mt-2">No activity data for this period</p>
                            </div>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 5, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                              <XAxis 
                                dataKey="day" 
                                tick={{ fontSize: 10 }}
                                tickFormatter={(day) => `Day ${day}`}
                                axisLine={{ stroke: '#E5E7EB' }}
                                tickLine={{ stroke: '#E5E7EB' }}
                              />
                              <YAxis 
                                tick={{ fontSize: 10 }} 
                                width={40}
                                tickCount={5}
                                axisLine={{ stroke: '#E5E7EB' }}
                                tickLine={{ stroke: '#E5E7EB' }}
                                allowDecimals={false}
                              />
                              <Tooltip 
                                formatter={(value: any) => Number(value) > 0 ? [Math.round(Number(value)), 'requests'] : [0, 'requests']}
                                labelFormatter={(day) => `Day ${day}`}
                              />
                              <Bar dataKey="Pending" name="Pending" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} maxBarSize={18} />
                              <Bar dataKey="Approved" name="Approved" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} maxBarSize={18} />
                              <Bar dataKey="Rejected" name="Rejected" stackId="a" fill="#EF4444" radius={[0, 0, 0, 0]} maxBarSize={18} />
                              <Bar dataKey="Paid" name="Paid" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} maxBarSize={18} />
                              <Bar dataKey="Cancelled" name="Cancelled" stackId="a" fill="#6B7280" radius={[0, 0, 0, 0]} maxBarSize={18} />
                              <Legend 
                                iconSize={8} 
                                wrapperStyle={{ fontSize: 10, paddingTop: 5 }}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="requests" className="mt-0">
                      <div className="space-y-3">
                        {dashboardStats.recentRequests.length > 0 ? (
                          dashboardStats.recentRequests.map((req, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 hover:bg-neutral-50">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-primary-50 flex items-center justify-center">
                                  {'tripDate' in req ? (
                                    <Car className="h-5 w-5 text-primary-500" />
                                  ) : (
                                    <Clipboard className="h-5 w-5 text-primary-500" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">
                                    {'tripDate' in req ? (
                                      <>
                                        Trip request: {req.origin} to {req.destination}
                                        {req.tripCost && ` - Claimed: ${typeof req.tripCost === 'string' ? parseFloat(req.tripCost).toFixed(2) : req.tripCost.toFixed(2)} JD`}
                                      </>
                                    ) : (
                                      <>Administrative request: {req.requestType || 'General'}</>
                                    )}
                                  </p>
                                  <p className="text-xs text-neutral-500">
                                    {req.createdAt ? format(new Date(req.createdAt), 'MMM dd, yyyy') : 'Unknown date'}
                                  </p>
                                </div>
                              </div>
                              <Badge 
                                className={`text-xs ${
                                  req.status === 'Approved' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 
                                  req.status === 'Rejected' ? 'bg-red-100 text-red-700 hover:bg-red-100' : 
                                  req.status === 'Paid' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                                  req.status === 'Cancelled' ? 'bg-neutral-100 text-neutral-700 hover:bg-neutral-100' :
                                  'bg-amber-100 text-amber-700 hover:bg-amber-100'
                                }`}
                              >
                                {req.status}
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6">
                            <p className="text-neutral-500">No requests found for this period</p>
                          </div>
                        )}
                        
                        {dashboardStats.recentRequests.length > 0 && (
                          <div className="flex justify-center pt-2">
                            <Link href="/all-requests">
                              <Button variant="outline" size="sm">
                                View All Requests
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </CardContent>
                </Tabs>
              </Card>
            </div>
            
            {/* Quick Actions Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-2">
              {/* Only show Trip Request for Employees (and Managers in Employee mode) */}
              {(user?.role !== 'Manager' || user?.activeRole === 'Employee') && (
                <Link href="/trip-requests">
                  <Card className="hover:bg-neutral-50 cursor-pointer transition-colors">
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium">New Trip Request</p>
                        <p className="text-xs text-neutral-500">Create a new transportation request</p>
                      </div>
                      <div className="h-9 w-9 rounded-full bg-primary-50 flex items-center justify-center">
                        <Car className="h-5 w-5 text-primary-500" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )}
              
              <Link href="/admin-requests">
                <Card className="hover:bg-neutral-50 cursor-pointer transition-colors">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium">New Admin Request</p>
                      <p className="text-xs text-neutral-500">Submit an administrative request</p>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-primary-50 flex items-center justify-center">
                      <Clipboard className="h-5 w-5 text-primary-500" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
              
              {((['Manager', 'Finance', 'Admin'].includes(user?.role || '')) ||
                ['Manager', 'Finance', 'Admin'].includes(user?.activeRole || '')) && (
                <Link href="/approvals">
                  <Card className="hover:bg-neutral-50 cursor-pointer transition-colors">
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium">Pending Approvals</p>
                        <p className="text-xs text-neutral-500">Review and approve requests</p>
                      </div>
                      <div className="h-9 w-9 rounded-full bg-primary-50 flex items-center justify-center">
                        <Clipboard className="h-5 w-5 text-primary-500" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )}
              
              <Link href="/all-requests">
                <Card className="hover:bg-neutral-50 cursor-pointer transition-colors">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium">View All Requests</p>
                      <p className="text-xs text-neutral-500">See all your requests in one place</p>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-primary-50 flex items-center justify-center">
                      <BarChart className="h-5 w-5 text-primary-500" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}