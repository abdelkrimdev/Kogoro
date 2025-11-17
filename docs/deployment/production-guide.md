# Production Deployment Guide

## Overview

This guide covers deploying the Kogoro application with Motion.dev integration to production, ensuring optimal performance, monitoring, and reliability.

## 🚀 Pre-Deployment Checklist

### Code Quality

- [ ] All tests passing: `bun run test`
- [ ] Linting passed: `bun run lint`
- [ ] Type checking passed: `bun run type-check`
- [ ] Build successful: `bun run build`
- [ ] Bundle size within limits: <200KB gzipped
- [ ] Performance benchmarks passing: >85% score

### Motion Integration

- [ ] Lazy loading configured for all motion features
- [ ] Performance monitoring enabled
- [ ] Reduced motion support tested
- [ ] Accessibility compliance verified
- [ ] Error boundaries implemented
- [ ] Bundle optimization applied

### Security

- [ ] Environment variables configured
- [ ] API endpoints secured
- [ ] CSP headers configured
- [ ] Dependencies audited: `bun audit`
- [ ] HTTPS enforced
- [ ] Error reporting configured

## 📦 Build Configuration

### Production Build

```bash
# Build for production
bun run build

# Analyze bundle size
bun run analyze

# Test production build locally
bun run serve
```

### Build Output

```
dist/
├── index.html                    # Main HTML file
├── assets/
│   ├── index-Be1ClX4z.css       # Main CSS (37.88 KB gzipped)
│   ├── index-Bz3Oc_KZ.js        # Main JS (197.57 KB gzipped)
│   └── performance-monitor-DxA67ftd.js # Performance monitor (6.59 KB gzipped)
└── manifest.json                 # Asset manifest
```

### Bundle Optimization

The production build includes several optimizations:

#### Tree Shaking
```typescript
// Only used features are included
import { MOTION_VARIANTS } from '@/lib/motion-variants'
// Unused variants are removed from bundle
```

#### Code Splitting
```typescript
// Motion features are split into separate chunks
import { useLazyMotion } from '@/lib/lazy-motion'
const { getFeature } = useLazyMotion({
  features: ['animations', 'variants'],
  preloadStrategy: 'idle'
})
```

#### Minification
- JavaScript minified with Terser
- CSS minified with cssnano
- HTML minified with html-minifier

## 🌐 Hosting Configuration

### Static Hosting (Vercel, Netlify, Cloudflare Pages)

#### Vercel Configuration

```json
// vercel.json
{
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "installCommand": "bun install",
  "framework": "vite",
  "functions": {},
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(.*\\.(js|css|png|jpg|jpeg|gif|ico|svg))",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

#### Netlify Configuration

```toml
# netlify.toml
[build]
  command = "bun run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.{js,css,png,jpg,jpeg,gif,ico,svg}"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### Cloud Hosting (AWS, Google Cloud, Azure)

#### AWS S3 + CloudFront

```bash
# Deploy to S3
aws s3 sync dist/ s3://your-bucket --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

#### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self';" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Main application
    location / {
        try_files $uri $uri/ /index.html;
        expires 1h;
    }
}
```

## 📊 Performance Monitoring

### Application Performance Monitoring (APM)

#### Sentry Configuration

```typescript
// src/lib/monitoring.ts
import * as Sentry from '@sentry/browser'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
})

// Performance monitoring
import { usePerformanceMonitor } from '@/lib/performance-monitor'

const { metrics } = usePerformanceMonitor()

// Send metrics to Sentry
if (metrics && metrics.frameRate < 55) {
  Sentry.captureMessage('Low frame rate detected', {
    level: 'warning',
    extra: metrics,
  })
}
```

#### Custom Analytics

```typescript
// src/lib/analytics.ts
export interface AnalyticsEvent {
  name: string
  properties?: Record<string, any>
  metrics?: Record<string, number>
}

export function trackEvent(event: AnalyticsEvent) {
  // Send to your analytics service
  if (typeof gtag !== 'undefined') {
    gtag('event', event.name, event.properties)
  }
}

// Track animation performance
export function trackAnimationPerformance(name: string, duration: number) {
  trackEvent({
    name: 'animation_performance',
    properties: { animation: name },
    metrics: { duration },
  })
}
```

### Real User Monitoring (RUM)

#### Web Vitals

```typescript
// src/lib/web-vitals.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

function sendToAnalytics(metric: any) {
  // Send to your analytics service
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metric),
  })
}

getCLS(sendToAnalytics)
getFID(sendToAnalytics)
getFCP(sendToAnalytics)
getLCP(sendToAnalytics)
getTTFB(sendToAnalytics)
```

## 🔧 Environment Configuration

### Environment Variables

```bash
# .env.production
# Application
NODE_ENV=production
VITE_APP_URL=https://your-domain.com
VITE_API_URL=https://api.your-domain.com

# Analytics
VITE_GA_TRACKING_ID=GA_MEASUREMENT_ID
VITE_SENTRY_DSN=SENTRY_DSN

# Feature flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_PERFORMANCE_MONITORING=true
VITE_ENABLE_ERROR_REPORTING=true

# Motion configuration
VITE_MOTION_SAMPLE_RATE=0.1
VITE_MOTION_ENABLE_MONITORING=true
VITE_MOTION_PERFORMANCE_THRESHOLDS='{"frameRate":55,"memoryUsage":52428800}'
```

### Configuration Validation

```typescript
// src/lib/config-validation.ts
export function validateConfig() {
  const required = [
    'VITE_APP_URL',
    'VITE_API_URL',
  ]

  const missing = required.filter(key => !import.meta.env[key])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  // Validate URLs
  try {
    new URL(import.meta.env.VITE_APP_URL)
    new URL(import.meta.env.VITE_API_URL)
  } catch (error) {
    throw new Error('Invalid URL format in environment variables')
  }
}
```

