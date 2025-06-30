import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StatusBadgeProps {
  status: string;
  className?: string;
  showTooltip?: boolean;
}

export default function StatusBadge({ status, className, showTooltip = false }: StatusBadgeProps) {
  const getStatusStyles = () => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Pending Department Approval':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
      case 'Pending Project Approval':
        return 'bg-yellow-100 text-yellow-800 border border-orange-300';
      case 'Pending Finance Approval':
        return 'bg-yellow-50 text-yellow-800 border border-yellow-500';
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      case 'Paid':
        return 'bg-blue-100 text-blue-800';
      case 'Cancelled':
        return 'bg-neutral-100 text-neutral-800 border border-neutral-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  // For display purposes with the detailed statuses
  const getDisplayText = () => {
    switch (status) {
      case 'Pending Department Approval':
        return 'Dept. Approval';
      case 'Pending Project Approval':
        return 'Proj. Approval';
      case 'Pending Finance Approval':
        return 'Finance Approval';
      default:
        return status;
    }
  };
  
  const badge = (
    <span className={cn(
      "px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full",
      getStatusStyles(),
      className
    )}>
      {getDisplayText()}
    </span>
  );
  
  if (showTooltip && status.startsWith('Pending') && status !== 'Pending') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent>
            <p>{status}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return badge;
}
