import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Bell, Home, Plus, FileText, Settings, User } from "lucide-react";
import rurLogo from "@assets/RuR2 Logo 1_1758184184704.png";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();

  const navigationItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home, active: location === "/" || location === "/dashboard" },
    { href: "/assessments/new", label: "New Assessment", icon: Plus, active: location === "/assessments/new" },
    { href: "/settings", label: "Settings", icon: Settings, active: location === "/settings" },
  ];

  const recentAssessments = [
    { id: "1", name: "Security Assessment 2024", lastModified: "2 hours ago" },
    { id: "2", name: "Compliance Review Q4", lastModified: "Yesterday" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-border shadow-sm z-40">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <img 
                src={rurLogo} 
                alt="RUR2 Logo" 
                className="w-8 h-8 rounded"
              />
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-foreground">RUR2</h1>
                <span className="text-xs text-dimgrey -mt-1">R2v3 Pre-Certification</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              className="p-2 rounded-md hover:bg-muted transition-colors" 
              data-testid="button-notifications"
            >
              <Bell className="w-5 h-5 text-dimgrey" />
            </button>
            <div className="w-8 h-8 bg-jade rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left Sidebar */}
        <aside className="w-64 bg-white border-r border-border shadow-sm">
          <nav className="p-4 space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                    item.active
                      ? "bg-jade/10 text-jade font-medium"
                      : "text-dimgrey hover:bg-muted hover:text-foreground"
                  }`}
                  data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            
            <div className="pt-2">
              <h3 className="px-3 text-xs font-semibold text-dimgrey uppercase tracking-wider mb-2">
                Recent Assessments
              </h3>
              {recentAssessments.map((assessment) => (
                <Link
                  key={assessment.id}
                  href={`/assessments/${assessment.id}`}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                    location === `/assessments/${assessment.id}`
                      ? "bg-jade/10 text-jade"
                      : "text-dimgrey hover:bg-muted hover:text-foreground"
                  }`}
                  data-testid={`link-assessment-${assessment.id}`}
                >
                  <FileText className="w-5 h-5" />
                  <div className="flex-1 truncate">
                    <div className="text-sm">{assessment.name}</div>
                    <div className="text-xs text-dimgrey">Modified {assessment.lastModified}</div>
                  </div>
                </Link>
              ))}
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
