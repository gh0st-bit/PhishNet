import { useState } from "react";
import AppLayout from "@/components/layout/app-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Trash2, Edit, Clock, Mail, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ScheduleForm from "@/components/reports/schedule-form";

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

export default function ReportSchedulesPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ReportSchedule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<ReportSchedule | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch schedules
  const { data: schedules = [], isLoading } = useQuery<ReportSchedule[]>({
    queryKey: ['/api/reports/schedules'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/reports/schedules');
      return await res.json();
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/reports/schedules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reports/schedules'] });
      toast({
        title: "Schedule deleted",
        description: "The report schedule has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setScheduleToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete schedule",
        variant: "destructive",
      });
    }
  });

  // Toggle enabled mutation
  const toggleEnabledMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      await apiRequest('PUT', `/api/reports/schedules/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reports/schedules'] });
      toast({
        title: "Schedule updated",
        description: "The schedule status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update schedule",
        variant: "destructive",
      });
    }
  });

  const handleCreate = () => {
    setSelectedSchedule(null);
    setIsCreating(true);
  };

  const handleEdit = (schedule: ReportSchedule) => {
    setSelectedSchedule(schedule);
    setIsEditing(true);
  };

  const handleDelete = (schedule: ReportSchedule) => {
    setScheduleToDelete(schedule);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (scheduleToDelete) {
      deleteMutation.mutate(scheduleToDelete.id);
    }
  };

  const handleToggleEnabled = (schedule: ReportSchedule) => {
    toggleEnabledMutation.mutate({
      id: schedule.id,
      enabled: !schedule.enabled
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatNextRun = (date: Date) => {
    const nextRun = new Date(date);
    const now = new Date();
    const diffMs = nextRun.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 1) {
      return `in ${diffDays} days`;
    } else if (diffHours > 1) {
      return `in ${diffHours} hours`;
    } else if (diffMs > 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `in ${diffMinutes} minutes`;
    } else {
      return 'Due now';
    }
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'executive': return 'Executive Summary';
      case 'detailed': return 'Detailed Analysis';
      case 'compliance': return 'Compliance Report';
      default: return type;
    }
  };

  const getCadenceLabel = (cadence: string) => {
    return cadence.charAt(0).toUpperCase() + cadence.slice(1);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Report Schedules</h1>
            <p className="text-muted-foreground">
              Automate report generation and delivery to stakeholders
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Schedule
          </Button>
        </div>

        {/* Schedules Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Scheduled Reports
            </CardTitle>
            <CardDescription>
              {schedules.length === 0 
                ? "No schedules configured yet"
                : `${schedules.length} schedule${schedules.length === 1 ? '' : 's'} configured`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No scheduled reports yet</p>
                <p className="text-sm mt-2">Create your first schedule to automate report delivery</p>
                <Button onClick={handleCreate} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Schedule
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report Type</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell>
                        <div className="font-medium">{getReportTypeLabel(schedule.type)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getCadenceLabel(schedule.cadence)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {formatTime(schedule.timeOfDay)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3" />
                          {schedule.recipients.split(',').length} recipient(s)
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatNextRun(schedule.nextRunAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={schedule.enabled}
                          onCheckedChange={() => handleToggleEnabled(schedule)}
                          disabled={toggleEnabledMutation.isPending}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(schedule)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(schedule)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Report Schedule</DialogTitle>
            </DialogHeader>
            <ScheduleForm
              onSuccess={() => {
                setIsCreating(false);
                queryClient.invalidateQueries({ queryKey: ['/api/reports/schedules'] });
              }}
              onCancel={() => setIsCreating(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Report Schedule</DialogTitle>
            </DialogHeader>
            {selectedSchedule && (
              <ScheduleForm
                schedule={selectedSchedule}
                onSuccess={() => {
                  setIsEditing(false);
                  setSelectedSchedule(null);
                  queryClient.invalidateQueries({ queryKey: ['/api/reports/schedules'] });
                }}
                onCancel={() => {
                  setIsEditing(false);
                  setSelectedSchedule(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Schedule?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this report schedule? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
