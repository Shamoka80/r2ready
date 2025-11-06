import { ReactNode, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Home, FileText, Plus, Settings, LogOut, Menu, X, Bell, User, Factory, CreditCard, BookOpen, ArrowLeft, HelpCircle } from 'lucide-react';
import { Link } from 'wouter';
import rurLogo from "@assets/RuR2 Logo 1_1758184184704.png";
import FacilitySwitcher from '@/components/facility/FacilitySwitcher';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { announceToScreenReader, focusManager } from '@/utils/accessibility';
import { useTranslation } from 'react-i18next';
import { useFeatureFlag } from '@/lib/flags';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AvatarImage } from '@radix-ui/react-avatar';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useTranslation();
  const isTrainingCenterEnabled = useFeatureFlag('training_center');

  const handleLogout = () => {
    announceToScreenReader(t('navigation.logout'), 'polite');
    // Save current location before logout so user can return here after re-login
    localStorage.setItem('lastLocation', location);
    logout();
    setLocation('/');
  };

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileMenuOpen]);

  const navigationItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home, active: location === "/dashboard" },
    { href: "/assessments", label: "Assessments", icon: FileText, active: location.startsWith("/assessments") },
    { href: "/facilities", label: "Facilities", icon: Factory, active: location === "/facilities" },
    { href: "/team", label: "Team", icon: User, active: location === "/team" },
    { href: "/reports", label: "Reports", icon: FileText, active: location === "/reports" },
    { href: "/licenses", label: "Billing & Subscription", icon: CreditCard, active: location === "/licenses" },
    { href: "/settings", label: "Settings", icon: Settings, active: location === "/settings" },
    { href: "/help", label: "Support / Help", icon: HelpCircle, active: location === "/help" },
    ...(isTrainingCenterEnabled ? [{ href: "/training-center", label: "Training", icon: BookOpen, active: location === "/training-center" }] : []),
  ];

  const recentAssessments = [
    { id: "1", name: "Security Assessment 2024", lastModified: "2 hours ago" },
    { id: "2", name: "Compliance Review Q4", lastModified: "Yesterday" },
  ];

  // Navigation component for reuse in both mobile and desktop
  const NavigationItems = ({ onItemClick = () => {} }: { onItemClick?: () => void }) => (
    <div className="space-y-2">
      {navigationItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={`group flex items-center space-x-4 px-4 py-3 rounded-glass transition-all duration-300 font-medium relative overflow-hidden ${
              item.active
                ? "btn-primary-glass text-primary shadow-neon-blue"
                : "glass-morphism text-foreground hover:text-primary hover:shadow-neon-blue/30"
            }`}
            data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <Icon className={`w-5 h-5 transition-all duration-300 ${item.active ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
            <span className="font-display font-semibold tracking-wide">{item.label}</span>
            {item.active && (
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-glass" />
            )}
          </Link>
        );
      })}

      <div className="pt-6">
        <h3 className="px-3 text-xs font-display font-bold text-primary uppercase tracking-wider mb-4 text-glow-blue">
          Recent Assessments
        </h3>
        <div className="space-y-2">
          {recentAssessments.map((assessment) => (
            <Link
              key={assessment.id}
              href={`/assessments/${assessment.id}`}
              onClick={onItemClick}
              className={`group flex items-center space-x-3 px-3 py-3 rounded-glass transition-all duration-300 glass-morphism hover:bg-glass-light ${
                location === `/assessments/${assessment.id}`
                  ? "border border-secondary/30 bg-secondary/10 text-secondary"
                  : "text-foreground hover:text-secondary"
              }`}
              data-testid={`link-assessment-${assessment.id}`}
            >
              <FileText className="w-4 h-4 text-secondary" />
              <div className="flex-1 truncate">
                <div className="text-sm font-medium">{assessment.name}</div>
                <div className="text-xs text-muted-foreground">{assessment.lastModified}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Analytics Dashboard Link */}
      <div className="pt-4">
        <Link href="/analytics-dashboard">
          <Button variant="ghost" className="w-full justify-start glass-morphism">
            <span className="text-accent font-display font-semibold">Analytics</span>
          </Button>
        </Link>
      </div>

      {/* Logout Button */}
      <div className="pt-4 border-t border-glass-border mt-4">
        <Button 
          variant="ghost" 
          className="w-full justify-start glass-morphism text-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-300"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="w-5 h-5 mr-4" />
          <span className="font-display font-semibold">Logout</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="nav-glass border-b border-glass-border sticky top-0 z-50 shadow-glass">
        <div className="w-full px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4">
          <div className="flex items-center justify-between max-w-full">
            {/* Back Button - Optimized for Mobile */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setLocation("/dashboard")} 
              className="flex-shrink-0 text-xs sm:text-sm px-1.5 sm:px-2 lg:px-3 py-1.5 sm:py-2 min-w-[44px] h-[44px] sm:h-auto"
            >
              <ArrowLeft className="h-4 w-4 sm:h-4 sm:w-4 mr-0 sm:mr-1 lg:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>

            {/* Logo - Always Centered on Mobile, Left-aligned on Desktop */}
            <div className="absolute left-1/2 transform -translate-x-1/2 md:static md:transform-none md:translate-x-0 md:ml-4 lg:ml-6 flex items-center space-x-2 lg:space-x-3">
              <div className="relative flex-shrink-0">
                <img 
                  src={rurLogo} 
                  alt="RuR2 Logo" 
                  className="w-8 h-8 sm:w-9 sm:h-9 md:w-[46px] md:h-[46px] lg:w-14 lg:h-14 rounded-glass logo-glow object-contain"
                />
              </div>
              <span className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-display font-bold text-glow-blue whitespace-nowrap">RuR2</span>
            </div>

            {/* Desktop User Dropdown */}
            <div className="hidden md:flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full" data-testid="button-user-menu">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={(user as any)?.profileImage || undefined} alt={user?.firstName} />
                      <AvatarFallback>{user?.firstName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 glass-morphism border-glass-border" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.firstName} {user?.lastName}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-glass-border" />
                  <DropdownMenuItem onClick={() => setLocation('/settings')} data-testid="menu-settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-glass-border" />
                  <DropdownMenuItem 
                    onClick={handleLogout} 
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                    data-testid="menu-logout"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile User Avatar - Properly Sized Touch Target */}
            <div className="md:hidden flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-[44px] w-[44px] rounded-full p-0" data-testid="button-user-menu-mobile">
                    <Avatar className="h-[44px] w-[44px]">
                      <AvatarImage src={(user as any)?.profileImage || undefined} alt={user?.firstName} />
                      <AvatarFallback className="text-sm">{user?.firstName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 glass-morphism border-glass-border" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.firstName} {user?.lastName}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-glass-border" />
                  <DropdownMenuItem onClick={() => setLocation('/settings')} data-testid="menu-settings-mobile">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-glass-border" />
                  <DropdownMenuItem 
                    onClick={handleLogout} 
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                    data-testid="menu-logout-mobile"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <aside
            className="w-72 nav-glass border-r border-glass-border shadow-glass relative"
            role="navigation"
            aria-label="Main navigation"
          >
            <nav className="relative p-6 space-y-3 z-10">
              <NavigationItems />
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main
          id="main-content"
          className="flex-1 overflow-auto relative"
          role="main"
          aria-label="Main content"
          tabIndex={-1}
        >
          <div className="p-4 sm:p-6 relative z-10">
            {children}
          </div>

        </main>
      </div>
    </div>
  );
}