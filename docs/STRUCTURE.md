# Kogoro Application Structure

## Overview
Kogoro is a comprehensive anime collection management application built with SolidJS, TypeScript, and TailwindCSS. The project structure is optimized for SolidJS development patterns, modern web development best practices, and includes an AI-powered development agent system for enhanced productivity.

## Architecture Philosophy

### SolidJS-First Design
The project structure follows SolidJS best practices:
- **Fine-grained reactivity**: Components are structured to maximize SolidJS's reactive primitives
- **Minimal re-renders**: Component organization minimizes unnecessary updates
- **TypeScript integration**: Full type safety with SolidJS-specific optimizations
- **Build optimization**: Structure optimized for Vite + SolidJS plugin performance

### Separation of Concerns
- **Components**: Pure UI components with clear responsibilities
- **Libraries**: Business logic, utilities, and state management
- **Contexts**: Cross-cutting concerns like theming
- **Configuration**: Build and development tooling isolation

## Core Architecture

### Layout System
- **Layout**: Main layout wrapper with sidebar and header integration
- **Sidebar**: Collapsible navigation with theme-aware styling and active route highlighting
- **Header**: Search bar, theme toggle, notifications, and user menu

### Page Components
- **Dashboard**: Overview with stats, continue watching, and recent activity
- **Collection**: Browse and filter anime collection with grid/list views
- **Scanner**: Directory scanning with real-time progress tracking
- **Search**: Online anime search with AniDB integration
- **Settings**: Comprehensive application configuration interface

### UI Primitives
- **Loading**: Flexible loading states with overlay and inline variants
- **ErrorBoundary**: Error handling with retry functionality and error reporting

### State Management
- **Store**: Centralized state using SolidJS stores with reactive patterns
- **Theme Context**: Theme management (light/dark/auto) with system preference detection
- **Configuration**: Centralized app configuration with type safety

### Bun-Specific Optimizations
- **bun-utils.ts**: Performance-optimized utilities leveraging Bun's native capabilities
  - Optimized file reading and writing operations
  - Fast file hashing using Bun's built-in crypto
  - HTTP client with native fetch and timeout handling
  - Performance monitoring and timing utilities
  - File system operations with fallback to Node.js APIs

## Detailed File Structure

```
kogoro/
├── src/                           # Application source code
│   ├── components/                # Component hierarchy
│   │   ├── layout/               # Layout system components
│   │   │   ├── Layout.tsx        # Main layout wrapper
│   │   │   ├── Sidebar.tsx       # Navigation sidebar
│   │   │   ├── Header.tsx        # Top header with search
│   │   │   └── index.ts          # Barrel exports for layout
│   │   ├── pages/                # Page-level components
│   │   │   ├── Dashboard.tsx     # Dashboard overview
│   │   │   ├── Collection.tsx    # Collection browser
│   │   │   ├── Scanner.tsx       # File scanner interface
│   │   │   ├── Search.tsx        # Online search interface
│   │   │   ├── Settings.tsx     # Settings configuration
│   │   │   └── index.ts          # Barrel exports for pages
│   │   ├── ui/                   # Reusable UI primitives
│   │   │   ├── Loading.tsx       # Loading state components
│   │   │   ├── ErrorBoundary.tsx # Error handling wrapper
│   │   │   └── index.ts          # Barrel exports for UI
│   │   └── index.ts              # Root component barrel exports
│   ├── contexts/                 # SolidJS contexts
│   │   └── ThemeContext.tsx      # Theme management context
│   ├── lib/                      # Core utilities and business logic
│   │   ├── api.ts                # API client and utilities
│   │   ├── bun-utils.ts          # Bun-specific optimizations and utilities
│   │   ├── config.ts             # Application configuration
│   │   ├── filesystem.ts         # File system operations
│   │   ├── hashing.ts            # File hashing for AniDB
│   │   ├── store.ts              # State management store
│   │   ├── utils.ts              # General utility functions
│   │   └── index.ts              # Library barrel exports
│   ├── App.tsx                   # Main application component
│   ├── index.tsx                 # Application entry point
│   ├── main.css                  # Global styles and CSS custom properties
│   └── vite-env.d.ts             # Vite environment type definitions
├── docs/                         # Project documentation
│   └── STRUCTURE.md              # This architecture documentation
├── .opencode/                    # AI-powered development agent system
│   ├── agent/                    # AI agent configurations
│   │   ├── orchestrator.md       # Main orchestrator agent configuration
│   │   └── subagents/            # Specialized subagent configurations
│   │       ├── developer.md      # Code development agent
│   │       ├── documenter.md     # Documentation agent
│   │       ├── planner.md        # Project planning agent
│   │       ├── reviewer.md       # Code review agent
│   │       └── tester.md         # Testing agent
│   └── command/                  # Command configurations
│       └── commit-changes.md     # Git commit automation
├── biome.json                    # Biome linting and formatting configuration
├── tsconfig.json                 # Unified TypeScript configuration (app + build tools)
├── tailwind.config.ts            # Tailwind CSS configuration
├── vite.config.ts                # Vite build tool configuration
├── index.html                    # HTML template for the application
├── AGENTS.md                     # AI agent guidelines and commands
├── CHANGELOG.md                  # Project changelog
└── package.json                  # Project metadata and scripts
```

