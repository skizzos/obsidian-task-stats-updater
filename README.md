# obsidian-task-stats-updater

Task Stats Updater is an Obsidian plugin that automatically analyzes tasks in a note and keeps task statistics up to date in the frontmatter.
It supports manual updates, automatic updates on file changes, and configurable exclusions for folders and files (with exact matches or regular expressions).

## Features

✅ Parses Markdown task lists in the active note
📊 Updates task statistics directly in the note frontmatter
⏱ Automatically updates stats when the active file is modified
🔘 Manual update via command palette or ribbon icon
🚫 Exclude specific folders or files from processing
🧩 Supports both exact matches and regular expressions

## Supported Task Formats
The plugin recognizes standard Obsidian task syntax:

- [x] Completed task
- [/] Task in progress
- [ ] Todo task

It also detects due dates using the calendar emoji:

- [ ] Task with deadline 📅 2024-12-31

Tasks with a due date before today are considered late.

## Frontmatter Fields Generated
After processing a note, the plugin updates (or creates) the following frontmatter fields:

```
tasks_done: 3
tasks_doing: 1
tasks_todo: 5
tasks_total: 9
tasks_progress: 33
tasks_late: 2
tasks_late_percent: 22
tasks_status: 🟡 In progress
```

## Status values

```
✅ Completed – all tasks are done
🔴 Late – at least one late task
🟡 In progress – mix of done/doing tasks
⚪ Not started – no tasks completed
— – no tasks found
```

## How It Works

The plugin processes only the active file
On every modification of the active note, stats are updated with a short debounce
Excluded files and folders are skipped entirely
Frontmatter is updated using Obsidian’s native API (safe and non-destructive)

## Commands & UI
### Commands

“Update task statistics (active file)”
Manually recompute task stats for the active note

### Ribbon Icon

```
A ✅ icon in the left ribbon triggers a manual update for the active file
```

## Settings
The plugin provides a dedicated settings tab.

### Excluded Folders
Exclude entire folders from task stat updates.
You can add:


Exact folder prefixes
Example:
```
Archive
```
(matches Archive/...)

Regular expressions (matched against full vault-relative path)
Example:
```
^Private/.*
```

### Excluded Files
Exclude specific files from task stat updates.
You can add:


Exact file names (case-insensitive)
Example:
```
Index.md
```

Regular expressions (matched against full vault-relative path)
Example:
```
.*template.*\.md$
```
Each rule can be toggled between exact match and RegExp mode.


## Installation
### Manual Installation

- Copy the plugin folder into:
```
.obsidian/plugins/task-stats-updater/
```

- Ensure it contains:
```
main.js
manifest.json
```

- Reload Obsidian
Enable Task Stats Updater in Settings → Community Plugins

# Notes & Limitations

- Only Markdown list tasks (- [ ]) are counted
- Tasks inside code blocks are not filtered out
- Due dates must be in YYYY-MM-DD format and preceded by 📅
- Statistics are computed per file (no vault-wide aggregation)


## License
MIT
