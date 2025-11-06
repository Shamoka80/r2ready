
# RuR2 Accessibility Guide

## Overview

RuR2 is committed to providing an accessible experience for all users, adhering to WCAG 2.2 AAA standards. This guide outlines our accessibility features, testing procedures, and implementation guidelines.

## Accessibility Standards

### WCAG 2.2 AAA Compliance

We follow the Web Content Accessibility Guidelines 2.2 at the AAA level, which includes:

1. **Perceivable**: Information must be presentable in ways users can perceive
2. **Operable**: Interface components must be operable by all users
3. **Understandable**: Information and UI operation must be understandable
4. **Robust**: Content must be robust enough for various assistive technologies

### Contrast Ratios

All text and interactive elements meet AAA contrast requirements:
- **Normal text**: 7:1 contrast ratio minimum
- **Large text**: 4.5:1 contrast ratio minimum
- **Interactive elements**: 3:1 contrast ratio for focus indicators

## Implemented Features

### Keyboard Navigation

#### Focus Management
```typescript
// Focus trap implementation
import { focusManager } from '@/utils/accessibility';

// Trap focus in modal
const Modal = ({ isOpen, onClose, children }) => {
  useEffect(() => {
    if (isOpen) {
      const releaseTrap = focusManager.trapFocus(modalRef.current);
      return releaseTrap;
    }
  }, [isOpen]);
};
```

#### Keyboard Shortcuts
- `Tab` / `Shift+Tab`: Navigate between interactive elements
- `Enter` / `Space`: Activate buttons and links
- `Escape`: Close modals and dropdowns
- `Arrow keys`: Navigate through menus and lists
- `Home` / `End`: Jump to first/last item in lists

### Screen Reader Support

#### ARIA Labels and Descriptions
```tsx
// Comprehensive ARIA implementation
<button
  aria-label="Delete assessment"
  aria-describedby="delete-description"
  onClick={handleDelete}
>
  <TrashIcon aria-hidden="true" />
  <span id="delete-description" className="sr-only">
    This will permanently delete the assessment and cannot be undone
  </span>
</button>
```

#### Live Regions
```tsx
// Announce status changes
import { announceToScreenReader } from '@/utils/accessibility';

const handleSave = async () => {
  announceToScreenReader('Saving assessment...', 'polite');
  
  try {
    await saveAssessment();
    announceToScreenReader('Assessment saved successfully', 'polite');
  } catch (error) {
    announceToScreenReader('Error saving assessment', 'assertive');
  }
};
```

### Visual Accessibility

#### High Contrast Mode
```css
/* Automatic high contrast detection */
@media (prefers-contrast: high) {
  :root {
    --border: 0 0% 0%;
    --input: 0 0% 100%;
    --ring: 0 0% 0%;
  }
  
  button, input, select {
    border-width: 2px !important;
  }
}
```

#### Reduced Motion Support
```css
/* Respect user motion preferences */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

#### Font Size and Zoom
- Supports up to 200% zoom without horizontal scrolling
- Responsive design adapts to different font sizes
- Text remains readable at all zoom levels

### Form Accessibility

#### Error Handling
```tsx
// Accessible form validation
const FormField = ({ error, children, label, required }) => {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  return (
    <div className="space-y-2">
      <label htmlFor={fieldId} className={required ? 'required' : ''}>
        {label}
        {required && <span aria-label="required">*</span>}
      </label>
      
      {React.cloneElement(children, {
        id: fieldId,
        'aria-invalid': !!error,
        'aria-describedby': error ? errorId : undefined,
      })}
      
      {error && (
        <div
          id={errorId}
          role="alert"
          aria-live="assertive"
          className="text-destructive"
        >
          {error}
        </div>
      )}
    </div>
  );
};
```

#### Input Assistance
- Clear labels for all form fields
- Placeholder text provides helpful hints
- Required fields are clearly marked
- Input formats are explained (e.g., "MM/DD/YYYY")

### Navigation Accessibility

#### Skip Links
```tsx
// Skip to main content
const SkipLink = () => (
  <a
    href="#main-content"
    className="skip-link"
    onFocus={(e) => e.target.scrollIntoView()}
  >
    Skip to main content
  </a>
);
```

#### Breadcrumb Navigation
```tsx
// Accessible breadcrumbs
<nav aria-label="Breadcrumb">
  <ol className="breadcrumb-list">
    <li>
      <a href="/dashboard">Dashboard</a>
      <span aria-hidden="true">/</span>
    </li>
    <li>
      <a href="/assessments">Assessments</a>
      <span aria-hidden="true">/</span>
    </li>
    <li aria-current="page">Assessment Details</li>
  </ol>
</nav>
```

### Data Table Accessibility

#### Table Headers and Scope
```tsx
// Accessible data tables
<table>
  <caption>Assessment Results Summary</caption>
  <thead>
    <tr>
      <th scope="col">Section</th>
      <th scope="col">Score</th>
      <th scope="col">Status</th>
      <th scope="col">Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Environmental Management</th>
      <td>85%</td>
      <td>
        <span className="status-badge" aria-label="Status: Compliant">
          Compliant
        </span>
      </td>
      <td>
        <button aria-label="View Environmental Management details">
          View Details
        </button>
      </td>
    </tr>
  </tbody>
