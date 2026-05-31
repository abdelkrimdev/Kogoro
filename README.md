# Kogoro

Kogoro is a powerful tool for organizing and renaming anime collections. It intelligently matches media files against online databases (such as AniDB and TVDB), generates renaming plans, and fetches associated artwork, subtitles, and metadata.

Kogoro provides both a robust CLI and a modern desktop GUI (built with Electrobun and Svelte).

## Features

- **Scan Workflow**: A four-phase process (Scan, Plan, Review, Execute) giving you full control before any files are touched.
- **Database Integration**: Matches files against extensive databases to accurately identify episodes, movies, OVAs, and specials.
- **Auto-Merge**: Seamlessly integrates newly scanned files into your existing library without duplicating entries, based on external database IDs.
- **Overrides**: Persist manual corrections in `kogoro.toml` so future scans respect your customized match rules.
- **Disambiguation**: Automatically handles multiple files resolving to the same episode by safely appending disambiguating tags (e.g., resolution, release group) to the filenames.

## Project Structure

Kogoro is a monorepo managed with [Bun](https://bun.sh/):

- `apps/cli`: The command-line interface.
- `apps/gui`: The Electrobun-powered desktop application.
- `packages/core`: Shared business logic, domain models, and matching engine.
- `packages/plugins`: Integration plugins for external databases (e.g., AniDB, TVDB).

## Getting Started

### Prerequisites

Ensure you have [Bun](https://bun.sh/) installed on your system.

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/abdelkrimdev/kogoro.git
cd kogoro
bun install
```

### Running the CLI

```bash
bun run start:cli
```

### Running the GUI

```bash
bun run start:gui
```

### Development Scripts

- `bun run check`: Run type checking across the workspace.
- `bun run lint`: Lint code with Biome.
- `bun run format`: Format code with Biome.
- `bun run test`: Run the test suite.

## Core Concepts

- **MediaFile**: A video file on disk containing an anime episode, movie, OVA, or special.
- **Library**: Your organized collection, tracked via a derived SQLite database that aggregates on-disk and match cache data.
- **Match**: The resolution of a MediaFile to an exact episode using filename parsing and database lookups.
- **Rename Plan**: A proposed set of file operations shown for your approval prior to execution.
- **Review Screen (GUI)**: The interface where you can inspect plans, correct misidentified episodes via drag-and-drop swaps, and finalize changes.
