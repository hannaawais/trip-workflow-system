import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ApproveRejectButtonsProps {
  onApprove: () => void;
  onReject: (reason: string) => void;
  isLoading: boolean;
  canApprove?: boolean;
  canReject?: boolean;
}

export default function ApproveRejectButtons({
  onApprove,
  onReject,
  isLoading,
  canApprove = true,
  canReject = true
}: ApproveRejectButtonsProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const handleApprove = () => {
    onApprove();
  };

  const handleReject = () => {
    setShowRejectDialog(true);
  };

  const handleConfirmReject = () => {
    onReject(rejectReason);
    setShowRejectDialog(false);
    setRejectReason("");
  };

  return (
    <>
      <div className="flex space-x-3">
        {canApprove && (
          <Button
            onClick={handleApprove}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Approve
          </Button>
        )}

        {canReject && (
          <Button
            onClick={handleReject}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Reject
          </Button>
        )}
      </div>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this request.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Rejection Reason</Label>
              <Textarea
                id="reject-reason"
                placeholder="Please explain why this request is being rejected"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowRejectDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmReject} 
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!rejectReason.trim()}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
