import { RefreshCw } from "lucide-react";

interface LoadingIndicatorProps {
  isVisible: boolean;
}

export function LoadingIndicator({ isVisible }: LoadingIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-50 border border-border">
      <div className="flex items-center space-x-3">
        <RefreshCw className="h-6 w-6 animate-spin text-[hsl(var(--google-blue))]" />
        <span className="text-sm text-[hsl(var(--google-gray))]">Syncing calendar...</span>
      </div>
    </div>
  );
}
