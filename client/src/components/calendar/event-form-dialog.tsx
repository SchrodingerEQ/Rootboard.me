import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CalendarEvent } from "@shared/schema";

interface CalendarInfo {
  id: string;
  summary: string;
  accessRole?: string;
}

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // When set, the dialog edits this event. Otherwise it creates a new one.
  event?: CalendarEvent | null;
  // Pre-fill start date for new events (e.g. clicked day cell)
  defaultStart?: Date;
}

// Format a Date for datetime-local input (no Z, local timezone).
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildDefaults(event: CalendarEvent | null | undefined, defaultStart?: Date) {
  if (event) {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    const isAllDay = !!event.isAllDay;
    // Google all-day end is exclusive (next day). Show the inclusive last day.
    const displayEnd = isAllDay ? new Date(end.getTime() - 24 * 60 * 60 * 1000) : end;
    return {
      title: event.title,
      location: event.location ?? '',
      calendarId: event.calendarId,
      isAllDay,
      startDate: toDateInput(start),
      endDate: toDateInput(displayEnd),
      startDateTime: toLocalInput(start),
      endDateTime: toLocalInput(end),
    };
  }
  const start = defaultStart ? new Date(defaultStart) : new Date();
  // Snap to next half hour by default
  start.setSeconds(0, 0);
  if (start.getMinutes() > 30) {
    start.setHours(start.getHours() + 1);
    start.setMinutes(0);
  } else if (start.getMinutes() > 0) {
    start.setMinutes(30);
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    title: '',
    location: '',
    calendarId: '',
    isAllDay: false,
    startDate: toDateInput(start),
    endDate: toDateInput(start),
    startDateTime: toLocalInput(start),
    endDateTime: toLocalInput(end),
  };
}

export function EventFormDialog({ open, onOpenChange, event, defaultStart }: EventFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!event;

  const { data: calendars = [] } = useQuery<CalendarInfo[]>({
    queryKey: ['/api/calendar/calendars'],
    staleTime: 5 * 60 * 1000,
  });

  // Calendars the service account can write to. Google returns accessRole
  // 'owner' or 'writer' for editable calendars; 'reader' / 'freeBusyReader'
  // are read-only and would 403 on insert.
  const writableCalendars = calendars.filter(
    (c) => c.accessRole === 'owner' || c.accessRole === 'writer' || c.accessRole === undefined
  );

  const [form, setForm] = useState(() => buildDefaults(event, defaultStart));

  // Reset form whenever the dialog opens or the target event changes
  useEffect(() => {
    if (open) {
      const defaults = buildDefaults(event, defaultStart);
      // For new events with no calendar yet, default to first writable one
      if (!event && !defaults.calendarId && writableCalendars.length > 0) {
        defaults.calendarId = writableCalendars[0].id;
      }
      setForm(defaults);
    }
    // We intentionally don't depend on writableCalendars identity to avoid
    // clobbering user edits when calendar list refetches mid-form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id]);

  // If calendars load after the dialog opened (new event), backfill default.
  useEffect(() => {
    if (open && !isEdit && !form.calendarId && writableCalendars.length > 0) {
      setForm((f) => ({ ...f, calendarId: writableCalendars[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writableCalendars.length, open, isEdit]);

  const buildPayload = () => {
    let startTime: Date;
    let endTime: Date;
    if (form.isAllDay) {
      startTime = new Date(`${form.startDate}T00:00:00`);
      // Google end.date is exclusive — add a day to the inclusive last day.
      const inclusiveEnd = new Date(`${form.endDate}T00:00:00`);
      endTime = new Date(inclusiveEnd.getTime() + 24 * 60 * 60 * 1000);
    } else {
      startTime = new Date(form.startDateTime);
      endTime = new Date(form.endDateTime);
    }
    return {
      title: form.title.trim(),
      location: form.location.trim() || null,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      isAllDay: form.isAllDay,
    };
  };

  const invalidateAfterWrite = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/calendar/events', {
        ...buildPayload(),
        calendarId: form.calendarId,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateAfterWrite();
      toast({ title: 'Event created' });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to create event', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!event) throw new Error('No event to update');
      const res = await apiRequest('PATCH', `/api/calendar/events/${event.id}`, buildPayload());
      return res.json();
    },
    onSuccess: () => {
      invalidateAfterWrite();
      toast({ title: 'Event updated' });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to update event', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!event) throw new Error('No event to delete');
      await apiRequest('DELETE', `/api/calendar/events/${event.id}`);
    },
    onSuccess: () => {
      invalidateAfterWrite();
      toast({ title: 'Event deleted' });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to delete event', description: err.message, variant: 'destructive' });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }
    if (!isEdit && !form.calendarId) {
      toast({ title: 'Choose a calendar', variant: 'destructive' });
      return;
    }
    const payload = buildPayload();
    if (new Date(payload.endTime) <= new Date(payload.startTime)) {
      toast({ title: 'End must be after start', variant: 'destructive' });
      return;
    }
    if (isEdit) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const handleDelete = () => {
    if (!event) return;
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${event.title}"? This cannot be undone.`)) {
      return;
    }
    deleteMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit event' : 'New event'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Event title"
              autoFocus
              data-testid="input-event-title"
            />
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="event-calendar">Calendar</Label>
              <Select
                value={form.calendarId}
                onValueChange={(v) => setForm((f) => ({ ...f, calendarId: v }))}
              >
                <SelectTrigger id="event-calendar" data-testid="select-event-calendar">
                  <SelectValue placeholder="Choose a calendar" />
                </SelectTrigger>
                <SelectContent>
                  {writableCalendars.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      No writable calendars available
                    </SelectItem>
                  ) : (
                    writableCalendars.map((cal) => (
                      <SelectItem key={cal.id} value={cal.id}>
                        {cal.summary}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="event-allday" className="cursor-pointer">All day</Label>
            <Switch
              id="event-allday"
              checked={form.isAllDay}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, isAllDay: checked }))}
              data-testid="switch-event-allday"
            />
          </div>

          {form.isAllDay ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="event-start-date">Start</Label>
                <Input
                  id="event-start-date"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-end-date">End</Label>
                <Input
                  id="event-end-date"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="event-start-dt">Start</Label>
                <Input
                  id="event-start-dt"
                  type="datetime-local"
                  value={form.startDateTime}
                  onChange={(e) => setForm((f) => ({ ...f, startDateTime: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-end-dt">End</Label>
                <Input
                  id="event-end-dt"
                  type="datetime-local"
                  value={form.endDateTime}
                  onChange={(e) => setForm((f) => ({ ...f, endDateTime: e.target.value }))}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="event-location">Location (optional)</Label>
            <Input
              id="event-location"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Where"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
                className="touch-button h-10 mr-auto"
                data-testid="button-delete-event"
              >
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="touch-button h-10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="touch-button h-10 bg-[hsl(var(--google-blue))] text-white hover:bg-[hsl(var(--google-blue-hover))]"
              data-testid="button-save-event"
            >
              {isPending ? 'Saving…' : isEdit ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
