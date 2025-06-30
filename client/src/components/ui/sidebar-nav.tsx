import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  ClipboardCheck,
  BarChart,
  Settings,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Menu,
  Car,
  MapPin,
  TrendingUp
} from "lucide-react";
import JDCurrencyIcon from "@/components/jd-currency-icon";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  roles?: string[];
  collapsed: boolean;
}

// Local storage key for saving sidebar state
const SIDEBAR_STATE_KEY = 'sidebarCollapsed';

export default function SidebarNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    // Initialize from localStorage if available, otherwise use screen width logic
    const savedState = localStorage.getItem(SIDEBAR_STATE_KEY);
    
    if (savedState !== null) {
      return savedState === 'true';
    }
    
    // Default to collapsed on smaller screens
    return window.innerWidth < 1280;
  });
  const [isHovering, setIsHovering] = useState(false);
  // Keep track of whether the sidebar is in auto-collapse mode due to hover
  const [autoCollapse, setAutoCollapse] = useState(false);

  // Collapse timer for smoother transitions
  const [collapseTimer, setCollapseTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Helper function to expand the sidebar
  const expandSidebar = () => {
    setIsHovering(true);
    if (collapsed) {
      setAutoCollapse(true);
      setCollapsed(false);
    }
    // Clear any existing collapse timer
    if (collapseTimer) {
      clearTimeout(collapseTimer);
      setCollapseTimer(null);
    }
  };
  
  // Helper function to collapse the sidebar with a small delay
  const collapseSidebar = () => {
    setIsHovering(false);
    if (autoCollapse) {
      // Set a small delay before collapsing to prevent flickering
      const timer = setTimeout(() => {
        setCollapsed(true);
        setAutoCollapse(false);
      }, 300); // 300ms delay
      
      setCollapseTimer(timer);
    }
  };

  // Save collapsed state to localStorage when it changes
  // Only save if not in auto-collapse mode
  useEffect(() => {
    if (!autoCollapse) {
      localStorage.setItem(SIDEBAR_STATE_KEY, String(collapsed));
    }
  }, [collapsed, autoCollapse]);
  
  // Cleanup collapse timer on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (collapseTimer) {
        clearTimeout(collapseTimer);
      }
    };
  }, [collapseTimer]);

  // Toggle sidebar state manually (via button click or keyboard shortcut)
  const toggleSidebar = (e?: React.MouseEvent) => {
    // If event is provided, stop propagation to prevent hover effects from interfering
    if (e) {
      e.stopPropagation();
    }
    
    setAutoCollapse(false); // Exit auto-collapse mode
    setCollapsed(prev => !prev);
  };

  // Set up keyboard shortcut (Alt+M) to toggle sidebar
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'm') {
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  // Check window size on resize to auto-collapse on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setCollapsed(true);
        setAutoCollapse(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const NavItem = ({ href, icon, children, roles, collapsed }: NavItemProps) => {
    // If roles are specified, check if the user has permission
    // Use activeRole for permission checks if it exists (for Manager role switching)
    const currentRole = user?.activeRole || user?.role;
    if (roles && !roles.includes(currentRole!)) {
      return null;
    }

    const isActive = location === href;
    const [itemHover, setItemHover] = useState(false);
    
    // Handle mouse enter/leave on icons to expand/collapse sidebar
    const handleIconMouseEnter = () => {
      setItemHover(true);
      expandSidebar();
    };
    
    const handleIconMouseLeave = () => {
      setItemHover(false);
      collapseSidebar();
    };
    
    // Create the nav item content - always show the icon
    const item = (
      <div 
        className={cn(
          "group flex items-center px-2 py-2 text-sm font-medium rounded-md cursor-pointer transition-all duration-200",
          isActive
            ? "bg-primary-50 text-primary-500"
            : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-600"
        )}
        onMouseEnter={handleIconMouseEnter}
        onMouseLeave={handleIconMouseLeave}
      >
        <div 
          className={cn(
            "flex-shrink-0 h-5 w-5",
            isActive
              ? "text-primary-500"
              : "text-neutral-400 group-hover:text-neutral-500"
          )}
        >
          {icon}
        </div>
        <span className={cn(
          "ml-3 whitespace-nowrap transition-all duration-200",
          collapsed && !isHovering && !itemHover ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
        )}>
          {children}
        </span>
      </div>
    );

    // Wrap with tooltip when collapsed and not hovering
    if (collapsed && !isHovering) {
      return (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href={href}>
                {item}
              </Link>
            </TooltipTrigger>
            <TooltipContent 
              side="right" 
              className="bg-neutral-800 text-white border-0 px-3 py-1"
              sideOffset={10}
            >
              <p className="text-sm">{children}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return <Link href={href}>{item}</Link>;
  };

  return (
    <div 
      className={cn(
        "flex flex-col h-full flex-1 bg-white border-r border-neutral-200 transition-all duration-300 ease-in-out",
        collapsed ? "md:w-16" : "md:w-64"
      )}
    >
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        {/* Sidebar header with toggle button */}
        <div className={cn(
          "flex px-4 items-center justify-between transition-all duration-300",
          collapsed && !isHovering ? "justify-center" : "justify-between"
        )}>
          {!collapsed && (
            <div className="text-sm font-medium text-neutral-500 overflow-hidden whitespace-nowrap">
              Navigation
            </div>
          )}
          {isHovering && collapsed && (
            <div className="opacity-0 w-0 overflow-hidden">
              {/* Hidden spacer */}
            </div>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={(e) => toggleSidebar(e)} 
            className="rounded-full h-8 w-8 p-0 flex items-center justify-center hover:bg-neutral-100"
            title={`${collapsed ? 'Expand' : 'Collapse'} sidebar (Alt+M)`}
            // Removed hover handlers from the toggle button to allow clicking
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </Button>
        </div>
        
        <nav className={cn(
          "mt-5 px-2 space-y-1",
          collapsed && !isHovering ? "items-center" : ""
        )}>
          <NavItem href="/" icon={<LayoutDashboard />} collapsed={collapsed}>
            Dashboard
          </NavItem>
          
          <NavItem href="/all-requests" icon={<FileText />} collapsed={collapsed}>
            All Requests
          </NavItem>
          
          {/* Only show New Trip Request for Employee role */}
          {(user?.activeRole === 'Employee' || (!user?.activeRole && user?.role === 'Employee')) && (
            <NavItem href="/trip-requests" icon={<Calendar />} collapsed={collapsed}>
              New Trip Request
            </NavItem>
          )}
          
          <NavItem href="/admin-requests" icon={<FileText />} collapsed={collapsed}>
            New Admin Request
          </NavItem>
          
          <NavItem 
            href="/approvals" 
            icon={<ClipboardCheck />}
            roles={["Manager", "Finance", "Admin"]}
            collapsed={collapsed}
          >
            Approvals
          </NavItem>
          
          <NavItem 
            href="/budget-dashboard" 
            icon={<TrendingUp />}
            roles={["Manager", "Finance", "Admin"]}
            collapsed={collapsed}
          >
            Budget Analytics
          </NavItem>
          
          <NavItem 
            href="/projects" 
            icon={<LayoutGrid />}
            roles={["Manager", "Admin"]}
            collapsed={collapsed}
          >
            Project Management
          </NavItem>
          
          <NavItem 
            href="/reports" 
            icon={<BarChart />}
            roles={["Manager", "Finance", "Admin"]}
            collapsed={collapsed}
          >
            Reports
          </NavItem>
          
          <NavItem 
            href="/finance/payments" 
            icon={<Car />}
            roles={["Finance"]}
            collapsed={collapsed}
          >
            Payment Dashboard
          </NavItem>
          
          <NavItem 
            href="/admin" 
            icon={<Settings />}
            roles={["Admin"]}
            collapsed={collapsed}
          >
            Administration
          </NavItem>
          
          {/* Site Management, Audit Logs and KM Rates are now integrated into the Admin page */}
        </nav>
      </div>
      <div className="flex-shrink-0 border-t border-neutral-200">
        {/* User profile area */}
        <div className={cn(
          "flex p-4",
          collapsed && !isHovering ? "justify-center" : ""
        )}>
          <Link href="/profile">
            <div 
              className="flex-shrink-0 group block focus:outline-none cursor-pointer"
              onMouseEnter={expandSidebar}
              onMouseLeave={collapseSidebar}
            >
              <div className={cn(
                "flex items-center",
                collapsed && !isHovering ? "flex-col" : ""
              )}>
                <div>
                  <div className="h-9 w-9 rounded-full bg-primary-500 flex items-center justify-center text-white">
                    {user?.fullName.charAt(0)}
                  </div>
                </div>
                {(!collapsed || isHovering) && (
                  <div className={cn(
                    "transition-all duration-200",
                    collapsed && !isHovering ? "opacity-0 w-0" : "ml-3 opacity-100"
                  )}>
                    <p className="text-sm font-medium text-neutral-600 whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px]">
                      {user?.fullName}
                    </p>
                    <p className="text-xs font-medium text-neutral-400">
                      {user?.activeRole || user?.role}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
