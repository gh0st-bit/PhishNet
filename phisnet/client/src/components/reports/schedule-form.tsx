import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReportSchedule {
  id: number;
  organizationId: number;
  type: 'executive' | 'detailed' | 'compliance';
  cadence: 'daily' | 'weekly' | 'monthly';
  timeOfDay: string;
  timezone: string;
  recipients: string;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ScheduleFormProps {
  schedule?: ReportSchedule;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ScheduleForm({ schedule, onSuccess, onCancel }: ScheduleFormProps) {
  const [type, setType] = useState<string>(schedule?.type || 'executive');
  const [cadence, setCadence] = useState<string>(schedule?.cadence || 'weekly');
  const [timeOfDay, setTimeOfDay] = useState<string>(schedule?.timeOfDay || '09:00');
  const [timezone, setTimezone] = useState<string>(schedule?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [recipients, setRecipients] = useState<string>(schedule?.recipients || '');

  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = schedule 
        ? `/api/reports/schedules/${schedule.id}`
        : '/api/reports/schedules';
      const method = schedule ? 'PUT' : 'POST';
      await apiRequest(method, endpoint, data);
    },
    onSuccess: () => {
      toast({
        title: schedule ? "Schedule updated" : "Schedule created",
        description: schedule 
          ? "The report schedule has been updated successfully."
          : "The report schedule has been created successfully.",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save schedule",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate recipients
    if (!recipients.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter at least one recipient email address",
        variant: "destructive",
      });
      return;
    }

    // Validate email format
    const emailList = recipients.split(',').map(e => e.trim());
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emailList.filter(email => !emailRegex.test(email));
    
    if (invalidEmails.length > 0) {
      toast({
        title: "Validation Error",
        description: `Invalid email address(es): ${invalidEmails.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      type,
      cadence,
      timeOfDay,
      timezone,
      recipients,
      enabled: schedule?.enabled ?? true,
    });
  };

  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Dubai',
    'Australia/Sydney',
    'UTC',
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Report Type */}
      <div className="space-y-2">
        <Label htmlFor="type">Report Type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger id="type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="executive">Executive Summary</SelectItem>
            <SelectItem value="detailed">Detailed Analysis</SelectItem>
            <SelectItem value="compliance">Compliance Report</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {type === 'executive' && 'High-level overview for executives'}
          {type === 'detailed' && 'Comprehensive analysis with all metrics'}
          {type === 'compliance' && 'Focused on regulatory compliance'}
        </p>
      </div>

      {/* Frequency */}
      <div className="space-y-2">
        <Label htmlFor="cadence">Frequency</Label>
        <Select value={cadence} onValueChange={setCadence}>
          <SelectTrigger id="cadence">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Time of Day */}
      <div className="space-y-2">
        <Label htmlFor="timeOfDay">Time of Day</Label>
        <Input
          id="timeOfDay"
          type="time"
          value={timeOfDay}
          onChange={(e) => setTimeOfDay(e.target.value)}
          required
        />
        <p className="text-sm text-muted-foreground">
          Reports will be generated and sent at this time
        </p>
      </div>

      {/* Timezone */}
      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger id="timezone">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timezones.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Recipients */}
      <div className="space-y-2">
        <Label htmlFor="recipients">Recipients</Label>
        <Input
          id="recipients"
          type="text"
          placeholder="email1@example.com, email2@example.com"
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          required
        />
        <p className="text-sm text-muted-foreground">
          Enter email addresses separated by commas
        </p>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            schedule ? 'Update Schedule' : 'Create Schedule'
          )}
        </Button>
      </div>
    </form>
  );
}
