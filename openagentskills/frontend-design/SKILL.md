---
name: frontend-design
description: Create beautiful, responsive frontend interfaces with modern CSS and Tailwind. Use this skill when building UI components, styling pages, or implementing responsive layouts.
version: 1.0.0
license: MIT
compatibility: Node.js 18+, Tailwind CSS 3.x or 4.x
---

# Frontend Design

Use this skill when the user asks you to create UI components, style pages, or build responsive layouts.

## Instructions

### Design Principles

1. **Mobile-first**: Start with mobile layouts, then add complexity
2. **Accessibility**: Ensure proper contrast, focus states, and semantic HTML
3. **Performance**: Minimize CSS, use modern properties
4. **Consistency**: Use design tokens and utility classes

### Tailwind Best Practices

1. Use utility classes for most styling
2. Extract components for repeated patterns
3. Use arbitrary values sparingly: `w-[123px]`
4. Leverage the config for custom values

### Responsive Design

```html
<!-- Mobile first approach -->
<div class="
  w-full            <!-- Mobile -->
  md:w-1/2          <!-- Tablet -->
  lg:w-1/3          <!-- Desktop -->
  xl:w-1/4          <!-- Large desktop -->
">
```

### Color and Typography

- Use semantic color names: `bg-primary`, `text-muted`
- Maintain readable line lengths: `max-w-prose`
- Use appropriate font sizes for hierarchy

### Component Patterns

#### Card Component
```html
<div class="rounded-lg border bg-card p-6 shadow-sm">
  <h3 class="text-lg font-semibold">Title</h3>
  <p class="text-muted-foreground">Description</p>
</div>
```

#### Button Variants
```html
<button class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
  Primary
</button>
<button class="px-4 py-2 border border-input bg-background hover:bg-accent">
  Secondary
</button>
```

### Accessibility Checklist

- [ ] Color contrast ratio >= 4.5:1 for text
- [ ] Interactive elements have focus styles
- [ ] Images have alt text
- [ ] Form inputs have labels
- [ ] Navigation is keyboard accessible
