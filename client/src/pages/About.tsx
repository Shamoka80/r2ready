import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { 
  ArrowLeft, 
  Award,
  Target,
  Users,
  Globe,
  Shield,
  Zap,
  TrendingUp,
  CheckCircle,
  Star,
  Building,
  Recycle,
  Menu // Import Menu icon
} from "lucide-react";
import rurLogo from "@assets/RuR2 Logo 1_1758184184704.png";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"; // Import Sheet components

export default function About() {
  const [, setLocation] = useLocation();

  const stats = [
    { number: "10,000+", label: "Questions Processed", icon: <CheckCircle className="h-5 w-5" /> },
    { number: "500+", label: "Businesses Served", icon: <Building className="h-5 w-5" /> },
    { number: "85%", label: "Audit Success Rate", icon: <Star className="h-5 w-5" /> },
    { number: "60%", label: "Time Reduction", icon: <Zap className="h-5 w-5" /> }
  ];

  const values = [
    {
      icon: <Shield className="h-8 w-8" />,
      title: "Environmental Responsibility",
      description: "We're committed to advancing responsible electronics recycling practices that protect our planet and communities."
    },
    {
      icon: <Users className="h-8 w-8" />,
      title: "Customer Success",
      description: "Your certification success is our mission. We provide the tools, guidance, and support needed to achieve R2v3 compliance."
    },
    {
      icon: <Zap className="h-8 w-8" />,
      title: "Innovation & Efficiency",
      description: "We leverage cutting-edge technology to streamline complex compliance processes and reduce certification timelines."
    },
    {
      icon: <Globe className="h-8 w-8" />,
      title: "Industry Leadership",
      description: "We set the standard for R2v3 preparation tools, working closely with certification bodies and industry experts."
    }
  ];

  const team = [
    {
      name: "Sarah Chen",
      role: "CEO & Founder",
      bio: "Former R2v3 auditor with 15+ years in electronics recycling compliance",
      expertise: ["R2v3 Auditing", "Environmental Compliance", "Business Strategy"]
    },
    {
      name: "Michael Rodriguez",
      role: "CTO",
      bio: "Technology leader specializing in compliance automation and data security",
      expertise: ["Software Architecture", "Data Security", "AI/ML Systems"]
    },
    {
      name: "Dr. Lisa Thompson",
      role: "Head of Compliance",
      bio: "Environmental scientist and R2v3 standard development contributor",
      expertise: ["R2v3 Standard", "Environmental Science", "Regulatory Affairs"]
    },
    {
      name: "James Wilson",
      role: "Customer Success Lead",
      bio: "Dedicated to ensuring every customer achieves certification success",
      expertise: ["Customer Support", "Training Programs", "Process Optimization"]
    }
  ];

  return (
    <div className="min-h-screen relative">
      {/* Header */}
      <header className="nav-glass border-b border-glass-border sticky top-0 z-50 shadow-glass">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Back Button */}
            <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
              <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Back</span>
              <span className="xs:hidden">←</span>
            </Button>

            {/* Logo - Centered on Mobile, Left on Desktop */}
            <div className="absolute left-1/2 transform -translate-x-1/2 md:static md:transform-none md:translate-x-0 md:ml-6 flex items-center space-x-2 sm:space-x-3">
              <img 
                src={rurLogo} 
                alt="RuR2 Logo" 
                className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-glass logo-glow object-contain"
              />
              <span className="text-sm sm:text-lg md:text-xl lg:text-2xl font-display font-bold text-glow-blue whitespace-nowrap">RuR2</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              <Button variant="ghost" onClick={() => setLocation("/help")}>Help</Button>
              <Button variant="ghost" onClick={() => setLocation("/pricing")}>Pricing</Button>
              <Button className="btn-primary-glass" onClick={() => setLocation("/register")}>Get Started</Button>
            </div>

            {/* Mobile Hamburger Menu */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-2">
                    <Menu className="h-6 w-6 text-foreground" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 glass-morphism border-glass-border">
                  <div className="flex flex-col space-y-4 mt-8">
                    <Button 
                      variant="ghost" 
                      className="justify-start text-foreground hover:text-primary" 
                      onClick={() => setLocation("/")}
                    >
                      Home
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="justify-start text-foreground hover:text-primary" 
                      onClick={() => setLocation("/help")}
                    >
                      Help
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="justify-start text-foreground hover:text-primary" 
                      onClick={() => setLocation("/pricing")}
                    >
                      Pricing
                    </Button>
                    <div className="border-t border-glass-border pt-4 space-y-4">
                      <Button 
                        variant="outline" 
                        className="w-full justify-start" 
                        onClick={() => setLocation("/login")}
                      >
                        Login
                      </Button>
                      <Button 
                        className="w-full btn-primary-glass" 
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
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Recycle className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Transforming R2v3 Certification
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 max-w-4xl mx-auto">
            We're on a mission to make R2v3 certification accessible, efficient, and successful for 
            recycling businesses worldwide. Our platform combines deep industry expertise with 
            cutting-edge technology to revolutionize the certification process.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="btn-primary-glass"
              onClick={() => setLocation("/new-assessment")}
            >
              Start Your Journey
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => setLocation("/help")}
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-4">Our Impact</h2>
            <p className="text-lg text-muted-foreground">Measurable results that matter to the recycling industry</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <Card key={index} className="text-center border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <div className="text-primary">
                      {stat.icon}
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-foreground mb-2">{stat.number}</div>
                  <p className="text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-6">Our Story</h2>
            </div>

            <div className="prose prose-lg mx-auto text-muted-foreground">
              <p className="text-base sm:text-lg md:text-xl leading-relaxed mb-6">
                RuR2 was born from firsthand experience with the complexities of R2v3 certification. 
                Our founder, Sarah Chen, spent over a decade as an R2v3 auditor and witnessed 
                countless businesses struggle with outdated, inefficient preparation methods.
              </p>

              <p className="text-lg leading-relaxed mb-6">
                The traditional approach to R2v3 certification often took 12-18 months, involved 
                mountains of paperwork, and left businesses uncertain about their readiness. 
                We knew there had to be a better way.
              </p>

              <p className="text-lg leading-relaxed mb-8">
                In 2023, we assembled a team of R2v3 experts, technology innovators, and industry 
                veterans to create the first truly intelligent R2v3 preparation platform. Today, 
                RuR2 helps recycling businesses achieve certification 40-60% faster while 
                improving their audit success rates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-4">What Drives Us</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Our values guide everything we do, from product development to customer support
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {values.map((value, index) => (
              <div key={index} className="flex space-x-4">
                <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <div className="text-primary">
                    {value.icon}
                  </div>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg md:text-xl font-semibold text-foreground mb-3">{value.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{value.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-4">Meet Our Team</h2>
            <p className="text-lg text-muted-foreground">
              Industry experts dedicated to your certification success
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <Card key={index} className="text-center glass-morphism border-glass-border">
                <CardHeader>
                  <div className="w-20 h-20 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-4 border border-primary/30">
                    <Users className="h-10 w-10 text-primary" />
                  </div>
                  <CardTitle className="text-lg text-glow-blue mb-2">{member.name}</CardTitle>
                  <Badge 
                    variant="outline" 
                    className="mx-auto border-amber-500/50 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                  >
                    {member.role}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{member.bio}</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {member.expertise.map((skill, idx) => (
                      <Badge 
                        key={idx} 
                        variant="outline" 
                        className="text-xs border-white/30 text-foreground bg-background/50 hover:bg-background/70"
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-20 glass-morphism">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <Target className="h-16 w-16 text-white mx-auto mb-6" />
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-6">Our Mission</h2>
            <p className="text-base sm:text-lg md:text-xl text-jade-100 leading-relaxed">
              To democratize R2v3 certification by providing intelligent, efficient, and 
              comprehensive preparation tools that empower recycling businesses of all sizes 
              to achieve compliance, protect the environment, and build sustainable operations.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-4">
            Ready to Join the RuR2 Community?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Experience the future of R2v3 certification preparation and join hundreds of 
            successful recycling businesses
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="btn-primary-glass"
              onClick={() => setLocation("/new-assessment")}
            >
              Start Your Assessment
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => setLocation("/help")}
            >
              Contact Our Team
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-muted-foreground py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            {/* Removed the unnecessary button and used the logo */}
            <img src={rurLogo} alt="RuR2 Logo" className="h-8 w-8" />
            <span className="text-base sm:text-lg md:text-xl font-bold text-white">RuR2</span>
          </div>
          <p className="text-muted-foreground/70">
            Transforming R2v3 certification • One recycler at a time
          </p>
        </div>
      </footer>
    </div>
  );
}