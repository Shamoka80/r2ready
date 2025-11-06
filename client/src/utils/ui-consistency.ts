
// UI Consistency utilities for standardized components and states

export const UI_CONSTANTS = {
  // Loading messages
  LOADING_MESSAGES: {
    DEFAULT: 'Loading...',
    SAVING: 'Saving...',
    PROCESSING: 'Processing...',
    UPLOADING: 'Uploading...',
    DOWNLOADING: 'Downloading...',
    AUTHENTICATING: 'Authenticating...',
    VALIDATING: 'Validating...',
    GENERATING: 'Generating report...',
    ANALYZING: 'Analyzing data...'
  },

  // Error messages
  ERROR_MESSAGES: {
    NETWORK: 'Unable to connect to the server. Please check your connection.',
    UNAUTHORIZED: 'You are not authorized to perform this action.',
    FORBIDDEN: 'Access to this resource is forbidden.',
    NOT_FOUND: 'The requested resource was not found.',
    VALIDATION: 'Please check your input and try again.',
    SERVER: 'An internal server error occurred. Please try again later.',
    TIMEOUT: 'The request timed out. Please try again.',
    GENERIC: 'Something went wrong. Please try again.'
  },

  // Success messages
  SUCCESS_MESSAGES: {
    SAVED: 'Changes saved successfully',
    CREATED: 'Created successfully',
    UPDATED: 'Updated successfully',
    DELETED: 'Deleted successfully',
    UPLOADED: 'File uploaded successfully',
    EXPORTED: 'Export completed successfully',
    INVITED: 'Invitation sent successfully',
    VERIFIED: 'Verification completed'
  },

  // Animation durations (in milliseconds)
  ANIMATIONS: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500
  },

  // Z-index layers
  Z_INDEX: {
    DROPDOWN: 1000,
    MODAL: 1050,
    TOOLTIP: 1100,
    NOTIFICATION: 1200
  }
} as const;

// Standardized toast notifications
export interface ToastOptions {
  title?: string;
  description: string;
  variant?: 'default' | 'destructive' | 'success';
  duration?: number;
}

export const createStandardToast = (
  type: 'success' | 'error' | 'info' | 'warning',
  message: string,
  title?: string
): ToastOptions => {
  const variants = {
    success: 'default' as const,
    error: 'destructive' as const,
    info: 'default' as const,
    warning: 'default' as const
  };

  return {
    title: title || type.charAt(0).toUpperCase() + type.slice(1),
    description: message,
    variant: variants[type],
    duration: type === 'error' ? 7000 : 5000
  };
};

// Form validation styling
export const getFieldErrorClass = (hasError: boolean): string => {
  return hasError 
    ? 'border-destructive focus-visible:ring-destructive' 
    : '';
};

export const getFieldValidClass = (isValid: boolean, touched: boolean): string => {
  return isValid && touched 
    ? 'border-green-500 focus-visible:ring-green-500' 
    : '';
};

// Button state management
export interface ButtonState {
  loading: boolean;
  disabled: boolean;
  variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

export const getButtonState = (
  isLoading: boolean = false,
  isDisabled: boolean = false,
  type: 'primary' | 'secondary' | 'danger' | 'ghost' = 'primary'
): ButtonState => {
  const variants = {
    primary: 'default' as const,
    secondary: 'outline' as const,
    danger: 'destructive' as const,
    ghost: 'ghost' as const
  };

  return {
    loading: isLoading,
    disabled: isDisabled || isLoading,
    variant: variants[type]
  };
};

// Consistent spacing utilities
export const SPACING = {
  SECTION: 'mb-8',
  SUBSECTION: 'mb-6',
  ELEMENT: 'mb-4',
  SMALL: 'mb-2',
  FORM_FIELD: 'space-y-2',
  FORM_GROUP: 'space-y-4',
  CARD_PADDING: 'p-6',
  MODAL_PADDING: 'p-6',
  PAGE_PADDING: 'p-4 md:p-6 lg:p-8'
} as const;

// Color variants for consistent theming
export const COLOR_VARIANTS = {
  STATUS: {
    success: 'text-green-600 bg-green-50 border-green-200',
    warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    error: 'text-red-600 bg-red-50 border-red-200',
    info: 'text-blue-600 bg-blue-50 border-blue-200'
  },
  BADGES: {
    primary: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800'
  }
} as const;

// Responsive breakpoint helpers
export const BREAKPOINTS = {
  SM: '640px',
  MD: '768px',
  LG: '1024px',
  XL: '1280px',
  '2XL': '1536px'
} as const;

// Accessibility helpers
export const A11Y = {
  // ARIA live region announcements
  announceToScreenReader: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  },

  // Focus management
  trapFocus: (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }
} as const;

// Performance optimizations
export const PERFORMANCE = {
  // Debounce function for search inputs
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  // Throttle function for scroll events
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
} as const;
