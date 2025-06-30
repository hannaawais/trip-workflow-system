import * as React from "react";
import { DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ResizableDialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogContent> {
  className?: string;
}

const ResizableDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  ResizableDialogContentProps
>(({ className, children, ...props }, ref) => {
  return (
    <DialogContent 
      ref={ref} 
      className={cn(
        "resize overflow-auto max-h-[80vh] min-h-[300px] min-w-[300px]",
        className
      )}
      {...props}
    >
      {children}
    </DialogContent>
  );
});

ResizableDialogContent.displayName = "ResizableDialogContent";

export { ResizableDialogContent };