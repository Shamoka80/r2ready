
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, X } from "lucide-react";
import { useLocation } from "wouter";
import rurLogo from "@assets/RuR2 Logo 1_1758184184704.png";

interface MobileNavigationProps {
  navigationItems: Array<{
    label: string;
    href: string;
    onClick?: () => void;
  }>;
  showAuth?: boolean;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
}

export default function MobileNavigation({ 
  navigationItems, 
  showAuth = true, 
  onLoginClick, 
  onRegisterClick 
}: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();

  const handleNavClick = (href: string, onClick?: () => void) => {
    if (onClick) {
      onClick();
    } else {
      setLocation(href);
    }
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden p-2 min-w-[44px] h-[44px] flex items-center justify-center">
          <Menu className="h-6 w-6" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(85vw,320px)] p-0 max-w-none">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b min-h-[60px]">
            <div className="flex items-center space-x-3">
              <img src={rurLogo} alt="RuR2 Logo" className="w-9 h-9 flex-shrink-0 rounded-glass logo-glow" />
              <span className="text-lg font-display font-bold text-primary truncate">RuR2</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="p-2 min-w-[44px] h-[44px] flex-shrink-0"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-1">
              {navigationItems.map((item, index) => (
                <li key={index}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left p-4 h-auto min-h-[48px] text-base hover:bg-glass-hover active:bg-glass-active"
                    onClick={() => handleNavClick(item.href, item.onClick)}
                  >
                    <span className="truncate">{item.label}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Auth Buttons */}
          {showAuth && (
            <div className="p-4 border-t space-y-3 flex-shrink-0">
              <Button
                variant="outline"
                className="w-full min-h-[48px] text-base font-medium"
                onClick={() => {
                  if (onLoginClick) onLoginClick();
                  else setLocation("/login");
                  setIsOpen(false);
                }}
              >
                Login
              </Button>
              <Button
                className="w-full btn-primary-glass min-h-[48px] text-base font-medium"
                onClick={() => {
                  if (onRegisterClick) onRegisterClick();
                  else setLocation("/register");
                  setIsOpen(false);
                }}
              >
                Get Started
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
