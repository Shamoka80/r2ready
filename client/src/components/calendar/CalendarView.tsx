
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, Filter, Bell, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPost } from '@/api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addDays, subDays } from 'date-fns';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  type: 'milestone' | 'deadline' | 'audit' | 'certification' | 'training' | 'review';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'scheduled' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
  category: string;
  relatedEntityId?: string;
  relatedEntityType?: 'assessment' | 'facility' | 'client';
  assignedUsers: string[];
  location?: string;
  isAllDay: boolean;
  color: string;
}

interface CalendarFilter {
  view: 'month' | 'week' | 'day' | 'agenda';
  types?: string[];
  priorities?: string[];
  statuses?: string[];
}

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [filter, setFilter] = useState<CalendarFilter>({ view: 'month' });
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const queryClient = useQueryClient();

  // Fetch calendar events
  const { data: eventsResponse, isLoading: eventsLoading } = useQuery({
    queryKey: ['/api/calendar/events', currentDate, filter],
    queryFn: async () => {
      const startDate = startOfMonth(currentDate);
      const endDate = endOfMonth(currentDate);
      
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        view: filter.view,
        ...(filter.types && { types: filter.types.join(',') }),
        ...(filter.priorities && { priorities: filter.priorities.join(',') }),
        ...(filter.statuses && { statuses: filter.statuses.join(',') })
      });

      return apiGet<{ success: boolean; events: CalendarEvent[]; total: number }>(`/calendar/events?${params}`);
    },
  });

  // Fetch calendar dashboard
  const { data: dashboardResponse, isLoading: dashboardLoading } = useQuery({
    queryKey: ['/api/calendar/dashboard'],
    queryFn: () => apiGet<{ success: boolean; dashboard: any }>('/calendar/dashboard'),
  });

  // Fetch upcoming deadlines
  const { data: deadlinesResponse } = useQuery({
    queryKey: ['/api/calendar/upcoming-deadlines'],
    queryFn: () => apiGet<{ success: boolean; deadlines: CalendarEvent[]; count: number }>('/calendar/upcoming-deadlines'),
  });

  const events = eventsResponse?.events || [];
  const dashboard = dashboardResponse?.dashboard;
  const upcomingDeadlines = deadlinesResponse?.deadlines || [];

  // Generate compliance calendar mutation
  const generateComplianceCalendar = useMutation({
    mutationFn: (assessmentId: string) => 
      apiPost('/calendar/generate-compliance-calendar', { assessmentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
    },
  });

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return events.filter(event => 
      isSameDay(new Date(event.startDate), date)
    );
  };

  // Get days for current month view
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const getPriorityBadge = (priority: string) => {
    const variants = {
      low: 'secondary',
      medium: 'outline',
      high: 'destructive',
      critical: 'destructive'
    } as const;
    
    return <Badge variant={variants[priority as keyof typeof variants] || 'outline'}>{priority}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <div className="h-4 w-4 bg-blue-500 rounded-full animate-pulse" />;
      default:
        return <CalendarIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    const colors = {
      milestone: 'bg-green-500',
      deadline: 'bg-orange-500',
      audit: 'bg-red-500',
      certification: 'bg-purple-500',
      training: 'bg-blue-500',
      review: 'bg-gray-500'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-500';
  };

  if (eventsLoading || dashboardLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Cards */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Today's Events</CardDescription>
              <CardTitle className="text-2xl">{dashboard.todayEvents}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Upcoming Deadlines</CardDescription>
              <CardTitle className="text-2xl text-orange-600">{dashboard.upcomingDeadlines}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>This Week</CardDescription>
              <CardTitle className="text-2xl">{dashboard.thisWeekEvents}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Overdue</CardDescription>
              <CardTitle className="text-2xl text-red-600">{dashboard.overdueEvents}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Critical Deadline Alert */}
      {dashboard?.nextCriticalDeadline && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription>
            <strong>Critical Deadline:</strong> {dashboard.nextCriticalDeadline.title} - {format(new Date(dashboard.nextCriticalDeadline.startDate), 'MMM dd, yyyy')}
          </AlertDescription>
        </Alert>
      )}

      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Compliance Calendar</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(subDays(currentDate, 30))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[150px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(addDays(currentDate, 30))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={filter.view} onValueChange={(view) => setFilter({ ...filter, view: view as any })}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="agenda">Agenda</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Calendar Event</DialogTitle>
                <DialogDescription>
                  Add a new compliance-related event to your calendar.
                </DialogDescription>
              </DialogHeader>
              {/* Event creation form would go here */}
              <p className="text-sm text-muted-foreground">Event creation form to be implemented</p>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Calendar */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Calendar View</CardTitle>
            </CardHeader>
            <CardContent>
              {filter.view === 'month' && (
                <div className="grid grid-cols-7 gap-2">
                  {/* Day headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                      {day}
                    </div>
                  ))}
                  
                  {/* Calendar days */}
                  {monthDays.map(day => {
                    const dayEvents = getEventsForDate(day);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isCurrentDay = isToday(day);
                    
                    return (
                      <div
                        key={day.toISOString()}
                        className={`
                          min-h-[100px] p-2 border rounded-lg cursor-pointer transition-colors
                          ${isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}
                          ${isCurrentDay ? 'bg-blue-100 border-blue-300' : ''}
                        `}
                        onClick={() => setSelectedDate(day)}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-sm ${isCurrentDay ? 'font-bold text-blue-600' : ''}`}>
                            {format(day, 'd')}
                          </span>
                          {dayEvents.length > 0 && (
                            <Badge variant="secondary" className="text-xs px-1">
                              {dayEvents.length}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-1">
                          {dayEvents.slice(0, 2).map(event => (
                            <div
                              key={event.id}
                              className={`
                                text-xs p-1 rounded text-white truncate
                                ${getTypeColor(event.type)}
                              `}
                              title={event.title}
                            >
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {filter.view === 'agenda' && (
                <div className="space-y-4">
                  {events.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No events scheduled</p>
                  ) : (
                    events
                      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                      .map(event => (
                        <div key={event.id} className="flex items-start gap-4 p-4 border rounded-lg">
                          <div className="flex flex-col items-center min-w-[80px]">
                            <div className="text-sm font-medium">
                              {format(new Date(event.startDate), 'MMM dd')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(event.startDate), 'EEE')}
                            </div>
                            {!event.isAllDay && (
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(event.startDate), 'h:mm a')}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {getStatusIcon(event.status)}
                              <h4 className="font-medium">{event.title}</h4>
                              {getPriorityBadge(event.priority)}
                              <Badge variant="outline" className="capitalize">
                                {event.type}
                              </Badge>
                            </div>
                            
                            {event.description && (
                              <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                            )}
                            
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {event.location && (
                                <span>📍 {event.location}</span>
                              )}
                              <span className="capitalize">{event.status}</span>
                              <span>{event.category}</span>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Mini Calendar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Navigation</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
              />
            </CardContent>
          </Card>

          {/* Upcoming Deadlines */}
          {upcomingDeadlines.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Upcoming Deadlines
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingDeadlines.slice(0, 5).map(deadline => (
                    <div key={deadline.id} className="flex items-start gap-3">
                      <div className={`w-3 h-3 rounded-full mt-1 ${getTypeColor(deadline.type)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{deadline.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(deadline.startDate), 'MMM dd, yyyy')}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {getPriorityBadge(deadline.priority)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Event Types Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Event Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { type: 'milestone', label: 'Milestones' },
                  { type: 'deadline', label: 'Deadlines' },
                  { type: 'audit', label: 'Audits' },
                  { type: 'certification', label: 'Certifications' },
                  { type: 'training', label: 'Training' },
                  { type: 'review', label: 'Reviews' }
                ].map(({ type, label }) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded ${getTypeColor(type)}`} />
                    <span className="text-sm">{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
