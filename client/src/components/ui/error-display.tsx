import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Wifi, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorDisplayProps {
  error: Error | string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorDisplay({ error, onRetry, className }: ErrorDisplayProps) {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  // Determine error type and icon
  const getErrorTypeAndIcon = (message: string) => {
    if (message.includes('network') || message.includes('connection')) {
      return { icon: Wifi, variant: 'destructive' as const, type: 'Network Error' };
    }
    if (message.includes('database') || message.includes('system error')) {
      return { icon: Database, variant: 'destructive' as const, type: 'System Error' };
    }
    if (message.includes('unauthorized') || message.includes('permission')) {
      return { icon: AlertCircle, variant: 'destructive' as const, type: 'Access Error' };
    }
    if (message.includes('budget')) {
      return { icon: AlertCircle, variant: 'destructive' as const, type: 'Budget Error' };
    }
    return { icon: AlertCircle, variant: 'destructive' as const, type: 'Error' };
  };

  const { icon: Icon, variant, type } = getErrorTypeAndIcon(errorMessage);

  return (
    <Alert variant={variant} className={className}>
      <Icon className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <div>
          <div className="font-medium">{type}</div>
          <div className="text-sm mt-1">{errorMessage}</div>
        </div>
        {onRetry && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRetry}
            className="ml-4"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Try Again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

// Hook for handling errors consistently
export function useErrorHandler() {
  const handleError = (error: unknown): string => {
    if (typeof error === 'string') {
      return error;
    }
    
    if (error instanceof Error) {
      return error.message;
    }
    
    // Handle API response errors
    if (error && typeof error === 'object' && 'error' in error) {
      return (error as any).error;
    }
    
    return 'An unexpected error occurred. Please try again.';
  };

  return { handleError };
}