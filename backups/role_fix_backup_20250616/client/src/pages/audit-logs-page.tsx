import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2, Search, Filter, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function AuditLogsPage() {
  // State for filters
  const [textFilter, setTextFilter] = useState("");
  const [actionTypeFilter, setActionTypeFilter] = useState<string | null>(null);
  const [userIdFilter, setUserIdFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Fetch audit logs
  const { data: auditLogs, isLoading: isLoadingAuditLogs, refetch } = useQuery({
    queryKey: ["/api/audit-logs"],
  });
  
  // Fetch users for user filter dropdown
  const { data: users } = useQuery({
    queryKey: ["/api/users"],
  });
  
  // Create a list of unique action types for filtering
  const actionTypes = auditLogs 
    ? [...new Set(auditLogs.map((log: any) => log.action))]
    : [];
  
  // Filter audit logs based on selected filters
  const filteredAuditLogs = auditLogs ? auditLogs.filter((log: any) => {
    // Text filter - search in action and details
    if (textFilter && textFilter.trim() !== "") {
      const textLower = textFilter.toLowerCase();
      const actionMatch = log.action.toLowerCase().includes(textLower);
      const detailsMatch = log.details ? JSON.stringify(log.details).toLowerCase().includes(textLower) : false;
      
      if (!actionMatch && !detailsMatch) {
        return false;
      }
    }
    
    // Action type filter
    if (actionTypeFilter && actionTypeFilter !== "all" && log.action !== actionTypeFilter) {
      return false;
    }
    
    // User ID filter
    if (userIdFilter && userIdFilter !== "all" && log.userId.toString() !== userIdFilter) {
      return false;
    }
    
    // Date filter
    if (dateFilter) {
      const logDate = new Date(log.createdAt);
      if (
        logDate.getDate() !== dateFilter.getDate() ||
        logDate.getMonth() !== dateFilter.getMonth() ||
        logDate.getFullYear() !== dateFilter.getFullYear()
      ) {
        return false;
      }
    }
    
    return true;
  }).sort((a: any, b: any) => {
    // Sort by date (newest first)
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  }) : [];
  
  // Clear all filters
  const clearFilters = () => {
    setTextFilter("");
    setActionTypeFilter(null);
    setUserIdFilter(null);
    setDateFilter(null);
  };
  
  // Get user name by ID
  const getUserName = (userId: number) => {
    if (!users) return userId;
    const user = users.find((u: any) => u.id === userId);
    return user ? `${user.fullName} (${userId})` : userId;
  };
  
  // Action type badge style
  const getActionBadgeStyle = (action: string) => {
    if (action.includes('CREATED') || action.includes('CREATE')) {
      return 'bg-green-100 text-green-800';
    } else if (action.includes('UPDATED') || action.includes('UPDATE')) {
      return 'bg-blue-100 text-blue-800';
    } else if (action.includes('DELETED') || action.includes('DELETE')) {
      return 'bg-red-100 text-red-800';
    } else if (action.includes('LOGGED')) {
      return 'bg-purple-100 text-purple-800';
    } else if (action.includes('APPROVED') || action.includes('APPROVE')) {
      return 'bg-emerald-100 text-emerald-800';
    } else if (action.includes('REJECTED') || action.includes('REJECT')) {
      return 'bg-amber-100 text-amber-800';
    } else {
      return 'bg-gray-100 text-gray-800';
    }
  };
  
  return (
    <Layout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <h1 className="text-2xl font-semibold text-neutral-600">Audit Logs</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Track and monitor all system activities and changes
          </p>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-5">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>System Audit Logs</CardTitle>
                  <CardDescription>
                    A detailed history of all actions performed in the system
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {showFilters ? "Hide Filters" : "Show Filters"}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => refetch()}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {/* Search and filters */}
              <div className="mb-6">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                    <Input
                      placeholder="Search in logs..."
                      className="pl-8"
                      value={textFilter}
                      onChange={(e) => setTextFilter(e.target.value)}
                    />
                  </div>
                  {filteredAuditLogs && (
                    <div className="text-sm text-neutral-500">
                      Found {filteredAuditLogs.length} {filteredAuditLogs.length === 1 ? 'entry' : 'entries'}
                    </div>
                  )}
                </div>
                
                {showFilters && (
                  <Accordion type="single" collapsible className="border rounded-md p-2 mb-4">
                    <AccordionItem value="filters" className="border-0">
                      <AccordionTrigger className="py-2">Advanced Filters</AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
                          <div>
                            <label className="text-sm font-medium">Action Type</label>
                            <Select 
                              value={actionTypeFilter || ""}
                              onValueChange={(value) => setActionTypeFilter(value || null)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="All actions" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All actions</SelectItem>
                                {actionTypes.map((action: string) => (
                                  <SelectItem key={action} value={action}>
                                    {action}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium">User</label>
                            <Select 
                              value={userIdFilter || ""}
                              onValueChange={(value) => setUserIdFilter(value || null)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="All users" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All users</SelectItem>
                                {users && users.map((user: any) => (
                                  <SelectItem key={user.id} value={user.id.toString()}>
                                    {user.fullName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium">Date</label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-start text-left font-normal"
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {dateFilter ? (
                                    format(dateFilter, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={dateFilter || undefined}
                                  onSelect={(date) => setDateFilter(date)}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          
                          <div className="flex items-end">
                            <Button 
                              variant="secondary" 
                              onClick={clearFilters}
                              className="w-full"
                            >
                              Clear All Filters
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              
                {/* Audit logs table */}
                {isLoadingAuditLogs ? (
                  <div className="flex justify-center my-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : !filteredAuditLogs || filteredAuditLogs.length === 0 ? (
                  <div className="text-center py-8 border rounded-md">
                    <p className="text-neutral-500">No audit logs found matching your filters.</p>
                    {(textFilter || actionTypeFilter || userIdFilter || dateFilter) && (
                      <Button 
                        variant="link" 
                        onClick={clearFilters}
                        className="mt-2"
                      >
                        Clear all filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date/Time</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead className="w-1/3">Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAuditLogs.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell>
                              {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                            </TableCell>
                            <TableCell>{getUserName(log.userId)}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs ${getActionBadgeStyle(log.action)}`}>
                                {log.action}
                              </span>
                            </TableCell>
                            <TableCell>
                              {log.details ? (
                                <div className="max-h-20 overflow-auto text-xs">
                                  <pre className="whitespace-pre-wrap break-words">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </div>
                              ) : (
                                <span className="text-neutral-400 text-xs">No details available</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
            
            <CardFooter className="flex justify-between border-t pt-6">
              <div className="text-sm text-neutral-500">
                {auditLogs && auditLogs.length > 0 ? (
                  <span>Showing {filteredAuditLogs.length} of {auditLogs.length} log entries</span>
                ) : (
                  <span>No audit logs available</span>
                )}
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </Layout>
  );
}