## 🚨 Error Handling

### Error Boundaries

```typescript
// src/components/ErrorBoundary.tsx
import { Component, ErrorInfo } from 'solid-js'
import { captureException } from '@sentry/browser'

interface Props {
  children: JSX.Element
  fallback?: JSX.Element
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Send to error reporting
    captureException(error, {
      contexts: {
        solid: {
          componentStack: errorInfo.componentStack,
        },
      },
    })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div class="error-fallback">
          <h2>Something went wrong</h2>
          <p>Please refresh the page and try again.</p>
          <button onClick={() => window.location.reload()}>
            Refresh
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

### Motion Error Handling

```typescript
// src/lib/motion-error-handling.ts
export function handleMotionError(error: Error, context: string) {
  console.error(`Motion error in ${context}:`, error)
  
  // Send to error reporting
  if (typeof window !== 'undefined' && window.Sentry) {
    window.Sentry.captureException(error, {
      tags: { context: 'motion' },
      extra: { motionContext: context },
    })
  }

  // Fallback to no animation
  return {
    initial: {},
    animate: {},
    exit: {},
    transition: { duration: 0 },
  }
}
```

## 🔒 Security

### Content Security Policy (CSP)

```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://www.googletagmanager.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https:;
  connect-src 'self' https://api.your-domain.com;
  media-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
">
```

### Security Headers

```typescript
// src/lib/security-headers.ts
export const securityHeaders = {
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}
```

## 📱 Progressive Web App (PWA)

### Service Worker

```typescript
// public/sw.js
const CACHE_NAME = 'kogoro-v1'
const urlsToCache = [
  '/',
  '/assets/index-Be1ClX4z.css',
  '/assets/index-Bz3Oc_KZ.js',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  )
})

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request)
      })
  )
})
```

### PWA Manifest

```json
// public/manifest.json
{
  "name": "Kogoro - Anime Collection Manager",
  "short_name": "Kogoro",
  "description": "Organize and manage your anime collection",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1f2937",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

## 🔄 CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run test
      - run: bun run lint
      - run: bun run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

### Deployment Script

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "🚀 Starting deployment..."

# Run tests
echo "🧪 Running tests..."
bun run test

# Run linting
echo "🔍 Running linting..."
bun run lint

# Build application
echo "📦 Building application..."
bun run build

# Analyze bundle size
echo "📊 Analyzing bundle size..."
bun run analyze

# Deploy to production
echo "🌐 Deploying to production..."
# Add your deployment command here

echo "✅ Deployment complete!"
```

## 📈 Performance Optimization

### Critical Resource Loading

```html
<!-- index.html -->
<link rel="preload" href="/assets/index-Be1ClX4z.css" as="style">
<link rel="preload" href="/assets/index-Bz3Oc_KZ.js" as="script">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

### Resource Hints

```html
<!-- Preload critical resources -->
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>

<!-- DNS prefetch for external resources -->
<link rel="dns-prefetch" href="//api.your-domain.com">
<link rel="dns-prefetch" href="//www.googletagmanager.com">
```

### Bundle Splitting

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['solid-js', '@solidjs/router'],
          motion: ['motion'],
          ui: ['@kobalte/core'],
        },
      },
    },
  },
})
```

## 🔍 Monitoring and Debugging

### Performance Monitoring Dashboard

```typescript
// src/components/PerformanceDashboard.tsx
import { createSignal, onMount } from 'solid-js'
import { usePerformanceMonitor } from '@/lib/performance-monitor'

export function PerformanceDashboard() {
  const [isVisible, setIsVisible] = createSignal(false)
  const { metrics } = usePerformanceMonitor()

  // Only show in development or with debug flag
  onMount(() => {
    setIsVisible(
      import.meta.env.DEV || 
      new URLSearchParams(window.location.search).has('debug')
    )
  })

  return (
    <Show when={isVisible()}>
      <div class="performance-dashboard">
        <h3>Performance Metrics</h3>
        <div>Frame Rate: {metrics()?.frameRate?.toFixed(1)}fps</div>
        <div>Memory: {(metrics()?.memoryUsage / 1024 / 1024).toFixed(1)}MB</div>
        <div>Animations: {metrics()?.animationCount}</div>
      </div>
    </Show>
  )
}
```

### Debug Tools

```typescript
// src/lib/debug-tools.ts
export function enableDebugMode() {
  if (import.meta.env.DEV) {
    // Enable performance monitoring
    localStorage.setItem('debug-motion', 'true')
    
    // Show performance overlay
    import('./performance-overlay').then(module => {
      module.showPerformanceOverlay()
    })
  }
}

// Enable with ?debug=true in URL
if (new URLSearchParams(window.location.search).has('debug')) {
  enableDebugMode()
}
```

## 📋 Post-Deployment Checklist

### Verification

- [ ] Application loads correctly
- [ ] All pages render without errors
- [ ] Animations work smoothly
- [ ] Reduced motion is respected
- [ ] Performance metrics are within targets
- [ ] Error reporting is working
- [ ] Analytics are tracking correctly
- [ ] Security headers are present
- [ ] SSL certificate is valid
- [ ] Mobile responsiveness works

### Monitoring Setup

- [ ] APM tools configured
- [ ] Error tracking enabled
- [ ] Performance monitoring active
- [ ] Analytics dashboard set up
- [ ] Alert thresholds configured
- [ ] Log aggregation working

### Documentation

- [ ] Deployment guide updated
- [ ] API documentation current
- [ ] Troubleshooting guide complete
- [ ] Runbook created
- [ ] Team training completed

---

*Production deployment guide last updated: November 17, 2025*