import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

// Status types for filtering
export type StatusFilter = 
  | 'All' 
  | 'Pending' 
  | 'Approved' 
  | 'Rejected'
  | 'Paid'
  | 'Cancelled';

interface StatusFilterBarProps {
  onFilterChange: (filter: StatusFilter) => void;
  totalCounts: {
    All: number;
    Pending: number;
    Approved: number;
    Rejected: number;
    Paid: number;
    Cancelled: number;
  };
  className?: string;
}

export default function StatusFilterBar({ 
  onFilterChange, 
  totalCounts, 
  className 
}: StatusFilterBarProps) {
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('All');

  const handleFilterClick = (filter: StatusFilter) => {
    setActiveFilter(filter);
    onFilterChange(filter);
  };

  const getButtonClass = (filter: StatusFilter) => {
    if (filter === activeFilter) {
      switch (filter) {
        case 'All':
          return 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200';
        case 'Pending':
          return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
        case 'Approved':
          return 'bg-green-100 text-green-800 hover:bg-green-200';
        case 'Rejected':
          return 'bg-red-100 text-red-800 hover:bg-red-200';
        case 'Paid':
          return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
        case 'Cancelled':
          return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
      }
    }
    return 'bg-white hover:bg-neutral-100';
  };

  const filters: StatusFilter[] = ['All', 'Pending', 'Approved', 'Rejected', 'Paid', 'Cancelled'];

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {filters.map((filter) => (
        <div 
          key={filter}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium border cursor-pointer transition-colors",
            filter === activeFilter 
              ? activeFilterClasses(filter)
              : "bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-600"
          )}
          onClick={() => handleFilterClick(filter)}
        >
          {filter} 
          <span className={cn("ml-1 opacity-70", 
            filter === activeFilter ? "text-current" : "text-neutral-500"
          )}>
            {totalCounts[filter]}
          </span>
        </div>
      ))}
    </div>
  );
}

function activeFilterClasses(filter: StatusFilter): string {
  switch (filter) {
    case 'All':
      return "bg-neutral-100 border-neutral-300 text-neutral-800";
    case 'Pending':
      return "bg-yellow-50 border-yellow-200 text-yellow-800";
    case 'Approved':
      return "bg-green-50 border-green-200 text-green-800";
    case 'Rejected':
      return "bg-red-50 border-red-200 text-red-800";
    case 'Paid':
      return "bg-blue-50 border-blue-200 text-blue-800";
    case 'Cancelled':
      return "bg-gray-50 border-gray-200 text-gray-800";
    default:
      return "bg-neutral-100 border-neutral-300 text-neutral-800";
  }
}