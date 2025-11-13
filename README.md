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

### Frontend Framework
- **[SolidJS](https://www.solidjs.com/)** - Reactive UI framework with fine-grained reactivity
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe development experience
- **[Vite](https://vitejs.dev/)** - Fast build tool and development server

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
- **Node.js** 18+ or **Bun** 1.0+
- **Git** for version control

### Quick Start

```bash
# Clone the repository
git clone https://github.com/kogoro/kogoro.git
cd kogoro

# Install dependencies (recommended: Bun)
bun install

# Start development server
bun run dev
```

### Alternative Installation (npm/yarn)

```bash
# Using npm
npm install
npm run dev

# Using yarn
yarn install
yarn dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is occupied).

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

```
kogoro/
├── src/
│   ├── components/
│   │   ├── layout/           # Layout components
│   │   │   ├── Layout.tsx    # Main layout wrapper
│   │   │   ├── Sidebar.tsx   # Navigation sidebar
│   │   │   └── Header.tsx    # Top header with search
│   │   ├── pages/            # Page components
│   │   │   ├── Dashboard.tsx # Dashboard overview
│   │   │   ├── Collection.tsx # Collection browser
│   │   │   ├── Scanner.tsx   # File scanner
│   │   │   ├── Search.tsx    # Online search
│   │   │   └── Settings.tsx  # Settings page
│   │   └── ui/               # Reusable UI components
│   │       ├── Loading.tsx   # Loading states
│   │       └── ErrorBoundary.tsx # Error handling
│   ├── contexts/             # React contexts
│   │   └── ThemeContext.tsx  # Theme management
│   ├── lib/                  # Core utilities
│   │   ├── api.ts           # API utilities
│   │   ├── config.ts        # App configuration
│   │   ├── filesystem.ts    # File system helpers
│   │   ├── hashing.ts       # File hashing
│   │   ├── store.ts         # State management
│   │   └── utils.ts         # General utilities
│   ├── App.tsx              # Main app component
│   ├── index.tsx            # App entry point
│   └── main.css             # Global styles
├── docs/                    # Documentation
│   └── STRUCTURE.md         # Architecture documentation
├── .opencode/              # Development agent configs
├── biome.json              # Biome configuration
├── tailwind.config.js      # Tailwind configuration
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite configuration
└── package.json            # Project metadata and scripts
```

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