## TypeScript Configuration Strategy

### Unified Configuration Approach

The project uses a single TypeScript configuration that handles both application code and build tools:

#### `tsconfig.json` - Complete Project Configuration
- **Purpose**: Unified configuration for the entire codebase
- **SolidJS Optimizations**:
  - `jsxImportSource: "solid-js"` for proper JSX transform
  - `jsx: "preserve"` for SolidJS compilation
  - SolidJS-specific type checking rules
- **Strict Type Checking**:
  - `strict: true` with enhanced rules
  - `noUncheckedIndexedAccess` for array/object safety
  - `exactOptionalPropertyTypes` for precise typing
- **Path Aliases**: `@/*` mapped to `src/*` for clean imports
- **Node.js Support**: Includes Node.js type definitions for build tools
- **Build Tool Coverage**: Handles Vite config, Biome config, Tailwind config, etc.

### Benefits of Unified Configuration

1. **Simplicity**: Single configuration file to manage and maintain
2. **Performance**: Optimized type checking with single compilation context
3. **Accuracy**: Proper SolidJS JSX support and type inference
4. **IDE Support**: Better IntelliSense and error reporting
5. **Consistency**: Unified type checking across all project files
6. **Maintainability**: Easier to understand and modify

## Build Process Architecture

### Package Scripts Configuration

Current package.json scripts:
```json
{
  "scripts": {
    "start": "vite",
    "dev": "vite",
    "build": "vite build",
    "serve": "vite preview",
    "test": "vitest --run",
    "format": "biome format --write",
    "lint": "biome lint --write"
  }
}
```

### Development Workflow
```bash
bun run dev        # Starts Vite dev server
bun run build      # Build for production
bun run serve      # Preview production build
bun run test       # Run test suite (Vitest)
bun run lint       # Lint and auto-fix code (Biome)
bun run format     # Format code (Biome)
```

### Build Optimization
- **SolidJS Plugin**: Optimizes components for minimal runtime
- **Tree Shaking**: Removes unused code automatically
- **CSS Optimization**: Tailwind CSS purging and minification
- **Asset Bundling**: Optimized static asset handling
- **TypeScript Compilation**: Fast compilation with Vite

## Key Technologies and Integration

### Core Framework Stack
- **SolidJS**: Reactive UI framework with fine-grained reactivity
- **TypeScript**: Type safety with SolidJS-specific optimizations
- **Vite**: Fast build tool with SolidJS plugin integration
- **TailwindCSS**: Utility-first CSS with custom design tokens

### Development Toolchain
- **Biome**: Linting and formatting with auto-fix capabilities
- **Vitest**: Fast unit testing framework
- **Lucide Icons**: Modern, consistent icon system
- **Kobalte**: Accessible UI component library

### State and Data Management
- **SolidJS Stores**: Reactive state management
- **SolidJS Router**: Client-side routing with navigation state
- **Chokidar**: File system watching for scanner functionality
- **Crypto-JS**: Cryptographic utilities for file hashing

### Performance and Utilities
- **Bun Utils**: Optimized file operations, HTTP client, and performance monitoring
- **CLSX**: Utility for constructing className strings
- **Tailwind Merge**: Utility for merging Tailwind CSS classes

### Current Dependencies (v0.0.1)
**Core Framework:**
- `solid-js`: v1.9.10 - Reactive UI framework
- `@solidjs/router`: v0.15.4 - Client-side routing
- `@kobalte/core`: v0.13.11 - Accessible UI components

**Styling and Utilities:**
- `tailwindcss`: v4.1.17 - Utility-first CSS framework
- `clsx`: v2.1.1 - ClassName utility
- `tailwind-merge`: v3.4.0 - Tailwind class merging
- `lucide-solid`: v0.553.0 - Icon system

**Functionality:**
- `chokidar`: v4.0.3 - File system watching
- `crypto-js`: v4.2.0 - Cryptographic utilities

**Development Tools:**
- `vite`: v7.2.2 - Build tool
- `vitest`: v4.0.8 - Testing framework
- `typescript`: v5.9.3 - Type checking
- `@biomejs/biome`: v2.3.5 - Linting and formatting

