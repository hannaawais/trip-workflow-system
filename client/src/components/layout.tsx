import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "wouter";
import SidebarNav from "@/components/ui/sidebar-nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { BellIcon, ChevronDownIcon, LogOut, User, Settings, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { user, logoutMutation, toggleRoleMutation } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { toast } = useToast();

  if (!user) {
    navigate("/auth");
    return null;
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  const handleToggleRole = () => {
    toggleRoleMutation.mutate(undefined, {
      onSuccess: (updatedUser) => {
        toast({
          title: "Role switched",
          description: `You are now in ${updatedUser.activeRole || 'Manager'} mode.`
        });
        
        // Navigate away from role-restricted pages
        const currentRole = updatedUser.activeRole || 'Manager';
        
        // If switching to Employee mode, navigate away from Manager-only pages
        if (currentRole === 'Employee' && 
          (location === '/reports' || 
           location === '/approvals' || 
           location === '/budget' ||
           location === '/projects' ||
           location === '/admin' ||
           location === '/audit-logs')) {
          navigate('/');
        }
        
        // If switching to Manager mode, navigate away from Employee-only pages
        if (currentRole === 'Manager' && 
          (location === '/trip-requests' || 
           location === '/trip-request')) {
          navigate('/');
        }
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-white shadow z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-10 w-10 text-primary">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
            <h1 className="ml-3 text-xl font-semibold text-neutral-600">Trip Transportation Workflow</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Notifications Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                  <BellIcon className="h-5 w-5" />
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-destructive"></span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="p-2 font-medium">Notifications</div>
                <DropdownMenuSeparator />
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No new notifications
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* User Menu */}
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center space-x-2 cursor-pointer">
                    <div className="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center text-white">
                      {user.fullName.charAt(0)}
                    </div>
                    <span className="ml-2 text-sm font-medium text-neutral-500 hidden md:inline-block">
                      {user.fullName}
                    </span>
                    <ChevronDownIcon className="h-4 w-4 text-neutral-400" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="p-2 text-sm">
                    <div className="font-medium">{user.fullName}</div>
                    <div className="text-muted-foreground">{user.email}</div>
                    <div className="text-xs text-muted-foreground mt-1">{user.role}</div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="cursor-pointer"
                    onClick={() => navigate("/profile")}
                  >
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  
                  {(user.role === 'Manager' || user.activeRole === 'Manager') && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        onClick={handleToggleRole}
                        disabled={toggleRoleMutation.isPending}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {user.activeRole === 'Employee' ? 'Switch to Manager Mode' : 'Switch to Employee Mode'}
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="cursor-pointer" 
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:block h-[calc(100vh-4rem)]">
          <SidebarNav />
        </div>

        {/* Mobile Menu Button - only visible on small screens */}
        <div className="md:hidden p-4">
          <Button 
            variant="outline" 
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="ml-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="ml-2">Menu</span>
          </Button>
          
          {/* Mobile sidebar - slide over */}
          {mobileNavOpen && (
            <div className="fixed inset-0 z-40 flex">
              <div className="fixed inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)}></div>
              <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
                <div className="flex justify-end p-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
                <SidebarNav />
              </div>
            </div>
          )}
        </div>
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 focus:outline-none transition-all duration-300 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
