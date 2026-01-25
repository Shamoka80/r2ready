import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocation } from "wouter";
import { 
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
  Play,
  Loader2,
  AlertCircle
} from "lucide-react";
import { apiPost } from "@/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";


export default function Help() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const [formData, setFormData] = useState({
    name: user ? `${user.firstName} ${user.lastName}` : '',
    email: user?.email || '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Scroll to contact form on page load (Help links should go directly to Send a Note)
  useEffect(() => {
    setTimeout(() => {
      const contactSection = document.getElementById('contact-form');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      setSubmitError('Please fill in all fields');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setSubmitError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const response = await apiPost<{ success: boolean; message: string }>('/api/contact', formData);
      
      if (response.success) {
        setSubmitSuccess(true);
        setFormData({
          name: user ? `${user.firstName} ${user.lastName}` : '',
          email: user?.email || '',
          subject: '',
          message: ''
        });
        toast({
          title: "Message sent successfully",
          description: "You will receive a confirmation email shortly.",
        });
      } else {
        throw new Error(response.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Contact form submission error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message. Please try again later.';
      setSubmitError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
      action: "Browse Articles",
      url: "https://sustainableelectronics.org/welcome-to-r2v3/document-library/"
    },
    {
      icon: <Play className="h-6 w-6" />,
      title: "Video Tutorials",
      description: "Step-by-step walkthroughs of assessment and evidence management",
      action: "Watch Videos",
      url: "https://youtu.be/8FneD-GrQ5g?si=1tdjPR2rULFNZALN"
    },
    {
      icon: <FileText className="h-6 w-6" />,
      title: "R2v3 Standard Guide",
      description: "Download the official R2v3 standard documentation",
      action: "Download PDF",
      url: "https://sustainableelectronics.org/welcome-to-r2v3/r2v3-standard-download-2/"
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Community Forum",
      description: "Connect with other recyclers and share best practices",
      action: "Join Discussion",
      url: "https://wrekdtech.com/community-r2v3app"
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
                  <a 
                    href={resource.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block w-full"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      {resource.action}
                    </Button>
                  </a>
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
      <section id="contact-form" className="py-16 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-4">Send a Note</h2>
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
              {submitSuccess && (
                <Alert className="bg-green-500/10 border-green-500">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-700 dark:text-green-400">
                    Your message has been sent successfully! You will receive a confirmation email shortly.
                  </AlertDescription>
                </Alert>
              )}
              
              {submitError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Name</label>
                  <Input 
                    placeholder="Your full name" 
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Email</label>
                  <Input 
                    type="email" 
                    placeholder="your@email.com" 
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={isSubmitting || !!user}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Subject</label>
                <Input 
                  placeholder="What can we help you with?" 
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Message</label>
                <Textarea 
                  placeholder="Please describe your question or issue in detail..." 
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <Button 
                className="w-full btn-primary-glass"
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.name || !formData.email || !formData.subject || !formData.message}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Message'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

    </div>
  );
}