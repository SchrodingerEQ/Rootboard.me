import { ExternalLink, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { APP_VERSION } from "@shared/version";

interface UpdateNotificationProps {
  isOpen: boolean;
  latestVersion: string | null;
  onDismiss: () => void;
}

export function UpdateNotification({
  isOpen,
  latestVersion,
  onDismiss,
}: UpdateNotificationProps) {
  const handleViewInstructions = () => {
    window.open('/setup#updating', '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-600" />
            Update Available
          </DialogTitle>
          <DialogDescription className="text-left space-y-3 pt-2">
            <p>
              A new version of the calendar app is available!
            </p>
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Current version:</span>
                <span className="font-mono">{APP_VERSION}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Latest version:</span>
                <span className="font-mono text-green-600 font-medium">{latestVersion}</span>
              </div>
            </div>
            <p className="text-sm">
              View the setup guide for instructions on how to update your installation.
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onDismiss}>
            <X className="h-4 w-4 mr-2" />
            Dismiss
          </Button>
          <Button onClick={handleViewInstructions}>
            <ExternalLink className="h-4 w-4 mr-2" />
            View Instructions
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
