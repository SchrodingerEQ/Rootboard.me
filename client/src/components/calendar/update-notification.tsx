import { X, Download, RotateCcw, Loader2, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { APP_VERSION } from "@shared/version";

interface UpdateStatus {
  status: 'idle' | 'checking' | 'downloading' | 'backing-up' | 'extracting' | 'installing' | 'restarting' | 'complete' | 'error' | 'rolling-back';
  message: string;
  progress: number;
  error?: string;
}

interface UpdateNotificationProps {
  isOpen: boolean;
  latestVersion: string | null;
  releaseNotes: string | null;
  releaseName: string | null;
  releaseUrl: string | null;
  onDismiss: () => void;
  onUpdate: () => void;
  onRollback: () => void;
  updateStatus: UpdateStatus;
  isUpdating: boolean;
}

export function UpdateNotification({
  isOpen,
  latestVersion,
  releaseNotes,
  releaseName,
  releaseUrl,
  onDismiss,
  onUpdate,
  onRollback,
  updateStatus,
  isUpdating,
}: UpdateNotificationProps) {
  const isInProgress = isUpdating && updateStatus.status !== 'idle' && updateStatus.status !== 'complete' && updateStatus.status !== 'error';
  const isComplete = updateStatus.status === 'complete';
  const isError = updateStatus.status === 'error';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && !isInProgress) onDismiss();
    }}>
      <DialogContent className="max-w-md" onPointerDownOutside={isInProgress ? (e) => e.preventDefault() : undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isInProgress ? (
              <>
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                Updating...
              </>
            ) : isComplete ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                Update Complete
              </>
            ) : isError ? (
              <>
                <AlertCircle className="h-5 w-5 text-red-600" />
                Update Failed
              </>
            ) : (
              <>
                <Download className="h-5 w-5 text-blue-600" />
                Update Available
              </>
            )}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="text-left space-y-3 pt-2">
              {isInProgress ? (
                <div className="space-y-3">
                  <p className="text-sm">{updateStatus.message}</p>
                  <Progress value={updateStatus.progress} className="h-2" />
                  <p className="text-xs text-gray-500 text-center">{updateStatus.progress}%</p>
                </div>
              ) : isComplete ? (
                <div className="space-y-2">
                  <p className="text-sm text-green-700">{updateStatus.message}</p>
                  <p className="text-xs text-gray-500">The page will reload automatically...</p>
                </div>
              ) : isError ? (
                <div className="space-y-2">
                  <p className="text-sm text-red-700">{updateStatus.message}</p>
                  {updateStatus.error && (
                    <div className="bg-red-50 rounded p-2 text-xs text-red-600 font-mono">
                      {updateStatus.error}
                    </div>
                  )}
                  <p className="text-sm">
                    If this keeps happening, you can roll back to the previous version or update manually via the setup guide.
                  </p>
                </div>
              ) : (
                <>
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
                    {releaseName && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Release:</span>
                        <span className="font-medium">{releaseName}</span>
                      </div>
                    )}
                  </div>
                  {releaseNotes && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-500 uppercase">What's New</p>
                      <div className="bg-blue-50 rounded-lg p-3 text-sm text-gray-700 max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {releaseNotes}
                      </div>
                    </div>
                  )}
                  <p className="text-sm">
                    Tap "Update Now" to automatically download and install the update. Your settings and calendar data will be preserved.
                  </p>
                </>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 justify-end mt-4">
          {isInProgress ? null : isComplete ? null : isError ? (
            <>
              <Button variant="outline" onClick={onDismiss}>
                Close
              </Button>
              <Button variant="outline" onClick={onRollback}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Roll Back
              </Button>
              <Button onClick={onUpdate}>
                <Download className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onDismiss}>
                <X className="h-4 w-4 mr-2" />
                Dismiss
              </Button>
              {releaseUrl && (
                <Button variant="outline" onClick={() => window.open(releaseUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Details
                </Button>
              )}
              <Button onClick={onUpdate} className="bg-blue-600 hover:bg-blue-700">
                <Download className="h-4 w-4 mr-2" />
                Update Now
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
