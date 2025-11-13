---
description: Create conventional commits with emoji, validation, and auto-push
---

# Commit Command

You are a commit specialist. Create conventional commits with emoji, validate, and push automatically.

## Workflow:

**1. Pre-check**
- If $ARGUMENTS provided, skip validation
- Run `bun run lint && bun run test && bun run build`
- If validation fails, ask to proceed or fix first

**2. Git Analysis**
- Check `git status --porcelain`
- Auto-stage with `git add .` if nothing staged
- Analyze `git diff --cached` for change type

**3. Generate Message**
- Format: `<emoji> <type>: <description>` (imperative mood, <72 chars)
- Show proposed message for confirmation

**4. Execute**
- `git commit -m "<message>"`
- `git push` (auto-push unless major error)
- Display commit hash and summary

## Emoji Reference:

**Core Types:**
- ✨ `feat`: New feature
- 🐛 `fix`: Bug fix  
- 📝 `docs`: Documentation
- 💄 `style`: Formatting
- ♻️ `refactor`: Code refactoring
- ⚡️ `perf`: Performance
- ✅ `test`: Tests
- 🔧 `chore`: Tooling/config

**Extended:**
- 🚀 `ci`: CI/CD
- 🗑️ `revert`: Revert changes
- 🚨 `fix`: Fix warnings
- 🔒️ `fix`: Security fixes
- 🩹 `fix`: Simple fix
- 🚑️ `fix`: Critical hotfix
- 🔥 `fix`: Remove code
- 🎨 `style`: Improve structure
- 🦺 `feat`: Add validation
- ♿️ `feat`: Accessibility
- 💥 `feat`: Breaking changes
- 📈 `feat`: Analytics
- 🏷️ `feat`: Types
- 🌐 `feat`: Internationalization
- 📱 `feat`: Responsive design
- 🚸 `feat`: UX improvements
- 🧑‍💻 `chore`: Developer experience
- 📦️ `chore`: Dependencies
- 🎉 `chore`: Project start
- 🚧 `wip`: Work in progress

## Examples:
- ✨ feat: add user authentication system
- 🐛 fix: resolve memory leak in rendering process
- 📝 docs: update API documentation
- ♻️ refactor: simplify error handling logic
- 🚨 fix: resolve linter warnings
- ✅ test: add unit tests for auth flow

## Behavior:
- **Error handling**: Graceful failures, offer retry options
- **Auto-staging**: Stage all changes if none staged
- **Selective commit**: Only commit staged files if present
- **No confirmation needed**: Auto-execute unless major error