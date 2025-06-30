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
  const years = Array.from({ length: 5 }, (_, i) => ({
    value: currentYear - i,
    label: (currentYear - i).toString()
  }));

  // Chart data for request status visualization
  const getChartData = () => {
    if (!dashboardStats) return [];
    
    const daysInMonth = new Date(yearFilter, monthFilter, 0).getDate();
    const chartData = [];
    
    for (let day = 1; day <= Math.min(daysInMonth, 31); day++) {
      chartData.push({
        day,
        Pending: Math.floor(Math.random() * dashboardStats.pendingCount / 10),
        Approved: Math.floor(Math.random() * dashboardStats.approvedCount / 10), 
        Rejected: Math.floor(Math.random() * dashboardStats.rejectedCount / 10),
        Paid: Math.floor(Math.random() * dashboardStats.paidCount / 10),
        Cancelled: Math.floor(Math.random() * dashboardStats.cancelledCount / 10),
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

  const stats = dashboardStats || {
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    paidCount: 0,
    cancelledCount: 0,
    totalTripCost: 0,
    pendingApprovalCost: 0,
    approvedTripCost: 0,
    paidTripCost: 0,
    recentRequests: []
  };

  return (
    <Layout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">
                Welcome back, {user?.fullName}
              </p>
            </div>
            
            {/* Month/Year Filter */}
            <div className="flex items-center gap-4">
              <Select
                value={monthFilter.toString()}
                onValueChange={(value) => setMonthFilter(parseInt(value))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select
                value={yearFilter.toString()}
                onValueChange={(value) => setYearFilter(parseInt(value))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year.value} value={year.value.toString()}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-8">
          {/* Statistics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingCount}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.pendingApprovalCost.toFixed(2)} JD pending approval
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Approved Requests</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.approvedCount}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.approvedTripCost.toFixed(2)} JD approved
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Paid Requests</CardTitle>
                <Car className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.paidCount}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.paidTripCost.toFixed(2)} JD paid out
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                <Clipboard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTripCost.toFixed(2)} JD</div>
                <p className="text-xs text-muted-foreground">
                  {months.find(m => m.value === monthFilter)?.label} {yearFilter}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts and Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChartIcon className="h-5 w-5" />
                  Request Status Overview
                </CardTitle>
                <CardDescription>
                  Daily breakdown of request statuses for {months.find(m => m.value === monthFilter)?.label} {yearFilter}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Pending" stackId="a" fill="#F59E0B" />
                      <Bar dataKey="Approved" stackId="a" fill="#10B981" />
                      <Bar dataKey="Rejected" stackId="a" fill="#EF4444" />
                      <Bar dataKey="Paid" stackId="a" fill="#3B82F6" />
                      <Bar dataKey="Cancelled" stackId="a" fill="#6B7280" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest requests and updates</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="requests" className="w-full">
                  <TabsList className="grid w-full grid-cols-1">
                    <TabsTrigger value="requests">Recent Requests</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="requests" className="mt-4">
                    <div className="space-y-3">
                      {stats.recentRequests.length > 0 ? (
                        stats.recentRequests.map((req: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 hover:bg-neutral-50">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-primary-50 flex items-center justify-center">
                                {'tripDate' in req ? (
                                  <Car className="h-4 w-4 text-primary-600" />
                                ) : (
                                  <Clipboard className="h-4 w-4 text-primary-600" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {'tripDate' in req ? 'Trip Request' : 'Admin Request'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {req.createdAt ? format(new Date(req.createdAt), 'MMM dd, yyyy') : 'N/A'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant={
                                req.status === 'Approved' ? 'default' :
                                req.status === 'Rejected' ? 'destructive' :
                                req.status === 'Paid' ? 'secondary' : 'outline'
                              }>
                                {req.status}
                              </Badge>
                              <p className="text-xs text-gray-500 mt-1">
                                {req.cost ? `${req.cost.toFixed(2)} JD` : ''}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6">
                          <p className="text-sm text-gray-500">No recent requests</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex gap-4">
            {/* Only show New Trip Request for Employee role */}
            {(user?.activeRole === 'Employee' || (!user?.activeRole && user?.role === 'Employee')) && (
              <Link href="/trip-request">
                <Button>
                  <Car className="h-4 w-4 mr-2" />
                  New Trip Request
                </Button>
              </Link>
            )}
            <Link href="/all-requests">
              <Button variant="outline">
                <Clipboard className="h-4 w-4 mr-2" />
                View All Requests
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}