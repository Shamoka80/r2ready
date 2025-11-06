// Accessibility utilities for WCAG 2.2 AAA compliance

/**
 * Announce text to screen readers without visual display
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.setAttribute('class', 'sr-only');
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove the announcement after a short delay
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Manage focus for complex interactions
 */
export class FocusManager {
  private focusStack: HTMLElement[] = [];
  private trapContainer: HTMLElement | null = null;

  /**
   * Save current focus and optionally move to new element
   */
  saveFocus(newFocus?: HTMLElement): void {
    const currentFocus = document.activeElement as HTMLElement;
    if (currentFocus && currentFocus !== document.body) {
      this.focusStack.push(currentFocus);
    }
    
    if (newFocus) {
      newFocus.focus();
    }
  }

  /**
   * Restore previously saved focus
   */
  restoreFocus(): void {
    const previousFocus = this.focusStack.pop();
    if (previousFocus && document.contains(previousFocus)) {
      previousFocus.focus();
    }
  }

  /**
   * Trap focus within a container (for modals, menus, etc.)
   */
  trapFocus(container: HTMLElement): void {
    this.trapContainer = container;
    container.addEventListener('keydown', this.handleFocusTrap);
  }

  /**
   * Release focus trap
   */
  releaseFocusTrap(): void {
    if (this.trapContainer) {
      this.trapContainer.removeEventListener('keydown', this.handleFocusTrap);
      this.trapContainer = null;
    }
  }

  private handleFocusTrap = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab' || !this.trapContainer) return;

    const focusableElements = this.getFocusableElements(this.trapContainer);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const currentFocus = document.activeElement;

    if (e.shiftKey) {
      // Shift + Tab
      if (currentFocus === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      // Tab
      if (currentFocus === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([disabled])',
      '[role="link"]:not([disabled])',
      '[role="menuitem"]:not([disabled])',
      '[role="tab"]:not([disabled])'
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
  }
}

/**
 * Enhanced keyboard navigation support
 */
export class KeyboardNavigationManager {
  private elements: HTMLElement[] = [];
  private currentIndex = -1;

  constructor(elements: HTMLElement[]) {
    this.elements = elements;
  }

  /**
   * Handle arrow key navigation
   */
  handleArrowKeys(e: KeyboardEvent): boolean {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        this.moveNext();
        return true;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        this.movePrevious();
        return true;
      case 'Home':
        e.preventDefault();
        this.moveToFirst();
        return true;
      case 'End':
        e.preventDefault();
        this.moveToLast();
        return true;
      default:
        return false;
    }
  }

  private moveNext(): void {
    this.currentIndex = (this.currentIndex + 1) % this.elements.length;
    this.focusCurrent();
  }

  private movePrevious(): void {
    this.currentIndex = this.currentIndex <= 0 ? this.elements.length - 1 : this.currentIndex - 1;
    this.focusCurrent();
  }

  private moveToFirst(): void {
    this.currentIndex = 0;
    this.focusCurrent();
  }

  private moveToLast(): void {
    this.currentIndex = this.elements.length - 1;
    this.focusCurrent();
  }

  private focusCurrent(): void {
    const currentElement = this.elements[this.currentIndex];
    if (currentElement) {
      currentElement.focus();
    }
  }
}

/**
 * Generate unique IDs for accessibility relationships
 */
export function generateAccessibilityId(prefix: string = 'a11y'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if an element is visible to screen readers
 */
export function isElementAccessible(element: HTMLElement): boolean {
  // Check if element is hidden from screen readers
  if (element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  // Check if element or any parent has display: none or visibility: hidden
  let current: HTMLElement | null = element;
  while (current && current !== document.body) {
    const styles = window.getComputedStyle(current);
    if (styles.display === 'none' || styles.visibility === 'hidden') {
      return false;
    }
    current = current.parentElement;
  }

  return true;
}

/**
 * Enhanced error announcement for forms
 */
export function announceFormError(fieldName: string, errorMessage: string): void {
  const message = `Error in ${fieldName}: ${errorMessage}`;
  announceToScreenReader(message, 'assertive');
}

/**
 * Success announcement for completed actions
 */
export function announceSuccess(message: string): void {
  announceToScreenReader(`Success: ${message}`, 'polite');
}

/**
 * Loading state announcement
 */
export function announceLoading(action: string): void {
  announceToScreenReader(`Loading ${action}...`, 'polite');
}

/**
 * Create accessible loading indicator
 */
export function createLoadingIndicator(container: HTMLElement, label: string): void {
  container.setAttribute('aria-busy', 'true');
  container.setAttribute('aria-label', `Loading ${label}`);
  
  // Add loading text for screen readers
  const loadingText = document.createElement('span');
  loadingText.className = 'sr-only';
  loadingText.textContent = `Loading ${label}...`;
  container.appendChild(loadingText);
}

/**
 * Remove loading indicator
 */
export function removeLoadingIndicator(container: HTMLElement): void {
  container.removeAttribute('aria-busy');
  container.removeAttribute('aria-label');
  
  // Remove loading text
  const loadingText = container.querySelector('.sr-only');
  if (loadingText?.parentNode) {
    loadingText.parentNode.removeChild(loadingText);
  }
}

/**
 * Enhanced button accessibility
 */
export function enhanceButtonAccessibility(
  button: HTMLElement,
  options: {
    label?: string;
    description?: string;
    pressed?: boolean;
    expanded?: boolean;
    controls?: string;
  }
): void {
  if (options.label) {
    button.setAttribute('aria-label', options.label);
  }
  
  if (options.description) {
    const descId = generateAccessibilityId('desc');
    button.setAttribute('aria-describedby', descId);
    
    const description = document.createElement('span');
    description.id = descId;
    description.className = 'sr-only';
    description.textContent = options.description;
    button.appendChild(description);
  }
  
  if (typeof options.pressed === 'boolean') {
    button.setAttribute('aria-pressed', options.pressed.toString());
  }
  
  if (typeof options.expanded === 'boolean') {
    button.setAttribute('aria-expanded', options.expanded.toString());
  }
  
  if (options.controls) {
    button.setAttribute('aria-controls', options.controls);
  }
}

// Global focus manager instance
export const focusManager = new FocusManager();

// Initialize skip link when DOM is ready
export function initializeSkipLink(): void {
  if (document.querySelector('.skip-link')) return; // Already initialized

  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.className = 'skip-link';
  skipLink.textContent = 'Skip to main content';
  
  document.body.insertBefore(skipLink, document.body.firstChild);
}

// Skip link initialization disabled per user request
// if (typeof window !== 'undefined') {
//   if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', initializeSkipLink);
//   } else {
//     initializeSkipLink();
//   }
// }