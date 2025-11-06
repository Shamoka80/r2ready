import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { 
  ArrowLeft, 
  Award,
  HelpCircle,
  BookOpen,
  MessageCircle,
  Mail,
  Phone,
  FileText,
  Users,
  Clock,
  CheckCircle,
  Search,
  Download,
  Play,
  Menu
} from "lucide-react";
import rurLogo from "@assets/RuR2 Logo 1_1758184184704.png";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";


export default function Help() {
  const [, setLocation] = useLocation();

  const faqItems = [
    {
      question: "What is R2v3 certification and why do I need it?",
      answer: "R2v3 (Responsible Recycling v3) is the leading global standard for electronics recycling. It ensures proper handling of electronic waste, data security, and environmental responsibility. Certification is often required by major corporations and government agencies when selecting recycling partners."
    },
    {
      question: "How long does the R2v3 certification process typically take?",
      answer: "The traditional process can take 6-18 months. With RuR2's intelligent assessment and preparation tools, most businesses reduce this timeline by 40-60%, completing certification in 3-8 months depending on their readiness level."
    },
    {
      question: "What makes RuR2 different from other R2v3 preparation tools?",
      answer: "RuR2 uses AI-powered question filtering that reduces assessment time by 43-62%. Our REC (Recycling Equipment Category) mapping intelligently scopes your assessment, and our professional reporting generates audit-ready documentation that meets certification body standards."
    },
    {
      question: "Can I use RuR2 for multiple facilities?",
      answer: "Yes! Our Team Business plan supports 2 facilities, and Enterprise Multi-Site supports 3+ facilities. Each facility gets its own scope statement and tracking, with centralized oversight tools for management."
    },
    {
      question: "What file formats can I upload as evidence?",
      answer: "RuR2 supports all major formats: PDF, DOC/DOCX, XLS/XLSX, JPG/PNG/GIF, TXT, and CSV files. Each question can have multiple evidence files, and we provide secure storage with download/delete capabilities."
    },
    {
      question: "How accurate is the audit success probability prediction?",
      answer: "Our predictive analytics are based on thousands of real R2v3 audit outcomes. The system analyzes your gap coverage, evidence quality, and compliance strength to provide realistic success probability estimates with 85%+ accuracy."
    },
    {
      question: "Do I need technical expertise to use RuR2?",
      answer: "No technical expertise required! RuR2 is designed for compliance managers, environmental coordinators, and business owners. Our intuitive interface guides you through each step with help text and best practices."
    },
    {
      question: "Can consultants use RuR2 for their clients?",
      answer: "Absolutely! We offer specialized consultant plans that allow managing multiple client businesses. Features include client collaboration tools, dedicated dashboards, and white-label options for larger agencies."
    }
  ];

  const supportResources = [
    {
      icon: <BookOpen className="h-6 w-6" />,
      title: "Knowledge Base",
      description: "Comprehensive guides and tutorials for R2v3 certification",
      action: "Browse Articles"
    },
    {
      icon: <Play className="h-6 w-6" />,
      title: "Video Tutorials",
      description: "Step-by-step walkthroughs of assessment and evidence management",
      action: "Watch Videos"
    },
    {
      icon: <FileText className="h-6 w-6" />,
      title: "R2v3 Standard Guide",
      description: "Download the official R2v3 standard documentation",
      action: "Download PDF"
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Community Forum",
      description: "Connect with other recyclers and share best practices",
      action: "Join Discussion"
    }
  ];

  const contactMethods = [
    {
      icon: <Mail className="h-5 w-5" />,
      title: "Email Support",
      description: "Get detailed help from our R2v3 experts",
      contact: "support@rur2.com",
      response: "24-48 hour response"
    },
    {
      icon: <MessageCircle className="h-5 w-5" />,
      title: "Live Chat",
      description: "Quick answers to immediate questions",
      contact: "Available 9 AM - 5 PM EST",
      response: "Instant response"
    },
    {
      icon: <Phone className="h-5 w-5" />,
      title: "Phone Consultation",
      description: "Speak directly with certification consultants",
      contact: "+1 (555) 123-4567",
      response: "Schedule callback"
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
              <Button variant="ghost" onClick={() => setLocation("/about")}>About</Button>
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
                      onClick={() => setLocation("/about")}
                    >
                      About
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
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <HelpCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            How Can We Help You?
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Get the support you need to successfully complete your R2v3 certification journey
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Search for help articles, guides, or FAQs..." 
                className="pl-10 py-3 text-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Quick Help Resources */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-8 text-center">Quick Resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {supportResources.map((resource, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <div className="text-primary">
                      {resource.icon}
                    </div>
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{resource.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{resource.description}</p>
                  <Button variant="outline" size="sm" className="w-full">
                    {resource.action}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-4">Frequently Asked Questions</h2>
            <p className="text-lg text-muted-foreground">Common questions about R2v3 certification and RuR2</p>
          </div>

          <div className="max-w-4xl mx-auto space-y-6">
            {faqItems.map((faq, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg text-foreground flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                    {faq.question}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed ml-8">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Support */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-4">Contact Our Support Team</h2>
            <p className="text-lg text-muted-foreground">Need personalized help? Our R2v3 experts are here to assist you</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {contactMethods.map((method, index) => (
              <Card key={index} className="text-center">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <div className="text-primary">
                      {method.icon}
                    </div>
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{method.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{method.description}</p>
                  <div className="text-primary font-medium mb-1">{method.contact}</div>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {method.response}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Contact Form */}
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-center">Send Us a Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Name</label>
                  <Input placeholder="Your full name" />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Email</label>
                  <Input type="email" placeholder="your@email.com" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Subject</label>
                <Input placeholder="What can we help you with?" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Message</label>
                <Textarea 
                  placeholder="Please describe your question or issue in detail..." 
                  rows={5}
                />
              </div>
              <Button className="w-full btn-primary-glass">
                Send Message
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-muted-foreground py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <img src={rurLogo} alt="RuR2 Logo" className="h-8 w-8 rounded-glass logo-glow" />
            <span className="text-base sm:text-lg md:text-xl font-bold text-white">RuR2</span>
          </div>
          <p className="text-muted-foreground/70">
            Professional R2v3 certification support • Available when you need us
          </p>
        </div>
      </footer>
    </div>
  );
}