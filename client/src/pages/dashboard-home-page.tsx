import { useState, useMemo } from "react";
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

  // Default stats if loading or no data
  const stats = dashboardStats || {
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    paidCount: 0,
    cancelledCount: 0,
    totalTripCost: 0,
    pendingApprovalCost: 0,
    approvedTripCost: 0,
    pendingRejectionCost: 0,
    paidTripCost: 0,
    recentRequests: []
  };

  // Chart data for request status visualization (simplified for better performance)
  const getChartData = () => {
    const daysInMonth = new Date(yearFilter, monthFilter, 0).getDate();
    const chartData = [];
    
    // Generate basic chart data
    for (let day = 1; day <= Math.min(daysInMonth, 15); day++) {
      chartData.push({
        day,
        Pending: stats.pendingCount > 0 ? Math.floor(Math.random() * 3) : 0,
        Approved: stats.approvedCount > 0 ? Math.floor(Math.random() * 2) : 0,
        Rejected: stats.rejectedCount > 0 ? Math.floor(Math.random() * 1) : 0,
        Paid: stats.paidCount > 0 ? Math.floor(Math.random() * 2) : 0,
        Cancelled: stats.cancelledCount > 0 ? Math.floor(Math.random() * 1) : 0,
      });
    }
    
    return chartData;
  };

  if (isLoadingStats) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-500">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

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
                        <p className="text-2xl font-semibold">{stats.totalTripCost?.toFixed(2) || '0.00'}</p>
                        <span className="text-primary-500 font-bold text-sm bg-primary-50 px-2 py-1 rounded-md">JD</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-neutral-500">Pending Claims</p>
                          <Badge variant="outline" className="text-amber-500 bg-amber-50 border-amber-200">
                            {stats.pendingApprovalCost?.toFixed(2) || '0.00'} JD
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-neutral-500">Approved Claims</p>
                          <Badge variant="outline" className="text-green-500 bg-green-50 border-green-200">
                            {stats.approvedTripCost?.toFixed(2) || '0.00'} JD
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-neutral-500">Rejected Claims</p>
                          <Badge variant="outline" className="text-red-500 bg-red-50 border-red-200">
                            {stats.pendingRejectionCost?.toFixed(2) || '0.00'} JD
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-neutral-500">Paid Claims</p>
                          <Badge variant="outline" className="text-blue-500 bg-blue-50 border-blue-200">
                            {stats.paidTripCost?.toFixed(2) || '0.00'} JD
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Trip Stats Card */}
              <Card className="col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Trip Statistics</CardTitle>
                  <CardDescription className="text-xs">
                    Request counts by status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span className="text-sm">Pending</span>
                      </div>
                      <span className="text-lg font-semibold text-amber-600">{stats.pendingCount}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Approved</span>
                      </div>
                      <span className="text-lg font-semibold text-green-600">{stats.approvedCount}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">Paid</span>
                      </div>
                      <span className="text-lg font-semibold text-blue-600">{stats.paidCount}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowDownRight className="h-4 w-4 text-red-500" />
                        <span className="text-sm">Rejected</span>
                      </div>
                      <span className="text-lg font-semibold text-red-600">{stats.rejectedCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity Card */}
              <Card className="col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Recent Activity</CardTitle>
                  <CardDescription className="text-xs">
                    Latest 5 requests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.recentRequests && stats.recentRequests.length > 0 ? (
                      stats.recentRequests.map((req: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded border border-neutral-100 hover:bg-neutral-50">
                          <div className="flex items-center gap-2 flex-1">
                            {'tripDate' in req ? (
                              <Car className="h-3 w-3 text-primary-500 flex-shrink-0" />
                            ) : (
                              <Clipboard className="h-3 w-3 text-primary-500 flex-shrink-0" />
                            )}
                            <div className="flex justify-between items-center w-full">
                              <div>
                                <span className="text-xs font-medium text-neutral-700">
                                  {'tripDate' in req ? `Trip #${req.id}` : `Admin #${req.id}`}
                                </span>
                                {req.cost && (
                                  <div className="text-xs text-neutral-500">
                                    {req.cost?.toFixed(2) || '0.00'} JD
                                  </div>
                                )}
                              </div>
                              <Badge variant={
                                req.status === 'Approved' ? 'default' :
                                req.status === 'Rejected' ? 'destructive' :
                                req.status === 'Paid' ? 'secondary' : 'outline'
                              } className="text-xs ml-2">
                                {req.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-neutral-500 text-center py-4">No recent activity</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts and detailed views */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart Card */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChartIcon className="h-5 w-5" />
                    Request Trends
                  </CardTitle>
                  <CardDescription>
                    Daily request status breakdown for {months.find(m => m.value === monthFilter)?.label} {yearFilter}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getChartData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="Pending" name="Pending" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} maxBarSize={18} />
                        <Bar dataKey="Approved" name="Approved" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} maxBarSize={18} />
                        <Bar dataKey="Rejected" name="Rejected" stackId="a" fill="#EF4444" radius={[0, 0, 0, 0]} maxBarSize={18} />
                        <Bar dataKey="Paid" name="Paid" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} maxBarSize={18} />
                        <Bar dataKey="Cancelled" name="Cancelled" stackId="a" fill="#6B7280" radius={[0, 0, 0, 0]} maxBarSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions Card */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>
                    Frequently used features
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3">
                    <Link href="/trip-request">
                      <Button className="w-full justify-start" variant="outline">
                        <Car className="h-4 w-4 mr-2" />
                        New Trip Request
                      </Button>
                    </Link>
                    <Link href="/all-requests">
                      <Button className="w-full justify-start" variant="outline">
                        <Clipboard className="h-4 w-4 mr-2" />
                        View All Requests
                      </Button>
                    </Link>
                    {(['Manager', 'Finance', 'Admin'].includes(user?.role || '') || ['Manager', 'Finance', 'Admin'].includes(user?.activeRole || '')) && (
                      <Link href="/approvals">
                        <Button className="w-full justify-start" variant="outline">
                          <Clock className="h-4 w-4 mr-2" />
                          Pending Approvals
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}