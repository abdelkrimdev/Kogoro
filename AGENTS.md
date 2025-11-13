# Kogoro - Agent Guidelines

## Commands
- **Build**: `bun run build`
- **Dev**: `bun run dev` 
- **Test**: `bun run test` (Vitest)
- **Single test**: `bun run test -- filename.test.ts`
- **Lint**: `bun run lint` (Biome - auto-fixes)
- **Format**: `bun run format` (Biome - auto-fixes)

## Code Style
- **Framework**: SolidJS with TypeScript
- **Styling**: Tailwind CSS with custom design tokens
- **Imports**: Use `@/*` path aliases, group imports by type
- **Formatting**: 2-space indentation, 80 char line width, single quotes, semicolons as needed
- **Components**: Use `Component<T>` type, props interfaces, export const
- **Classes**: Use `cn()` utility for Tailwind class merging
- **Error handling**: Wrap components in ErrorBoundary, use Show for conditional rendering
- **TypeScript**: Strict mode enabled, avoid `any` (warned), prefer explicit types