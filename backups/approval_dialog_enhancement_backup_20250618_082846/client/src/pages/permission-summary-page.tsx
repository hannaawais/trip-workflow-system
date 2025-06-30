import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, Search, Shield, Users, Eye } from "lucide-react";
import { useState } from "react";

interface PermissionSummary {
  id: number;
  fullName: string;
  username: string;
  role: string;
  department: string;
  isActive: boolean;
  tripScope: string;
  approvalCapabilities: string;
  adminAccess: string;
  specialPermissions: string;
  visibleTripCount: number;
  visibleAdminCount: number;
}

export default function PermissionSummaryPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: permissionData, isLoading, error } = useQuery<PermissionSummary[]>({
    queryKey: ["/api/admin/permission-summary"],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <Shield className="h-12 w-12 mx-auto mb-4" />
              <p>Failed to load permission data. Please try again.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter data based on search term
  const filteredData = permissionData?.filter(user =>
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.department.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Export to CSV function
  const exportToCSV = () => {
    const headers = [
      'Full Name',
      'Username', 
      'Role',
      'Department',
      'Active',
      'Trip Access Scope',
      'Approval Capabilities',
      'Admin Access',
      'Special Permissions',
      'Visible Trips',
      'Visible Admin Requests'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredData.map(user => [
        `"${user.fullName}"`,
        `"${user.username}"`,
        `"${user.role}"`,
        `"${user.department}"`,
        user.isActive ? 'Yes' : 'No',
        `"${user.tripScope}"`,
        `"${user.approvalCapabilities}"`,
        `"${user.adminAccess}"`,
        `"${user.specialPermissions}"`,
        user.visibleTripCount,
        user.visibleAdminCount
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `permission-summary-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Role color mapping
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-red-100 text-red-800';
      case 'Finance': return 'bg-green-100 text-green-800';
      case 'Manager': return 'bg-blue-100 text-blue-800';
      case 'Employee': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Stats summary
  const stats = {
    totalUsers: filteredData.length,
    activeUsers: filteredData.filter(u => u.isActive).length,
    adminUsers: filteredData.filter(u => u.role === 'Admin').length,
    managerUsers: filteredData.filter(u => u.role === 'Manager').length
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Permission Summary
          </h1>
          <p className="text-muted-foreground mt-1">
            View computed permissions for all users based on current organizational structure
          </p>
        </div>
        <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeUsers}</p>
              </div>
              <Eye className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Admin Users</p>
                <p className="text-2xl font-bold text-red-600">{stats.adminUsers}</p>
              </div>
              <Shield className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Managers</p>
                <p className="text-2xl font-bold text-blue-600">{stats.managerUsers}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, username, role, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Permission Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Permission Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Trip Access Scope</TableHead>
                  <TableHead>Approval Capabilities</TableHead>
                  <TableHead>Admin Access</TableHead>
                  <TableHead>Special Permissions</TableHead>
                  <TableHead className="text-center">Visible Trips</TableHead>
                  <TableHead className="text-center">Visible Admin</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.fullName}</p>
                        <p className="text-sm text-muted-foreground">@{user.username}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleColor(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.department}</TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="text-sm break-words">{user.tripScope}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="text-sm break-words">{user.approvalCapabilities}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="text-sm break-words">{user.adminAccess}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="text-sm break-words">{user.specialPermissions}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{user.visibleTripCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{user.visibleAdminCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={user.isActive ? "default" : "destructive"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No users found matching your search criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Information Footer */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Note:</strong> This view shows computed permissions based on current database relationships.</p>
            <p><strong>Trip Access Scope:</strong> Shows which trip requests each user can view.</p>
            <p><strong>Approval Capabilities:</strong> Shows what each user can approve based on their role and assignments.</p>
            <p><strong>Admin Access:</strong> Shows administrative capabilities for system management.</p>
            <p><strong>Real-time Data:</strong> All permissions are calculated directly from the database - no caching.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}