</table>
```

## Testing Procedures

### Automated Testing

#### WCAG Compliance Testing
```typescript
// Automated accessibility testing with Playwright
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('should not have any automatically detectable WCAG violations', async ({ page }) => {
    await page.goto('/dashboard');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
```

#### Color Contrast Testing
```typescript
// Color contrast validation
test('should meet AAA contrast requirements', async ({ page }) => {
  await page.goto('/dashboard');
  
  const contrastResults = await new AxeBuilder({ page })
    .withTags(['color-contrast'])
    .configure({
      rules: {
        'color-contrast-enhanced': { enabled: true }
      }
    })
    .analyze();
    
  expect(contrastResults.violations).toEqual([]);
});
```

### Manual Testing

#### Keyboard Testing Checklist
- [ ] All interactive elements are reachable via keyboard
- [ ] Tab order is logical and intuitive
- [ ] Focus indicators are visible and clear
- [ ] No keyboard traps exist
- [ ] All functionality is available via keyboard

#### Screen Reader Testing
- [ ] Content is announced in logical order
- [ ] Form labels are associated correctly
- [ ] Error messages are announced
- [ ] Status changes are communicated
- [ ] Navigation landmarks are identified

#### Visual Testing
- [ ] Text is readable at 200% zoom
- [ ] No information is conveyed by color alone
- [ ] Focus indicators meet contrast requirements
- [ ] Content adapts to different viewport sizes

### Testing Tools

#### Browser Extensions
- **axe DevTools**: Automated accessibility testing
- **WAVE**: Web accessibility evaluation
- **Colour Contrast Analyser**: Color contrast checking
- **HeadingsMap**: Heading structure validation

#### Screen Readers
- **NVDA** (Windows): Free screen reader
- **JAWS** (Windows): Professional screen reader
- **VoiceOver** (macOS): Built-in screen reader
- **Orca** (Linux): Open-source screen reader

#### Testing Commands
```bash
# Run accessibility tests
npm run test:a11y

# Generate accessibility report
npm run test:a11y:report

# Test with specific screen reader simulation
npm run test:a11y:nvda
```

## Implementation Guidelines

### Component Development

#### Accessible Component Checklist
- [ ] Semantic HTML elements used appropriately
- [ ] ARIA attributes added where necessary
- [ ] Keyboard interaction implemented
- [ ] Focus management handled correctly
- [ ] Color contrast requirements met
- [ ] Screen reader compatibility verified

#### Code Examples

**Accessible Button Component**:
```tsx
interface AccessibleButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  children,
  onClick,
  loading = false,
  disabled = false,
  ariaLabel,
  ariaDescribedBy,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-busy={loading}
      className="btn focus-ring"
    >
      {loading && (
        <span className="sr-only">Loading...</span>
      )}
      {children}
    </button>
  );
};
```

**Accessible Modal Component**:
```tsx
const AccessibleModal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children 
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (isOpen) {
      // Trap focus within modal
      const focusTrap = focusManager.trapFocus(modalRef.current!);
      
      // Announce modal opening
      announceToScreenReader(`Modal opened: ${title}`, 'assertive');
      
      return () => {
        focusTrap();
        announceToScreenReader('Modal closed', 'polite');
      };
    }
  }, [isOpen, title]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      ref={modalRef}
    >
      <div className="modal-content">
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="modal-close"
          >
            ×
          </button>
        </header>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};
```

### Content Guidelines

#### Writing Accessible Content
- Use clear, simple language
- Provide context for technical terms
- Use descriptive link text
- Structure content with proper headings
- Include alternative text for images

#### Heading Structure
```html
<!-- Proper heading hierarchy -->
<h1>Assessment Dashboard</h1>
  <h2>Recent Assessments</h2>
    <h3>Environmental Management Assessment</h3>
  <h2>Quick Actions</h2>
    <h3>Create New Assessment</h3>
```

## Accessibility Monitoring

### Continuous Integration
```yaml
# GitHub Actions accessibility testing
name: Accessibility Tests
on: [push, pull_request]

jobs:
  accessibility:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Run accessibility tests
        run: npm run test:a11y
      - name: Upload results
        uses: actions/upload-artifact@v2
        with:
          name: accessibility-report
          path: accessibility-report.html
```

### Performance Monitoring
```typescript
// Monitor accessibility metrics
const trackAccessibilityMetrics = () => {
  // Track focus management performance
  const focusTime = performance.now();
  
  // Monitor screen reader announcement timing
  const announcementQueue = [];
  
  // Log accessibility interactions
  console.log('Accessibility metrics:', {
    focusTime,
    announcementQueue: announcementQueue.length
  });
};
```

## Support and Resources

### Internal Resources
- Accessibility testing checklist: `/docs/a11y-checklist.md`
- Component accessibility guide: `/docs/component-a11y.md`
- ARIA patterns reference: `/docs/aria-patterns.md`

### External Resources
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Resources](https://webaim.org/)
- [Accessibility Developer Guide](https://www.accessibility-developer-guide.com/)

### Getting Help
For accessibility questions or issues:
- Create issue in GitHub with `accessibility` label
- Contact accessibility team: a11y-team@rur2.com
- Join #accessibility Slack channel

## Future Improvements

### Planned Features
- Voice navigation support
- Enhanced keyboard shortcuts
- Improved mobile accessibility
- Multi-language screen reader support

### User Feedback
We continuously collect and incorporate user feedback:
- Accessibility feedback form: `/feedback/accessibility`
- User testing sessions with assistive technology users
- Regular accessibility audits by external experts

This comprehensive accessibility guide ensures RuR2 provides an inclusive experience for all users, regardless of their abilities or assistive technologies.