## Development Guidelines

### Component Development
```typescript
// Standard component pattern
import { Component } from 'solid-js';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  variant?: 'primary' | 'secondary';
}

export const MyComponent: Component<Props> = (props) => {
  return (
    <div class={cn('base-class', props.variant && `variant-${props.variant}`)}>
      <h1>{props.title}</h1>
    </div>
  );
};
```

### Import Organization
```typescript
// 1. External libraries
import { Component } from 'solid-js';
import { Router } from '@solidjs/router';

// 2. Internal imports (using path aliases)
import { Layout } from '@/components/layout';
import { cn } from '@/lib/utils';
import { ThemeContext } from '@/contexts/ThemeContext';
```

### File Naming Conventions
- **Components**: PascalCase (e.g., `Dashboard.tsx`)
- **Utilities**: camelCase (e.g., `filesystem.ts`)
- **Types**: Interfaces in component files, separate types for complex structures
- **Tests**: `.test.ts` suffix alongside source files

## Performance Optimizations

### Bun-Specific Optimizations
- **Native File Operations**: Optimized file reading, writing, and hashing
- **Fast HTTP Client**: Native fetch with timeout handling
- **Performance Monitoring**: Built-in timing and measurement utilities
- **Memory Efficiency**: Lower memory footprint for file operations
- **Fallback Support**: Graceful degradation to Node.js APIs when needed

### SolidJS-Specific Optimizations
- **Fine-grained reactivity**: Components update only when needed
- **Compile-time optimizations**: SolidJS plugin optimizes at build time
- **Minimal runtime**: Small bundle size and fast execution
- **Memoization**: Strategic use of `createMemo` for expensive computations

### Build Optimizations
- **Code splitting**: Automatic route-based code splitting
- **Tree shaking**: Unused code elimination
- **Asset optimization**: Image and font optimization
- **CSS purging**: Remove unused Tailwind classes
- **Fast compilation**: Optimized build process with Vite

## AI-Powered Development System

### OpenCode Agent Architecture

The project includes an AI-powered development agent system located in `.opencode/`:

#### Agent Configuration Structure
- **Orchestrator Agent** (`agent/orchestrator.md`): Main coordination agent
- **Specialized Subagents** (`agent/subagents/`):
  - **Developer**: Code implementation and feature development
  - **Documenter**: Documentation creation and maintenance
  - **Planner**: Project planning and architecture decisions
  - **Reviewer**: Code review and quality assurance
  - **Tester**: Test creation and execution

#### Command Automation
- **Commit Changes** (`command/commit-changes.md`): Automated git workflow with intelligent commit messages

### Development Guidelines

The `AGENTS.md` file provides comprehensive guidelines for:
- **Available Commands**: Build, dev, test, lint, format workflows
- **Code Style**: SolidJS patterns, TypeScript conventions, Tailwind CSS usage
- **Component Standards**: Props interfaces, error handling, import organization
- **Best Practices**: Performance optimization, accessibility, maintainability

### Agent-Driven Development Benefits
1. **Consistency**: Automated adherence to coding standards
2. **Productivity**: Reduced manual setup and configuration
3. **Quality**: Automated testing and review processes
4. **Documentation**: Always up-to-date project documentation
5. **Workflow**: Streamlined development cycles with intelligent automation

## Documentation Structure

### Core Documentation
- **STRUCTURE.md**: Comprehensive architecture and file structure documentation
- **AGENTS.md**: AI agent guidelines, commands, and development workflow
- **CHANGELOG.md**: Version history and feature updates

### Agent-Generated Documentation
The AI agent system maintains documentation automatically:
- **API Documentation**: Function/method docs, parameters, return values
- **README Updates**: Feature descriptions, usage examples, setup instructions
- **Architecture Docs**: Component interactions, decision records
- **User Guides**: Tutorials, FAQs, troubleshooting

## Next Development Steps

The application shell is complete and ready for:

1. **API Integration**: AniDB client implementation
2. **File System**: Scanner and file management features with Bun optimizations
3. **Database**: Local storage and caching strategy
4. **Advanced Features**: Metadata handling, artwork downloads
5. **Testing**: Comprehensive test suite implementation
6. **Production**: Deployment optimization and CI/CD

## Design Principles

1. **SolidJS-First**: Leverage SolidJS's unique reactivity model
2. **Type Safety**: Comprehensive TypeScript usage with strict mode
3. **Performance**: Optimized for large anime collections with Bun utilities
4. **Accessibility**: WCAG compliance with semantic HTML
5. **Maintainability**: Clean, documented, modular code with AI assistance
6. **Developer Experience**: Fast builds, great tooling, clear structure, automated workflows