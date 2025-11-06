
import React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  showRetry?: boolean;
  showHome?: boolean;
  className?: string;
  variant?: 'default' | 'minimal' | 'fullscreen';
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  onGoHome,
  showRetry = true,
  showHome = false,
  className,
  variant = 'default'
}: ErrorStateProps) {
  const isFullscreen = variant === 'fullscreen';
  const isMinimal = variant === 'minimal';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        isFullscreen && 'min-h-screen p-8',
        !isFullscreen && 'p-8',
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      {!isMinimal && (
        <div className="mb-4">
          <AlertTriangle 
            className={cn(
              'text-destructive',
              isFullscreen ? 'h-16 w-16' : 'h-12 w-12'
            )}
            aria-hidden="true"
          />
        </div>
      )}
      
      <h2 className={cn(
        'font-semibold text-foreground mb-2',
        isFullscreen ? 'text-2xl' : 'text-xl'
      )}>
        {title}
      </h2>
      
      <p className={cn(
        'text-muted-foreground mb-6 max-w-md',
        isFullscreen ? 'text-lg' : 'text-base'
      )}>
        {message}
      </p>

      <div className="flex gap-3 flex-wrap justify-center">
        {showRetry && onRetry && (
          <Button
            onClick={onRetry}
            variant="default"
            size={isFullscreen ? 'lg' : 'default'}
            className="inline-flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try Again
          </Button>
        )}
        
        {showHome && onGoHome && (
          <Button
            onClick={onGoHome}
            variant="outline"
            size={isFullscreen ? 'lg' : 'default'}
            className="inline-flex items-center gap-2"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Go Home
          </Button>
        )}
      </div>
    </div>
  );
}

// Form field error component
interface FieldErrorProps {
  message?: string;
  className?: string;
}

export function FieldError({ message, className }: FieldErrorProps) {
  if (!message) return null;

  return (
    <p 
      className={cn(
        'text-sm text-destructive mt-1 flex items-center gap-1',
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <AlertTriangle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

// Inline error component for smaller spaces
interface InlineErrorProps {
  message: string;
  className?: string;
}

export function InlineError({ message, className }: InlineErrorProps) {
  return (
    <div 
      className={cn(
        'inline-flex items-center gap-1 text-sm text-destructive',
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

// Network error component
interface NetworkErrorProps {
  onRetry?: () => void;
  className?: string;
}

export function NetworkError({ onRetry, className }: NetworkErrorProps) {
  return (
    <ErrorState
      title="Connection Error"
      message="Unable to connect to the server. Please check your internet connection and try again."
      onRetry={onRetry}
      showRetry={!!onRetry}
      className={className}
      variant="minimal"
    />
  );
}

// Permission error component
export function PermissionError({ className }: { className?: string }) {
  return (
    <ErrorState
      title="Access Denied"
      message="You don't have permission to access this resource. Please contact your administrator if you believe this is an error."
      showRetry={false}
      showHome={true}
      className={className}
      variant="minimal"
    />
  );
}

// Not found error component
export function NotFoundError({ 
  resource = 'page',
  onGoHome,
  className 
}: { 
  resource?: string;
  onGoHome?: () => void;
  className?: string;
}) {
  return (
    <ErrorState
      title={`${resource.charAt(0).toUpperCase() + resource.slice(1)} Not Found`}
      message={`The ${resource} you're looking for doesn't exist or has been moved.`}
      onGoHome={onGoHome}
      showRetry={false}
      showHome={!!onGoHome}
      className={className}
    />
  );
}
