import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, LogIn, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const [isClearing, setIsClearing] = useState(false);
  const queryClient = useQueryClient();

  const handleGoogleLogin = () => {
    // Try opening in a new tab first to see the error more clearly
    const authWindow = window.open('/api/auth/google', '_blank');
    
    // Fallback to current window if popup is blocked
    setTimeout(() => {
      if (!authWindow || authWindow.closed) {
        window.location.href = '/api/auth/google';
      }
    }, 1000);
  };

  const handleClearCredentials = async () => {
    setIsClearing(true);
    try {
      const response = await fetch('/api/auth/clear', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        // Refresh auth status after clearing
        await queryClient.invalidateQueries({ 
          queryKey: ['/api/calendar/auth-status'] 
        });
      }
    } catch (error) {
      console.error('Failed to clear credentials:', error);
    }
    setIsClearing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-[hsl(var(--google-blue))]" />
            Connect Google Calendar
          </DialogTitle>
          <DialogDescription>
            Sign in with your Google account to display your calendar events.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Button 
            onClick={handleGoogleLogin}
            className="w-full bg-[hsl(var(--google-blue))] hover:bg-[hsl(var(--google-blue-hover))] text-white"
            size="lg"
          >
            <LogIn className="mr-2 h-4 w-4" />
            Sign in with Google
          </Button>
          
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">Troubleshooting OAuth Issues:</p>
              <ul className="text-xs space-y-1">
                <li>• <strong>Publish your OAuth consent screen</strong> (most common fix)</li>
                <li>• Add <code className="bg-blue-100 px-1 rounded">{window.location.origin}</code> to Authorized JavaScript origins</li>
                <li>• If testing mode, add your email as a test user</li>
                <li>• Wait 5-10 minutes for changes to take effect</li>
              </ul>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
            <p className="text-sm text-yellow-700">
              If you're experiencing authentication issues, try clearing stored credentials first.
            </p>
          </div>
          
          <Button 
            onClick={handleClearCredentials}
            disabled={isClearing}
            variant="outline"
            className="w-full"
            size="sm"
          >
            {isClearing ? (
              <>
                <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                Clearing...
              </>
            ) : (
              "Clear Stored Credentials"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}