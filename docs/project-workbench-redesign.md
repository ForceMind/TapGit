# Project Workbench Redesign

## Goal

TapGit should open into the project itself, not into an explanation of version control. Once a project is selected, the main screen should answer four questions at a glance:

1. Which project am I working on?
2. What is the current copy?
3. What changed recently?
4. What can I safely do next?

The AI assistant card is intentionally visual-only in this iteration. It reserves space for a future assistant without adding unfinished behavior.

## Screen Structure

The new shell follows the provided mockup direction:

- Left sidebar: product identity, primary navigation, inactive AI assistant card, GitHub account status.
- Project header: project icon, name, local path, last saved note, last saved time, current copy, main actions.
- Metric row: current copy, saved points, last save, project size.
- Main area: top-level file list with modified time and size.
- Right rail: recent saved records and quick actions.
- Footer: local repository path, sync freshness placeholder, workspace cleanliness.

## Navigation Language

The UI now allows slightly more familiar Git-adjacent wording where the user mockup expects it, while still avoiding advanced Git mental models.

- "My Projects" / "我的项目"
- "Changes" / "变更"
- "History" / "提交历史"
- "Backups" / "备份与恢复"
- "Idea Lab" / "试新想法"
- "Settings" / "设置"

## Data Contract

The home screen needs more than `ProjectSummary`, so a read-only overview contract was added:

- top-level files
- total project size
- saved record count
- recent saved records
- last saved time and message

The overview deliberately avoids walking large generated folders such as `.git`, `node_modules`, `release`, `dist`, and build outputs.

## Deferred

- AI assistant actions
- inline file creation and upload from the file table
- real cloud freshness in the footer
- full file browser inside TapGit
