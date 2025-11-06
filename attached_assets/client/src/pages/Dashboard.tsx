import { Clock, CheckCircle, AlertTriangle, FileText, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Dashboard() {
  const stats = [
    { label: "Total Assessments", value: "12", icon: FileText, color: "jade" },
    { label: "In Progress", value: "3", icon: Clock, color: "sunglow" },
    { label: "Completed", value: "8", icon: CheckCircle, color: "jade" },
    { label: "Requires Review", value: "1", icon: AlertTriangle, color: "pumpkin" },
  ];

  const assessments = [
    {
      id: "1",
      name: "Security Assessment 2024",
      description: "Comprehensive security review for Q4 compliance",
      status: "In Progress",
      statusColor: "sunglow",
      lastModified: "2 hours ago",
    },
    {
      id: "2",
      name: "Compliance Review Q4",
      description: "Quarterly compliance assessment",
      status: "Completed",
      statusColor: "jade",
      lastModified: "Yesterday",
    },
    {
      id: "3",
      name: "Privacy Impact Assessment",
      description: "Data privacy compliance review",
      status: "Requires Review",
      statusColor: "pumpkin",
      lastModified: "3 days ago",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-dimgrey mt-1">Manage your R2v3 pre-certification assessments</p>
        </div>
        <Link href="/assessments/new">
          <Button className="bg-jade text-white hover:bg-jade/90" data-testid="button-new-assessment">
            <span className="mr-2">+</span>
            New Assessment
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const colorClasses = {
            jade: { bg: 'bg-jade/10', text: 'text-jade' },
            sunglow: { bg: 'bg-sunglow/10', text: 'text-sunglow' },
            pumpkin: { bg: 'bg-pumpkin/10', text: 'text-pumpkin' },
            icterine: { bg: 'bg-icterine/10', text: 'text-icterine' },
          };
          const colorClass = colorClasses[stat.color as keyof typeof colorClasses];
          return (
            <Card key={index} data-testid={`card-stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-dimgrey">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground" data-testid={`text-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
                      {stat.value}
                    </p>
                  </div>
                  <div className={`w-12 h-12 ${colorClass.bg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${colorClass.text}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Assessments Table */}
      <Card>
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Recent Assessments</h3>
        </div>
        <div className="divide-y divide-border">
          {assessments.map((assessment) => (
            <div
              key={assessment.id}
              className="px-6 py-4 hover:bg-muted/50 transition-colors"
              data-testid={`row-assessment-${assessment.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-jade/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-jade" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground" data-testid={`text-assessment-name-${assessment.id}`}>
                      {assessment.name}
                    </h4>
                    <p className="text-sm text-dimgrey">{assessment.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      assessment.statusColor === 'jade' ? 'bg-jade/10 text-jade' :
                      assessment.statusColor === 'sunglow' ? 'bg-sunglow/10 text-sunglow' :
                      assessment.statusColor === 'pumpkin' ? 'bg-pumpkin/10 text-pumpkin' :
                      'bg-icterine/10 text-icterine'
                    }`}
                    data-testid={`status-${assessment.id}`}
                  >
                    {assessment.status}
                  </span>
                  <span className="text-sm text-dimgrey">{assessment.lastModified}</span>
                  <Link href={`/assessments/${assessment.id}`}>
                    <button 
                      className="p-2 hover:bg-muted rounded-md transition-colors"
                      data-testid={`button-view-assessment-${assessment.id}`}
                    >
                      <ChevronRight className="w-4 h-4 text-dimgrey" />
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
