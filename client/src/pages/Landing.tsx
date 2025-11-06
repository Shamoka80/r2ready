import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { 
  CheckCircle, 
  TrendingUp, 
  Shield, 
  FileText, 
  Users, 
  Clock,
  BarChart3,
  Upload,
  Download,
  Target,
  Zap,
  Award,
  Menu // Import Menu icon
} from "lucide-react";
import rurLogo from "@assets/RuR2 Logo 1_1758184184704.png";

// Import Sheet components for the mobile menu
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function Landing() {
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: <Target className="h-6 w-6" />,
      title: "Smart R2v3 Assessment",
      description: "AI-powered questionnaire with intelligent scoping that reduces assessment time by 43-62%",
      benefits: ["REC-based question filtering", "Real-time auto-save", "Dynamic progress tracking"]
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: "Advanced Analytics",
      description: "Real-time compliance scoring and gap analysis with predictive audit success metrics",
      benefits: ["Weighted category scoring", "Risk assessment matrix", "Timeline predictions"]
    },
    {
      icon: <Upload className="h-6 w-6" />,
      title: "Evidence Management",
      description: "Professional document organization with multi-format support and progress tracking",
      benefits: ["Drag-and-drop uploads", "Question-specific organization", "Completion visualization"]
    },
    {
      icon: <Download className="h-6 w-6" />,
      title: "Professional Exports",
      description: "Audit-ready reports in PDF, Excel, and Word formats for certification submission",
      benefits: ["Technical audit reports", "Executive summaries", "Management dashboards"]
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Audit Preparation",
      description: "Comprehensive readiness toolkit with mock scenarios and corrective action tracking",
      benefits: ["Simulated audit questions", "Action item management", "Timeline milestones"]
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Team Collaboration",
      description: "Multi-user support with role-based access and centralized progress monitoring",
      benefits: ["Team assignments", "Progress visibility", "Admin oversight tools"]
    }
  ];

  const benefits = [
    {
      icon: <Clock className="h-5 w-5" />,
      title: "Reduce Assessment Time",
      description: "Smart filtering eliminates 43-62% of irrelevant questions"
    },
    {
      icon: <TrendingUp className="h-5 w-5" />,
      title: "Improve Audit Success Rate",
      description: "Data-driven preparation increases certification probability"
    },
    {
      icon: <FileText className="h-5 w-5" />,
      title: "Professional Documentation",
      description: "Generate audit-ready reports that meet R2v3 standards"
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: "Accelerate Certification",
      description: "Streamlined process reduces time-to-certification by months"
    }
  ];

  return (
    <div className="min-h-screen relative">
      {/* Header */}
      <header className="nav-glass border-b border-glass-border sticky top-0 z-50 shadow-glass">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Desktop Logo */}
            <div className="hidden md:flex items-center space-x-3">
              <img 
                src={rurLogo} 
                alt="RuR2 Logo" 
                className="w-14 h-14 rounded-glass logo-glow object-contain"
              />
              <span className="text-xl sm:text-2xl font-display font-bold text-glow-blue">RuR2</span>
            </div>

            {/* Mobile Logo - Centered */}
            <div className="absolute left-1/2 transform -translate-x-1/2 md:hidden flex items-center space-x-2">
              <img 
                src={rurLogo} 
                alt="RuR2 Logo" 
                className="w-9 h-9 rounded-glass logo-glow object-contain"
              />
              <span className="text-lg font-display font-bold text-glow-blue">RuR2</span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <Button variant="ghost" className="text-foreground hover:text-primary min-h-[44px]" onClick={() => setLocation("/about")}>
                About
              </Button>
              <Button variant="ghost" className="text-foreground hover:text-primary min-h-[44px]" onClick={() => setLocation("/help")}>
                Help
              </Button>
              <Button variant="ghost" className="text-foreground hover:text-primary min-h-[44px]" onClick={() => setLocation("/pricing")}>
                Pricing
              </Button>
              <div className="flex items-center space-x-3">
                <Button variant="ghost" className="text-foreground hover:text-primary min-h-[44px]" onClick={() => setLocation("/login")}>
                  Login
                </Button>
                <Button 
                  className="btn-primary-glass min-h-[44px]" 
                  onClick={() => setLocation("/register")}
                >
                  Get Started
                </Button>
              </div>
            </nav>

            {/* Mobile Hamburger Menu */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-2">
                    <Menu className="h-6 w-6 text-foreground" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 glass-morphism border-glass-border">
                  <div className="flex flex-col space-y-4 mt-8">
                    <Button 
                      variant="ghost" 
                      className="justify-start text-foreground hover:text-primary min-h-[44px]" 
                      onClick={() => setLocation("/about")}
                    >
                      About
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="justify-start text-foreground hover:text-primary min-h-[44px]" 
                      onClick={() => setLocation("/help")}
                    >
                      Help
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="justify-start text-foreground hover:text-primary min-h-[44px]" 
                      onClick={() => setLocation("/pricing")}
                    >
                      Pricing
                    </Button>
                    <div className="border-t border-glass-border pt-4 space-y-4">
                      <Button 
                        variant="outline" 
                        className="w-full justify-start min-h-[44px]" 
                        onClick={() => setLocation("/login")}
                      >
                        Login
                      </Button>
                      <Button 
                        className="w-full btn-primary-glass min-h-[44px]" 
                        onClick={() => setLocation("/register")}
                      >
                        Get Started
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 sm:py-16 md:py-20 relative">
        <div className="container mx-auto px-4 sm:px-6 text-center relative z-10">
          <Badge className="mb-4 sm:mb-6 glass-morphism neon-border-blue text-primary hover:shadow-neon-blue text-xs sm:text-sm px-4 py-1.5">
            Professional R2v3 Certification Platform
          </Badge>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-4 sm:mb-6 leading-tight">
            Streamline Your
            <span className="block mt-1 sm:mt-2">R2v3 Certification</span>
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed" style={{color: '#E0E0E0', WebkitTextFillColor: '#E0E0E0'}}>
            The only platform you need for R2v3 pre-certification. Intelligent assessments, 
            real-time analytics, and professional reporting—all in one comprehensive solution.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
            <Button 
              size="lg" 
              className="btn-primary-glass text-sm sm:text-base px-6 py-2.5 sm:px-8 sm:py-3 w-full sm:w-auto min-h-[44px] transform hover:scale-105 transition-transform"
              onClick={() => setLocation("/register")}
              data-testid="button-get-started"
            >
              Get Started
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="btn-secondary-glass text-sm sm:text-base px-6 py-2.5 sm:px-8 sm:py-3 w-full sm:w-auto min-h-[44px]"
              onClick={() => setLocation("/pricing")}
              data-testid="button-view-pricing"
            >
              View Pricing
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits Overview */}
      <section className="py-12 sm:py-16 md:py-20 relative">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-bold mb-3 sm:mb-4">
              Why Choose RuR2 for R2v3 Certification?
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed" style={{color: '#E0E0E0', WebkitTextFillColor: '#E0E0E0'}}>
              Purpose-built for recycling businesses seeking efficient, professional R2v3 certification
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {benefits.map((benefit, index) => (
              <Card key={index} className="text-center card-3d">
                <CardContent className="p-5 sm:p-6">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 glass-panel rounded-glass flex items-center justify-center mx-auto mb-4 neon-border-blue">
                    <div className="text-primary">
                      {benefit.icon}
                    </div>
                  </div>
                  <h3 className="font-display font-semibold text-primary mb-2 text-base sm:text-lg text-glow-blue">{benefit.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground" style={{color: '#E0E0E0', WebkitTextFillColor: '#E0E0E0'}}>{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 md:py-20 relative">
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-bold mb-3 sm:mb-4">
              Complete R2v3 Certification Suite
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto" style={{color: '#E0E0E0', WebkitTextFillColor: '#E0E0E0'}}>
              Everything you need for successful R2v3 certification, from intelligent assessments 
              to professional audit documentation
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="card-3d">
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 glass-panel rounded-glass flex items-center justify-center neon-border-green">
                      <div className="text-secondary">
                        {feature.icon}
                      </div>
                    </div>
                    <CardTitle className="text-base sm:text-lg">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-3" style={{color: '#E0E0E0', WebkitTextFillColor: '#E0E0E0'}}>{feature.description}</p>
                  <ul className="space-y-1.5">
                    {feature.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center text-xs sm:text-sm text-muted-foreground">
                        <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-secondary mr-2 flex-shrink-0" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-12 sm:py-14 md:py-16 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-secondary/5" />
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-bold mb-3 sm:mb-4">
              Simple 3-Step Process
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground" style={{color: '#E0E0E0'}}>
              From assessment to audit-ready documentation in minutes, not months
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="text-center glass-panel p-5 sm:p-6 rounded-glass">
              <div className="w-14 h-14 sm:w-16 sm:h-16 glass-morphism neon-border-blue rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <span className="text-xl sm:text-2xl font-display font-bold text-glow-blue">1</span>
              </div>
              <h3 className="text-base sm:text-lg font-display font-semibold text-primary mb-2">Smart Assessment</h3>
              <p className="text-xs sm:text-sm text-muted-foreground" style={{color: '#E0E0E0'}}>
                Complete our intelligent R2v3 questionnaire with AI-powered question filtering
              </p>
            </div>

            <div className="text-center glass-panel p-5 sm:p-6 rounded-glass">
              <div className="w-14 h-14 sm:w-16 sm:h-16 glass-morphism neon-border-green rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <span className="text-xl sm:text-2xl font-display font-bold text-glow-green">2</span>
              </div>
              <h3 className="text-base sm:text-lg font-display font-semibold text-secondary mb-2">Upload Evidence</h3>
              <p className="text-xs sm:text-sm text-muted-foreground" style={{color: '#E0E0E0'}}>
                Organize your documentation with our professional evidence management system
              </p>
            </div>

            <div className="text-center glass-panel p-5 sm:p-6 rounded-glass">
              <div className="w-14 h-14 sm:w-16 sm:h-16 glass-morphism neon-border-orange rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <span className="text-xl sm:text-2xl font-display font-bold text-glow-orange">3</span>
              </div>
              <h3 className="text-base sm:text-lg font-display font-semibold text-accent mb-2">Export Reports</h3>
              <p className="text-xs sm:text-sm text-muted-foreground" style={{color: '#E0E0E0'}}>
                Generate professional audit packages ready for R2v3 certification submission
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 md:py-20 relative">
        <div className="container mx-auto px-4 sm:px-6 text-center relative z-10">
          <div className="glass-panel p-6 sm:p-8 md:p-10 rounded-glass max-w-3xl mx-auto">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-bold mb-3 sm:mb-4">
              Ready to Accelerate Your R2v3 Certification?
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto" style={{color: '#E0E0E0'}}>
              Join recycling businesses worldwide who trust RuR2 for professional R2v3 certification success
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Button 
                size="lg" 
                className="btn-primary-glass px-6 py-2.5 sm:px-8 sm:py-3 w-full sm:w-auto min-h-[44px]"
                onClick={() => setLocation("/register")}
              >
                Get Started Now
              </Button>
              <Button 
                size="lg" 
                className="btn-secondary-glass px-6 py-2.5 sm:px-8 sm:py-3 w-full sm:w-auto min-h-[44px]"
                onClick={() => setLocation("/pricing")}
              >
                View Pricing Plans
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="nav-glass border-t border-glass-border py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 glass-morphism neon-border-green rounded-glass flex items-center justify-center">
                  <Award className="h-5 w-5 text-secondary" />
                </div>
                <span className="text-xl font-display font-bold text-glow-blue">RuR2</span>
              </div>
              <p className="text-muted-foreground" style={{color: '#E0E0E0'}}>
                Professional R2v3 certification platform for recycling businesses worldwide.
              </p>
            </div>

            <div>
              <h4 className="font-display font-semibold text-primary mb-4">Platform</h4>
              <ul className="space-y-2">
                <li><Button variant="link" className="text-muted-foreground px-2 py-3 hover:text-primary" style={{ minHeight: '44px' }} onClick={() => setLocation("/")}>Features</Button></li>
                <li><Button variant="link" className="text-muted-foreground px-2 py-3 hover:text-primary" style={{ minHeight: '44px' }} onClick={() => setLocation("/pricing")}>Pricing</Button></li>
                <li><Button variant="link" className="text-muted-foreground px-2 py-3 hover:text-primary" style={{ minHeight: '44px' }} onClick={() => setLocation("/about")}>About Us</Button></li>
                <li><Button variant="link" className="text-muted-foreground px-2 py-3 hover:text-primary" style={{ minHeight: '44px' }} onClick={() => setLocation("/help")}>Help & Support</Button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-display font-semibold text-secondary mb-4">R2v3 Certification</h4>
              <ul className="space-y-2">
                <li className="text-muted-foreground">Self-Assessment</li>
                <li className="text-muted-foreground">Evidence Management</li>
                <li className="text-muted-foreground">Audit Preparation</li>
                <li className="text-muted-foreground">Professional Reports</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-glass-border mt-8 pt-8 text-center">
            <p className="text-muted-foreground" style={{color: '#E0E0E0'}}>
              © 2024 RuR2. Professional R2v3 certification platform.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}