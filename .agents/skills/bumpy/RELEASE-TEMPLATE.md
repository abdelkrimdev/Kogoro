# Release Template

Use this template to ensure consistent formatting across all releases.

## CHANGELOG.md format

Each package (`apps/cli/CHANGELOG.md`, `apps/gui/CHANGELOG.md`) uses this structure:

```markdown
## <version>
<sub><date></sub>

-  *(minor)* - <feature description>
-  *(minor)* - <feature description>
  - <sub-feature>
  - <sub-feature>
-  *(patch)* - <bug fix description>
```

### Rules

- One bullet per change
- `*(minor)*` for features, `*(patch)*` for fixes
- Group all `minor` entries before `patch` entries
- Sub-features use indented bullets under the parent
- Descriptions are product-focused (no implementation details)
- No section headers (no "### Features", "### Bug fixes")

## GitHub release notes format

```markdown
## @kogoro/cli

-  *(minor)* - <feature description>
-  *(patch)* - <bug fix description>

## @kogoro/gui

-  *(minor)* - <feature description>
-  *(patch)* - <bug fix description>
```

### Rules

- Separate section per package
- Same bullet format as CHANGELOG.md
- Include all changes from both packages
- Minor entries before patch entries
