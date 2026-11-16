import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { getCalendarColor, type CalendarInfo } from "@/lib/calendar-meta";

interface CalendarPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The calendar widget's `hiddenCalendars` (shell-bridge.ts): a calendar shows unless it is in here. */
  hiddenCalendars: Set<string>;
  /** The same writer the Settings switches use, so the choice lands in dashboard.json. */
  onCalendarToggle: (calendarId: string, visible: boolean) => void;
  /** Done: close and sync now. */
  onDone: () => void;
}

/**
 * "Choose your calendars" (beta-launch brief 02 decision 5): opens on the
 * dashboard right after Google sign-in. It lists the account's calendar
 * list, which already includes calendars family members share with it, and
 * the switches write the existing `hiddenCalendars` setting (no new config
 * key), exactly like Settings → Calendars.
 */
export function CalendarPickerDialog({ open, onOpenChange, hiddenCalendars, onCalendarToggle, onDone }: CalendarPickerDialogProps) {
  const { data: calendars, isLoading, isError } = useQuery<CalendarInfo[]>({
    queryKey: ["/api/calendar/calendars"],
    enabled: open,
    staleTime: 0,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="calendar-picker-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-rb-success" />
            Google is connected
          </DialogTitle>
          <DialogDescription>
            Choose which calendars to show. Calendars shared with this account are in the list too. You can change
            this later in Settings → Calendars.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-2">
          {isLoading && <p className="text-sm text-rb-muted">Loading calendars…</p>}
          {isError && <p className="text-sm text-rb-danger">Couldn't load the calendar list. Check the internet connection, then open Settings → Calendars.</p>}
          {calendars?.length === 0 && <p className="text-sm text-rb-muted">This account has no calendars yet.</p>}
          {calendars?.map((calendar) => (
            <label key={calendar.id} className="flex items-center gap-3 min-h-[48px] px-1 cursor-pointer">
              <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: getCalendarColor(calendar) }} />
              <span className="flex-1 text-base truncate">{calendar.summary}</span>
              <Switch
                checked={!hiddenCalendars.has(calendar.id)}
                onCheckedChange={(checked) => onCalendarToggle(calendar.id, checked)}
                aria-label={`Show ${calendar.summary}`}
              />
            </label>
          ))}
        </div>

        <Button className="w-full h-12 text-base" onClick={onDone} data-testid="button-calendar-picker-done">
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}
