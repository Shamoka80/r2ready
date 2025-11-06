import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  FileText,
  Users,
  Building2,
  ArrowRight,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  isLoading?: boolean;
  className?: string;
}

export function KPICard({ 
  title, 
  value, 
  description, 
  icon, 
  trend, 
  isLoading,
  className 
}: KPICardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid={`kpi-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold" data-testid={`kpi-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
          {value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className={cn(
            "flex items-center text-xs mt-2",
            trend.isPositive ? "text-green-600" : "text-red-600"
          )}>
            {trend.isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            {Math.abs(trend.value)}% from last period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ReadinessGaugeProps {
  score: number;
  level: 'Not Ready' | 'Needs Work' | 'Approaching Ready' | 'Certification Ready';
  isLoading?: boolean;
}

export function ReadinessGauge({ score, level, isLoading }: ReadinessGaugeProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-32 rounded-full mx-auto" />
        </CardContent>
      </Card>
    );
  }

  const getColorClass = (level: string) => {
    switch (level) {
      case 'Certification Ready': return 'text-green-600';
      case 'Approaching Ready': return 'text-blue-600';
      case 'Needs Work': return 'text-yellow-600';
      default: return 'text-red-600';
    }
  };

  const getProgressColor = (score: number) => {
    if (score >= 90) return 'bg-green-600';
    if (score >= 75) return 'bg-blue-600';
    if (score >= 50) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  return (
    <Card data-testid="readiness-gauge">
      <CardHeader>
        <CardTitle>Readiness Score</CardTitle>
        <CardDescription>Overall certification readiness</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 56}`}
                strokeDashoffset={`${2 * Math.PI * 56 * (1 - score / 100)}`}
                className={getProgressColor(score)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl font-bold" data-testid="readiness-score">
                  {score}%
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center">
          <Badge 
            className={cn(getColorClass(level), "text-sm")}
            variant="outline"
            data-testid="readiness-level"
          >
            {level}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

interface GapAnalysisWidgetProps {
  critical: number;
  important: number;
  minor: number;
  isLoading?: boolean;
}

export function GapAnalysisWidget({ critical, important, minor, isLoading }: GapAnalysisWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const total = critical + important + minor;

  return (
    <Card data-testid="gap-analysis-widget">
      <CardHeader>
        <CardTitle>Gap Breakdown</CardTitle>
        <CardDescription>Compliance gaps by severity</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1" data-testid="gap-critical">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
              <span>Critical</span>
            </div>
            <span className="font-semibold">{critical}</span>
          </div>
          <Progress value={total > 0 ? (critical / total) * 100 : 0} className="h-2 bg-red-100" />
        </div>
        <div className="space-y-1" data-testid="gap-important">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2 text-yellow-600" />
              <span>Important</span>
            </div>
            <span className="font-semibold">{important}</span>
          </div>
          <Progress value={total > 0 ? (important / total) * 100 : 0} className="h-2 bg-yellow-100" />
        </div>
        <div className="space-y-1" data-testid="gap-minor">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2 text-blue-600" />
              <span>Minor</span>
            </div>
            <span className="font-semibold">{minor}</span>
          </div>
          <Progress value={total > 0 ? (minor / total) * 100 : 0} className="h-2 bg-blue-100" />
        </div>
      </CardContent>
    </Card>
  );
}

interface ActivityEvent {
  id: string;
  type: string;
  description: string;
  userName?: string;
  timestamp: Date;
}

interface ActivityFeedProps {
  activities: ActivityEvent[];
  isLoading?: boolean;
}

export function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'assessment_created':
      case 'assessment_completed':
        return <FileText className="h-4 w-4" />;
      case 'user_added':
        return <Users className="h-4 w-4" />;
      case 'facility_added':
        return <Building2 className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  return (
    <Card data-testid="activity-feed">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest updates and changes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent activity
            </p>
          ) : (
            activities.slice(0, 5).map((activity) => (
              <div 
                key={activity.id} 
                className="flex gap-3 items-start"
                data-testid={`activity-${activity.id}`}
              >
                <div className="mt-0.5 p-2 rounded-full bg-muted">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(activity.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface Deadline {
  id: string;
  title: string;
  type: string;
  dueDate: Date;
  priority: 'high' | 'medium' | 'low';
  status: 'upcoming' | 'due_soon' | 'overdue';
}

interface DeadlineListProps {
  deadlines: Deadline[];
  isLoading?: boolean;
}

export function DeadlineList({ deadlines, isLoading }: DeadlineListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'overdue': return <Badge variant="destructive">Overdue</Badge>;
      case 'due_soon': return <Badge variant="outline" className="border-yellow-600 text-yellow-600">Due Soon</Badge>;
      default: return <Badge variant="outline">Upcoming</Badge>;
    }
  };

  return (
    <Card data-testid="deadline-list">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Upcoming Deadlines
        </CardTitle>
        <CardDescription>Tasks and milestones requiring attention</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {deadlines.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No upcoming deadlines
            </p>
          ) : (
            deadlines.slice(0, 5).map((deadline) => (
              <div 
                key={deadline.id} 
                className={cn(
                  "p-3 rounded-lg border",
                  getPriorityColor(deadline.priority)
                )}
                data-testid={`deadline-${deadline.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4" />
                      <h4 className="text-sm font-medium">{deadline.title}</h4>
                    </div>
                    <p className="text-xs opacity-75">
                      Due: {new Date(deadline.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  {getStatusBadge(deadline.status)}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface CoreRequirementScores {
  cr1: number;
  cr2: number;
  cr3: number;
  cr4: number;
  cr5: number;
  cr6: number;
  cr7: number;
  cr8: number;
  cr9: number;
  cr10: number;
}

interface CoreRequirementsChartProps {
  scores: CoreRequirementScores;
  isLoading?: boolean;
}

export function CoreRequirementsChart({ scores, isLoading }: CoreRequirementsChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const requirements = Object.entries(scores).map(([key, value]) => ({
    name: key.toUpperCase().replace('CR', 'CR '),
    score: value,
  }));

  return (
    <Card data-testid="core-requirements-chart">
      <CardHeader>
        <CardTitle>Core Requirements Progress</CardTitle>
        <CardDescription>Compliance score by core requirement</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {requirements.map((req) => (
            <div key={req.name} className="space-y-1" data-testid={`cr-score-${req.name.toLowerCase()}`}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{req.name}</span>
                <span className="text-muted-foreground">{req.score}%</span>
              </div>
              <Progress value={req.score} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
