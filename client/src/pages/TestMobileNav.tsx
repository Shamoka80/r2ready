
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import rurLogo from "@assets/RuR2 Logo 1_1758184184704.png";

export default function TestMobileNav() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen">
      {/* Header - Test Implementation */}
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
              <div className="relative flex-shrink-0">
                <img 
                  src={rurLogo} 
                  alt="RuR2 Logo" 
                  className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-glass shadow-glass object-contain"
                />
                <div className="absolute inset-0 rounded-glass bg-gradient-to-br from-primary/20 to-secondary/20 mix-blend-overlay" />
              </div>
              <span className="text-sm sm:text-lg md:text-xl lg:text-2xl font-display font-bold text-glow-blue whitespace-nowrap">RuR2</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              <Button variant="ghost">Desktop Nav 1</Button>
              <Button variant="ghost">Desktop Nav 2</Button>
              <Button className="btn-primary-glass">Desktop CTA</Button>
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
                      onClick={() => setLocation("/help")}
                    >
                      Help
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

      {/* Test Content */}
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Mobile Navigation Test Page</h1>
        
        <div className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">Test Instructions:</h2>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>1. Resize browser to mobile width (&lt; 768px)</li>
              <li>2. Verify logo is centered</li>
              <li>3. Verify hamburger menu appears on right</li>
              <li>4. Click hamburger to open menu</li>
              <li>5. Verify menu opens from right side</li>
              <li>6. Test navigation links work</li>
            </ul>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded">
              <h3 className="font-semibold">Desktop View</h3>
              <p className="text-sm">Logo left, nav right</p>
            </div>
            <div className="bg-green-50 p-4 rounded">
              <h3 className="font-semibold">Tablet View</h3>
              <p className="text-sm">Responsive layout</p>
            </div>
            <div className="bg-purple-50 p-4 rounded">
              <h3 className="font-semibold">Mobile View</h3>
              <p className="text-sm">Logo centered, hamburger right</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
