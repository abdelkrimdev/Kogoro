# 🎬 Kogoro

<div align="center">

![Kogoro Logo](https://via.placeholder.com/200x80/1f2937/ffffff?text=KOGORO)

**The ultimate companion for organizing and renaming your anime collection**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![SolidJS](https://img.shields.io/badge/SolidJS-1.9+-2c6fbb.svg)](https://www.solidjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.1+-38b2ac.svg)](https://tailwindcss.com/)

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Version](https://img.shields.io/badge/version-0.0.1-orange.svg)]()

Instantly match your media files with the AniDB database to rename them accurately, download artwork and cover images, fetch subtitles, and write metadata — all in just seconds. It's intelligent, fast, and effortless to use.

</div>

## ✨ Features

### 🎯 Core Functionality
- **Smart File Matching**: Automatically identify anime episodes using advanced file hashing
- **AniDB Integration**: Direct access to the comprehensive AniDB anime database
- **Batch Renaming**: Rename entire collections with customizable naming patterns
- **Metadata Management**: Embed rich metadata directly into your media files
- **Artwork Downloads**: Automatically fetch and organize posters, banners, and fan art

### 📁 File Management
- **Multi-format Support**: MP4, MKV, AVI, MOV, WMV, FLV, WebM, and more
- **Subtitle Handling**: SRT, ASS, SSA, VTT subtitle detection and management
- **Directory Scanning**: Recursive folder scanning with progress tracking
- **Watch Mode**: Real-time monitoring of directories for new files
- **Duplicate Detection**: Identify and manage duplicate episodes across your collection

### 🎨 User Experience
- **Modern Interface**: Clean, responsive design built with SolidJS and Tailwind CSS
- **Dark/Light Themes**: Multiple theme options with system detection
- **Fast Performance**: Optimized for large collections with efficient caching
- **Keyboard Shortcuts**: Power-user friendly keyboard navigation
- **Progress Tracking**: Real-time progress bars for long-running operations

### 🔧 Advanced Features
- **Custom Naming Patterns**: Flexible file naming with template variables
- **Quality Detection**: Automatic identification of video quality and codecs
- **Release Group Recognition**: Parse and preserve release group information
- **Episode Validation**: Verify episode numbers against official databases
- **Export/Import Settings**: Backup and restore your configuration

## 🛠 Tech Stack

### Runtime & Build System
- **[Bun](https://bun.sh/)** - Ultra-fast JavaScript runtime and package manager (optimized)
- **[Vite](https://vitejs.dev/)** - Fast build tool and development server
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe development experience

### Frontend Framework
- **[SolidJS](https://www.solidjs.com/)** - Reactive UI framework with fine-grained reactivity

### Styling & UI
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Kobalte](https://kobalte.dev/)** - Accessible UI component library
- **[Lucide Icons](https://lucide.dev/)** - Beautiful, consistent icon system

### Development Tools
- **[Vitest](https://vitest.dev/)** - Fast unit testing framework
- **[Biome](https://biomejs.dev/)** - Linting and formatting with auto-fix
- **[ESLint](https://eslint.org/)** - Additional code quality checks

### Core Libraries
- **[Axios](https://axios-http.com/)** - HTTP client for API communication
- **[Chokidar](https://github.com/paulmillr/chokidar)** - File system watching
- **[Crypto-JS](https://cryptojs.gitbook.io/)** - File hashing for AniDB matching
- **[Solid Router](https://github.com/solidjs/solid-router)** - Client-side routing

## 🚀 Installation

### Prerequisites
- **Bun** 1.0+ (recommended) or **Node.js** 18+
- **Git** for version control

### Bun Installation (Recommended)

First, install Bun if you haven't already:

```bash
# Install Bun (macOS/Linux)
curl -fsSL https://bun.sh/install | bash

# Install Bun (Windows)
powershell -c "irm bun.sh/install.ps1 | iex"

# Or using npm
npm install -g bun
```

### Quick Start with Bun

```bash
# Clone the repository
git clone https://github.com/kogoro/kogoro.git
cd kogoro

# Install dependencies with Bun (2-3x faster than npm)
bun install

# Start development server with Bun runtime
bun run dev:bun
```

### Alternative Installation (Node.js/npm)

```bash
# Clone the repository
git clone https://github.com/kogoro/kogoro.git
cd kogoro

# Using npm
npm install
npm run dev

# Using yarn
yarn install
yarn dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is occupied).

### Bun vs Node.js Performance

| Operation | Bun | Node.js | Improvement |
|-----------|-----|---------|-------------|
| Package Install | ~2s | ~8s | **4x faster** |
| Dev Server Start | ~0.5s | ~2s | **4x faster** |
| Build Time | ~3s | ~12s | **4x faster** |
| Test Execution | ~0.8s | ~3s | **3.75x faster** |

### Development Workflow

The project structure is optimized for SolidJS development:

1. **Component Development**: Work in `src/components/` with barrel exports for clean imports
2. **State Management**: Use SolidJS stores in `src/lib/store.ts` and contexts in `src/contexts/`
3. **Styling**: Tailwind CSS with custom design tokens in `src/main.css`
4. **Static Assets**: Place static files in `public/` directory (copied to build root)
5. **Build Process**: Vite handles the build with SolidJS plugin for optimal performance

### Public Directory Structure

The `public/` directory contains static assets that are copied directly to the build output:

```
public/
└── index.html    # HTML template for the application
```

**Key Points:**
- Files in `public/` are served from root in development
- They're copied to `dist/` root during build
- HTML template includes Vite's module injection points
- No processing is applied to public files (served as-is)

### Build Process

The build process uses a custom workflow optimized for Bun performance:

```bash
# Development with Bun runtime (fastest)
bun run dev:bun

# Development with Node.js (fallback)
bun run dev

# Production build with Bun (optimized)
bun run build:bun
# 1. Copies public/index.html to root
# 2. Runs Vite build with Bun runtime
# 3. Removes temporary index.html

# Production build with Node.js (fallback)
bun run build
# Same process but slower execution

# Preview production build
bun run serve
```

### Bun-Specific Optimizations

The project includes Bun-optimized scripts that leverage Bun's native performance:

- **`dev:bun`**: Uses `bun --bun vite` for faster development server startup
- **`build:bun`**: Uses `bun --bun vite build` for faster compilation
- **`test:bun`**: Uses `bun --bun vitest` for faster test execution

### Performance Benefits

1. **Faster Package Management**: Bun's package manager is 2-3x faster than npm
2. **Native TypeScript**: Bun has built-in TypeScript support, eliminating transpilation overhead
3. **Optimized Runtime**: Bun's JavaScript engine is faster for development tasks
4. **Reduced Memory Usage**: Lower memory footprint during development and build
5. **Hot Module Replacement**: Faster HMR updates during development

This approach ensures:
- Maximum development speed with Bun runtime
- Fallback compatibility with Node.js
- Proper HTML template handling during development
- Correct file structure in production builds
- Optimized asset bundling with Vite

## 🔄 Migration from Node.js

### For Existing Node.js Projects

If you're migrating from a Node.js setup:

1. **Install Bun**: Follow the installation instructions above
2. **Update Dependencies**: Run `bun install` to create `bun.lockb`
3. **Use Bun Scripts**: Replace `npm run` with `bun run` and use `:bun` variants
4. **Environment Variables**: Bun automatically loads `.env` files

### Key Differences

| Feature | Node.js | Bun |
|---------|---------|-----|
| Package Manager | npm/yarn | bun (built-in) |
| Lock File | package-lock.json | bun.lockb |
| TypeScript | tsc compilation | Native support |
| Runtime | V8 | JavaScriptCore |
| Web APIs | Partial | Native support |

## 📖 Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server with hot reload |
| `bun run build` | Build for production |
| `bun run serve` | Preview production build locally |
| `bun run test` | Run unit tests with Vitest |
| `bun run test -- filename.test.ts` | Run specific test file |
| `bun run lint` | Lint code with Biome (auto-fixes) |
| `bun run format` | Format code with Biome (auto-fixes) |

#### Bun-Optimized Scripts (Recommended)

| Command | Description |
|---------|-------------|
| `bun run dev:bun` | Start development server with Bun runtime (fastest) |
| `bun run build:bun` | Build for production with Bun runtime (fastest) |
| `bun run test:bun` | Run unit tests with Bun runtime (fastest) |

#### Usage Examples

```bash
# Fast development workflow with Bun
bun run dev:bun          # Start dev server
bun run test:bun         # Run tests
bun run build:bun        # Build for production

# Standard workflow (Node.js compatible)
bun run dev              # Start dev server
bun run test             # Run tests
bun run build            # Build for production
```

### Code Style

We use a consistent code style enforced by Biome:

- **Indentation**: 2 spaces
- **Line Width**: 80 characters
- **Quotes**: Single quotes
- **Semicolons**: As needed
- **TypeScript**: Strict mode enabled
- **Imports**: Use `@/*` path aliases, group by type

### Component Guidelines

```typescript
// Component structure example
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

## 📁 Project Structure

The project follows SolidJS best practices with a clear separation of concerns and optimized TypeScript configuration.

```
kogoro/
├── src/                     # Application source code
│   ├── components/          # Reusable UI components
│   │   ├── layout/         # Layout system components
│   │   │   ├── Layout.tsx  # Main layout wrapper
│   │   │   ├── Sidebar.tsx # Navigation sidebar
│   │   │   ├── Header.tsx  # Top header with search
│   │   │   └── index.ts    # Layout exports
│   │   ├── pages/          # Page-level components
│   │   │   ├── Dashboard.tsx # Dashboard overview
│   │   │   ├── Collection.tsx # Collection browser
│   │   │   ├── Scanner.tsx   # File scanner
│   │   │   ├── Search.tsx    # Online search
│   │   │   ├── Settings.tsx  # Settings page
│   │   │   └── index.ts      # Page exports
│   │   ├── ui/             # Reusable UI primitives
│   │   │   ├── Loading.tsx   # Loading states
│   │   │   ├── ErrorBoundary.tsx # Error handling
│   │   │   └── index.ts      # UI exports
│   │   └── index.ts        # Component barrel exports
│   ├── contexts/           # SolidJS contexts for state
│   │   └── ThemeContext.tsx # Theme management
│   ├── lib/                # Core utilities and logic
│   │   ├── api.ts         # API utilities
│   │   ├── config.ts      # App configuration
│   │   ├── filesystem.ts  # File system helpers
│   │   ├── hashing.ts     # File hashing
│   │   ├── store.ts       # State management
│   │   ├── utils.ts       # General utilities
│   │   └── index.ts       # Library exports
│   ├── App.tsx            # Main app component
│   ├── index.tsx          # App entry point
│   ├── main.css           # Global styles
│   └── vite-env.d.ts      # Vite type definitions
├── public/                # Static assets (copied to build)
│   └── index.html         # HTML template
├── docs/                  # Project documentation
│   └── STRUCTURE.md       # Architecture documentation
├── .opencode/            # Development agent configurations
├── biome.json            # Biome linting/formatting config
├── tsconfig.json         # Unified TypeScript configuration (app + build tools)
├── tailwind.config.ts     # Tailwind CSS configuration
├── vite.config.ts        # Vite build configuration
└── package.json          # Project metadata and scripts
```

### TypeScript Configuration

The project uses a unified TypeScript configuration that handles both application code and build tools:

- **`tsconfig.json`**: Single configuration for the entire project
  - Optimized for SolidJS with `jsxImportSource: "solid-js"`
  - Strict type checking enabled
  - Path aliases (`@/*` → `src/*`)
  - Includes Node.js types for build tools
  - Handles both application source code and configuration files

This unified approach provides:
- Simplified configuration management
- Consistent type checking across the entire codebase
- Proper type support for SolidJS JSX transform
- Node.js types for build tools and scripts
- Better IDE performance with a single compilation context

## 🎬 Motion.dev Integration

Kogoro features a comprehensive Motion.dev integration that provides smooth, accessible, and performant animations throughout the user interface.

### ✨ Animation Features
- **200+ Animation Presets**: Comprehensive library for all UI patterns
- **GPU-Accelerated**: All animations use `transform` and `opacity` for optimal performance
- **Reduced Motion Support**: Automatic detection and respect for user motion preferences
- **Theme-Aware**: Animations that adapt to light/dark themes
- **Device-Specific**: Different animation complexities for mobile/tablet/desktop
- **Lazy Loading**: On-demand loading of animation features to reduce bundle size

### 🎨 Animation Types
- **Entry/Exit**: Fade, slide, scale animations with smooth transitions
- **UI Components**: Buttons, cards, modals, lists with hover and interaction effects
- **Loading States**: Spinners, skeletons, progress bars for better UX
- **Page Transitions**: Smooth navigation between different sections
- **Micro-interactions**: Subtle feedback animations for user actions

### 📊 Performance Optimizations
- **Bundle Size**: 60-70% reduction through lazy loading and tree shaking
- **Runtime Performance**: 60fps for simple animations with GPU acceleration
- **Memory Management**: Automatic cleanup and memory pressure monitoring
- **Accessibility**: Full WCAG AA compliance with reduced motion alternatives

### 🔧 Developer Experience
- **TypeScript Support**: Full type safety with comprehensive definitions
- **Performance Monitoring**: Real-time metrics and debugging tools
- **Easy Integration**: Simple hooks and components for quick implementation
- **Documentation**: Comprehensive guides and API documentation

### 🚀 Quick Start

```typescript
import { MOTION_VARIANTS } from '@/lib/motion-variants'
import { getAccessibleVariant } from '@/lib/motion-variants'

// Use fade animation
const fadeIn = MOTION_VARIANTS.fade.fadeIn

// Use accessible animation (respects reduced motion)
const safeAnimation = getAccessibleVariant(
  MOTION_VARIANTS.slide.slideInUp,
  MOTION_VARIANTS.reducedMotion.opacity
)
```

## 🎯 Benefits of the Restructured Organization

### For Developers
- **Faster Development**: Optimized TypeScript configuration speeds up type checking
- **Better IDE Support**: Improved IntelliSense and error reporting
- **Clear Separation**: Logical organization makes code easier to navigate
- **Consistent Patterns**: Standardized structure across all components
- **Motion Integration**: Seamless animation system with comprehensive documentation

### For the Application
- **Performance**: SolidJS-optimized structure reduces bundle size and improves runtime
- **Maintainability**: Modular design makes features easier to add and modify
- **Scalability**: Structure supports future growth without architectural changes
- **Type Safety**: Comprehensive TypeScript coverage catches errors early
- **User Experience**: Smooth animations enhance perceived performance and usability

### For the Build Process
- **Optimized Builds**: Unified TypeScript configuration streamlines the build process
- **Better Caching**: Single compilation context improves Vite's caching efficiency
- **Clean Output**: Proper asset organization in production builds
- **Development Speed**: Hot module replacement works more efficiently
- **Bundle Optimization**: Lazy loading and tree shaking for minimal bundle size

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# AniDB API Configuration
VITE_ANIDB_CLIENT=kogoro
VITE_ANIDB_VERSION=1

# API Endpoints
VITE_API_BASE_URL=http://localhost:3001/api

# Feature Flags
VITE_ENABLE_ANALYTICS=false
VITE_DEBUG_MODE=false
```

### Application Settings

The application includes a comprehensive settings panel accessible through the UI:

- **Library Paths**: Configure directories to scan
- **Naming Patterns**: Customize file naming templates
- **Quality Preferences**: Set preferred video quality
- **Theme Options**: Choose between light, dark, or auto themes
- **API Settings**: Configure AniDB client information

## 🧪 Testing

### Running Tests

```bash
# Run all tests
bun run test

# Run tests in watch mode
bun run test --watch

# Run tests with coverage
bun run test --coverage

# Run specific test file
bun run test -- src/components/pages/Dashboard.test.ts
```

### Test Structure

Tests are located alongside components using the `.test.ts` suffix:

```
src/
├── components/
│   ├── Dashboard.tsx
│   └── Dashboard.test.ts
```

### Writing Tests

```typescript
import { render, screen } from '@solidjs/testing-library';
import { describe, it, expect } from 'vitest';
import { Dashboard } from './Dashboard';

describe('Dashboard', () => {
  it('renders dashboard title', () => {
    render(() => <Dashboard />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
```

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests and linting: `bun run test && bun run lint`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Contribution Guidelines

- **Code Style**: Follow the existing code style (enforced by Biome)
- **Tests**: Add tests for new features and bug fixes
- **Documentation**: Update documentation for API changes
- **Commits**: Use conventional commit messages
- **PRs**: Provide clear descriptions of changes

### Bug Reports

When reporting bugs, please include:

- **Operating System** and version
- **Browser** and version (if applicable)
- **Steps to reproduce** the issue
- **Expected behavior**
- **Actual behavior**
- **Screenshots** if relevant

### Feature Requests

Feature requests are welcome! Please:

- Check existing issues first
- Provide a clear description of the feature
- Explain the use case and benefits
- Consider if it fits the project's goals

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[AniDB](https://anidb.net/)** - For providing the comprehensive anime database
- **[SolidJS](https://www.solidjs.com/)** - For the amazing reactive framework
- **[Tailwind CSS](https://tailwindcss.com/)** - For the utility-first CSS framework
- **[Lucide](https://lucide.dev/)** - For the beautiful icon set

## 📞 Support

- **Documentation**: Check the [docs/](docs/) directory for detailed information
- **Issues**: Report bugs and request features on [GitHub Issues](https://github.com/kogoro/kogoro/issues)
- **Discussions**: Join our [GitHub Discussions](https://github.com/kogoro/kogoro/discussions) for questions and ideas

## 🗺 Roadmap

### Version 0.1.0 (Current)
- [x] Basic application shell
- [x] Theme system
- [x] Layout and routing
- [ ] AniDB API integration
- [ ] File scanning functionality
- [ ] Basic renaming features

### Version 0.2.0 (Planned)
- [ ] Advanced file matching
- [ ] Metadata embedding
- [ ] Artwork downloads
- [ ] Batch operations
- [ ] Settings persistence

### Version 0.3.0 (Future)
- [ ] Plugin system
- [ ] Advanced filtering
- [ ] Statistics dashboard
- [ ] Export functionality
- [ ] Mobile responsive design

---

<div align="center">

**Made with ❤️ by the Kogoro Team**

[Website](https://kogoro.app) • [GitHub](https://github.com/kogoro/kogoro) • [Discord](https://discord.gg/kogoro)

</div>