# Editor and workspace

Quantum uses the Visual Studio Code workbench foundation for editing and project navigation, with Quantum Agent and an integrated browser alongside it.

## Open and navigate a project

Open a folder or workspace to make its files available in Explorer. Use the command palette to find commands, Quick Open to navigate to a file, and Search to find text across the workspace. The status bar shows information about the active editor, including language and cursor position when applicable.

## Edit, run, and debug

The editor provides language features through built-in and installed extensions. Use the integrated terminal for project commands, Source Control for Git changes, and Run and Debug for configured debugging workflows. Availability of language support, debuggers, and tasks depends on your project and installed extensions.

Use the diff editor and source control views to review changes. Quantum Agent can also propose edits; see [Inline editing and autocomplete](agent.md#inline-editing-and-autocomplete).

## Extensions and settings

Quantum uses [Open VSX](https://open-vsx.org) for extensions. Search the Extensions view and check an extension's compatibility and permissions before installing it. Not every extension or service built for another VS Code distribution is necessarily available or compatible.

**Settings** opens Quantum's settings, including Agent configuration. **Open VS Code Settings** opens the underlying workbench settings. Keyboard shortcuts can be viewed and customized through the workbench; Quantum's Settings also lists Agent shortcuts. Shortcuts may differ by platform and user configuration.
