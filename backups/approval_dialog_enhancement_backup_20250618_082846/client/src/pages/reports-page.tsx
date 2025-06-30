import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Loader2 } from "lucide-react";

export default function ReportsPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  
  // Fetch monthly report data
  const { data: reportData, isLoading } = useQuery({
    queryKey: ["/api/reports/monthly", month, year],
    queryFn: async () => {
      const res = await fetch(`/api/reports/monthly?month=${month}&year=${year}`);
      if (!res.ok) {
        throw new Error("Failed to fetch report data");
      }
      return res.json();
    }
  });

  // Generate years for the dropdown (last 5 years)
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Generate months for the dropdown
  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  // Colors for the pie chart
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  // Prepare data for the request status pie chart
  const getRequestStatusData = () => {
    if (!reportData) return [];
    
    return [
      { name: 'Approved', value: reportData.totalApproved },
      { name: 'Rejected', value: reportData.totalRejected },
      { name: 'Pending', value: reportData.totalPending },
    ];
  };

  // Prepare data for the department budget utilization bar chart
  const getDepartmentBudgetData = () => {
    if (!reportData || !reportData.departmentStats) return [];
    
    return reportData.departmentStats.map((dept: any) => ({
      name: dept.departmentName,
      budget: dept.budget,
      spent: dept.spent,
      remaining: dept.remaining,
    }));
  };

  // Prepare data for the project budget utilization bar chart
  const getProjectBudgetData = () => {
    if (!reportData || !reportData.projectStats) return [];
    
    return reportData.projectStats.map((proj: any) => ({
      name: proj.projectName,
      budget: proj.budget,
      spent: proj.spent,
      remaining: proj.remaining,
    }));
  };

  const requestStatusData = getRequestStatusData();
  const departmentBudgetData = getDepartmentBudgetData();
  const projectBudgetData = getProjectBudgetData();

  return (
    <Layout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <h1 className="text-2xl font-semibold text-neutral-600">Monthly Reports</h1>
          <p className="mt-1 text-sm text-neutral-400">
            View monthly trip request statistics and budget utilization reports.
          </p>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="mt-6 bg-white shadow rounded-lg p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 mb-6">
              <h2 className="text-lg font-medium text-neutral-600">Monthly Report</h2>
              
              <div className="flex space-x-4">
                <Select
                  value={month.toString()}
                  onValueChange={(value) => setMonth(parseInt(value))}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select
                  value={year.toString()}
                  onValueChange={(value) => setYear(parseInt(value))}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button variant="outline">
                  Export PDF
                </Button>
              </div>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center my-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !reportData ? (
              <div className="text-center py-8">
                <p className="text-neutral-500">No report data available for the selected period.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-neutral-500">Total Requests</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{reportData.totalRequests || 0}</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-neutral-500">Approved Requests</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">{reportData.totalApproved || 0}</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-neutral-500">Total Cost Approved</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary-500">${reportData.totalApprovedCost?.toFixed(2) || '0.00'}</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-neutral-500">Over Budget Approvals</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-amber-500">{reportData.overBudgetApprovals || 0}</div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Charts */}
                <Tabs defaultValue="requests">
                  <TabsList>
                    <TabsTrigger value="requests">Request Status</TabsTrigger>
                    <TabsTrigger value="departments">Department Budgets</TabsTrigger>
                    <TabsTrigger value="projects">Project Budgets</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="requests" className="mt-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Request Status Distribution</CardTitle>
                        <CardDescription>
                          Breakdown of trip requests by status for {months.find(m => m.value === month)?.label} {year}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={requestStatusData}
                                cx="50%"
                                cy="50%"
                                labelLine={true}
                                outerRadius={120}
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              >
                                {requestStatusData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => [value, 'Count']} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="departments" className="mt-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Department Budget Utilization</CardTitle>
                        <CardDescription>
                          Budget allocation and spending by department for {months.find(m => m.value === month)?.label} {year}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {departmentBudgetData.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-neutral-500">No department budget data available.</p>
                          </div>
                        ) : (
                          <>
                            <div className="h-80">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={departmentBudgetData}
                                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" />
                                  <YAxis />
                                  <Tooltip formatter={(value) => [`$${value}`, 'Amount']} />
                                  <Legend />
                                  <Bar dataKey="budget" name="Budget" fill="#8884d8" />
                                  <Bar dataKey="spent" name="Spent" fill="#82ca9d" />
                                  <Bar dataKey="remaining" name="Remaining" fill="#ffc658" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            
                            <Table className="mt-6">
                              <TableCaption>Department Budget Details</TableCaption>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Department</TableHead>
                                  <TableHead className="text-right">Budget</TableHead>
                                  <TableHead className="text-right">Spent</TableHead>
                                  <TableHead className="text-right">Remaining</TableHead>
                                  <TableHead className="text-right">Approved Trips</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {reportData.departmentStats.map((dept: any) => (
                                  <TableRow key={dept.departmentName}>
                                    <TableCell>{dept.departmentName}</TableCell>
                                    <TableCell className="text-right">${dept.budget.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">${dept.spent.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">${dept.remaining.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">{dept.approvedTrips}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="projects" className="mt-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Project Budget Utilization</CardTitle>
                        <CardDescription>
                          Budget allocation and spending by project for {months.find(m => m.value === month)?.label} {year}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {projectBudgetData.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-neutral-500">No project budget data available.</p>
                          </div>
                        ) : (
                          <>
                            <div className="h-80">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={projectBudgetData}
                                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" />
                                  <YAxis />
                                  <Tooltip formatter={(value) => [`$${value}`, 'Amount']} />
                                  <Legend />
                                  <Bar dataKey="budget" name="Budget" fill="#8884d8" />
                                  <Bar dataKey="spent" name="Spent" fill="#82ca9d" />
                                  <Bar dataKey="remaining" name="Remaining" fill="#ffc658" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            
                            <Table className="mt-6">
                              <TableCaption>Project Budget Details</TableCaption>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Project</TableHead>
                                  <TableHead className="text-right">Budget</TableHead>
                                  <TableHead className="text-right">Spent</TableHead>
                                  <TableHead className="text-right">Remaining</TableHead>
                                  <TableHead className="text-right">Approved Trips</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {reportData.projectStats.map((proj: any) => (
                                  <TableRow key={proj.projectName}>
                                    <TableCell>{proj.projectName}</TableCell>
                                    <TableCell className="text-right">${proj.budget.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">${proj.spent.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">${proj.remaining.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">{proj.approvedTrips}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
