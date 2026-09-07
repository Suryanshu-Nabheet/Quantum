import * as child_process from "node:child_process";
import { exec } from "node:child_process";

import { Range } from "core";
import { DEFAULT_FILE_ATTACH_IGNORES, DEFAULT_IGNORES, INLINE_IMAGE_MIME_BY_EXT, defaultIgnoresGlob } from "core/indexing/ignore";
import * as URI from "uri-js";
import * as vscode from "vscode";

import {
    executeGotoProvider,
    executeSignatureHelpProvider,
    executeSymbolProvider,
} from "./autocomplete/lsp";
import { Repository } from "./otherExtensions/git";
import { SecretStorage } from "./stubs/SecretStorage";
import { EXTENSION_NAME } from "./util/constants";
import { VsCodeIdeUtils } from "./util/ideUtils";
import { getExtensionVersion, isExtensionPrerelease } from "./util/util";
import { getExtensionUri, openEditorAndRevealRange } from "./util/vscode";
import { VsCodeWebviewProtocol } from "./webviewProtocol";
import {
  AGENT_BROWSER_ENSURE_SHARED_COMMAND,
  AGENT_BROWSER_GET_OPEN_PAGES_COMMAND,
  AGENT_BROWSER_GET_PAGE_CONTEXT_COMMAND,
  AGENT_BROWSER_INVOKE_TOOL_COMMAND,
  AGENT_BROWSER_NOTIFY_SUBMIT_COMMAND,
  type AgentBrowserPageSummary,
} from "../shared/browser";

import type {
    DocumentSymbol,
    FileStatsMap,
    FileType,
    IDE,
    IdeInfo,
    IdeSettings,
    Location,
    Problem,
    RangeInFile,
    SignatureHelp,
    TerminalOptions,
    Thread,
} from "core";

class VsCodeIde implements IDE {
  ideUtils: VsCodeIdeUtils;
  secretStorage: SecretStorage;

  constructor(
    private readonly vscodeWebviewProtocolPromise: Promise<VsCodeWebviewProtocol>,
    private readonly context: vscode.ExtensionContext,
  ) {
    this.ideUtils = new VsCodeIdeUtils();
    this.secretStorage = new SecretStorage(context);
  }

  async readSecrets(keys: string[]): Promise<Record<string, string>> {
    const secretValuePromises = keys.map((key) => this.secretStorage.get(key));
    const secretValues = await Promise.all(secretValuePromises);

    return keys.reduce(
      (acc, key, index) => {
        if (secretValues[index] === undefined) {
          return acc;
        }

        acc[key] = secretValues[index];
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  async writeSecrets(secrets: { [key: string]: string }): Promise<void> {
    for (const [key, value] of Object.entries(secrets)) {
      await this.secretStorage.store(key, value);
    }
  }

  async fileExists(uri: string): Promise<boolean> {
    try {
      const stat = await this.ideUtils.stat(this.parseUri(uri));
      return stat !== null;
    } catch (error) {
      if (error instanceof vscode.FileSystemError) {
        return false;
      }
      throw error;
    }
  }

  async gotoDefinition(location: Location): Promise<RangeInFile[]> {
    const result = await executeGotoProvider({
      uri: this.parseUri(location.filepath),
      line: location.position.line,
      character: location.position.character,
      name: "vscode.executeDefinitionProvider",
    });

    return result;
  }

  async gotoTypeDefinition(location: Location): Promise<RangeInFile[]> {
    const result = await executeGotoProvider({
      uri: this.parseUri(location.filepath),
      line: location.position.line,
      character: location.position.character,
      name: "vscode.executeTypeDefinitionProvider",
    });

    return result;
  }

  async getSignatureHelp(location: Location): Promise<SignatureHelp | null> {
    const result = await executeSignatureHelpProvider({
      uri: this.parseUri(location.filepath),
      line: location.position.line,
      character: location.position.character,
      name: "vscode.executeSignatureHelpProvider",
    });

    return result;
  }

  async getReferences(location: Location): Promise<RangeInFile[]> {
    const result = await executeGotoProvider({
      uri: this.parseUri(location.filepath),
      line: location.position.line,
      character: location.position.character,
      name: "vscode.executeReferenceProvider",
    });

    return result;
  }

  async getDocumentSymbols(
    textDocumentIdentifier: string, // uri
  ): Promise<DocumentSymbol[]> {
    const result = await executeSymbolProvider({
      uri: this.parseUri(textDocumentIdentifier),
      name: "vscode.executeDocumentSymbolProvider",
    });

    return result;
  }

  onDidChangeActiveTextEditor(callback: (uri: string) => void): void {
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        callback(editor.document.uri.toString());
      }
    });
  }

  showToast: IDE["showToast"] = async (...params) => {
    const [type, message, ...otherParams] = params;
    const { showErrorMessage, showWarningMessage, showInformationMessage } =
      vscode.window;

    switch (type) {
      case "error":
        return showErrorMessage(message, "Show logs").then((selection) => {
          if (selection === "Show logs") {
            vscode.commands.executeCommand("workbench.action.toggleDevTools");
          }
        });
      case "info":
        return showInformationMessage(message, ...otherParams);
      case "warning":
        return showWarningMessage(message, ...otherParams);
    }
  };

  async getRepoName(dir: string): Promise<string | undefined> {
    const repo = await this.getRepo(dir);
    const remotes = repo?.state.remotes;
    if (!remotes) {
      return undefined;
    }
    const remote =
      remotes?.find((r: any) => r.name === "origin") ?? remotes?.[0];
    if (!remote) {
      return undefined;
    }
    const ownerAndRepo = remote.fetchUrl
      ?.replace(".git", "")
      .split("/")
      .slice(-2);
    return ownerAndRepo?.join("/");
  }

  getIdeInfo(): Promise<IdeInfo> {
    return Promise.resolve({
      ideType: "vscode",
      name: vscode.env.appName,
      version: vscode.version,
      remoteName: vscode.env.remoteName || "local",
      extensionVersion: getExtensionVersion(),
      isPrerelease: isExtensionPrerelease(),
    });
  }

  readRangeInFile(fileUri: string, range: Range): Promise<string> {
    return this.ideUtils.readRangeInFile(
      this.parseUri(fileUri),
      new vscode.Range(
        new vscode.Position(range.start.line, range.start.character),
        new vscode.Position(range.end.line, range.end.character),
      ),
    );
  }

  async getFileStats(files: string[]): Promise<FileStatsMap> {
    const pathToLastModified: FileStatsMap = {};
    await Promise.all(
      files.map(async (file) => {
        const stat = await this.ideUtils.stat(
          this.parseUri(file),
          false /* No need to catch ENOPRO exceptions */,
        );
        pathToLastModified[file] = {
          lastModified: stat!.mtime,
          size: stat!.size,
        };
      }),
    );

    return pathToLastModified;
  }

  async getRepo(dir: string): Promise<Repository | undefined> {
    return this.ideUtils.getRepo(this.parseUri(dir));
  }


  isWorkspaceRemote(): Promise<boolean> {
    return Promise.resolve(vscode.env.remoteName !== undefined);
  }

  isTelemetryEnabled(): Promise<boolean> {
    return Promise.resolve(false);
  }

  getUniqueId(): Promise<string> {
    return Promise.resolve(this.ideUtils.getUniqueId());
  }

  async getDiff(includeUnstaged: boolean): Promise<string[]> {
    return await this.ideUtils.getDiff(includeUnstaged);
  }

  async getClipboardContent() {
    const text = await vscode.env.clipboard.readText();
    const copiedAt = new Date().toISOString();
    return { text, copiedAt };
  }

  async getTerminalContents(): Promise<string> {
    return await this.ideUtils.getTerminalContents(1);
  }

  async getDebugLocals(threadIndex: number): Promise<string> {
    return await this.ideUtils.getDebugLocals(threadIndex);
  }

  async getTopLevelCallStackSources(
    threadIndex: number,
    stackDepth: number,
  ): Promise<string[]> {
    return await this.ideUtils.getTopLevelCallStackSources(
      threadIndex,
      stackDepth,
    );
  }
  async getAvailableThreads(): Promise<Thread[]> {
    return await this.ideUtils.getAvailableThreads();
  }

  async getWorkspaceDirs(): Promise<string[]> {
    return this.ideUtils.getWorkspaceDirectories().map((uri) => uri.toString());
  }

  async writeFile(fileUri: string, contents: string): Promise<void> {
    await vscode.workspace.fs.writeFile(
      this.parseUri(fileUri),
      Buffer.from(contents),
    );
  }

  async removeFile(fileUri: string): Promise<void> {
    await vscode.workspace.fs.delete(this.parseUri(fileUri));
  }

  async showVirtualFile(title: string, contents: string): Promise<void> {
    this.ideUtils.showVirtualFile(title, contents);
  }

  async openFile(fileUri: string): Promise<void> {
    await this.ideUtils.openFile(this.parseUri(fileUri));
  }

  async showLines(
    fileUri: string,
    startLine: number,
    endLine: number,
  ): Promise<void> {
    const range = new vscode.Range(
      new vscode.Position(startLine, 0),
      new vscode.Position(endLine, 0),
    );
    openEditorAndRevealRange(this.parseUri(fileUri), range).then(
      (editor) => {
        // Select the lines
        editor.selection = new vscode.Selection(
          new vscode.Position(startLine, 0),
          new vscode.Position(endLine, 0),
        );
      },
    );
  }

  async runCommand(
    command: string,
    options: TerminalOptions = { reuseTerminal: true },
  ): Promise<void> {
    let terminal: vscode.Terminal | undefined;
    if (vscode.window.terminals.length && options.reuseTerminal) {
      if (options.terminalName) {
        terminal = vscode.window.terminals.find(
          (t) => t?.name === options.terminalName,
        );
      } else {
        terminal = vscode.window.activeTerminal ?? vscode.window.terminals[0];
      }
    }

    if (!terminal) {
      terminal = vscode.window.createTerminal(options?.terminalName);
    }
    terminal.show();
    terminal.sendText(command, false);
  }

  async saveFile(fileUri: string): Promise<void> {
    await this.ideUtils.saveFile(this.parseUri(fileUri));
  }

  private static MAX_BYTES = 100000;

  async readFile(fileUri: string): Promise<string> {
    try {
      const uri = this.parseUri(fileUri);

      // First, check whether it's a notebook document
      // Need to iterate over the cells to get full contents
      const notebook =
        vscode.workspace.notebookDocuments.find((doc) =>
          URI.equal(doc.uri.toString(), uri.toString()),
        ) ??
        (uri.path.endsWith("ipynb")
          ? await vscode.workspace.openNotebookDocument(uri)
          : undefined);
      if (notebook) {
        return notebook
          .getCells()
          .map((cell) => cell.document.getText())
          .join("\n\n");
      }

      // Check whether it's an open document
      const openTextDocument = vscode.workspace.textDocuments.find((doc) =>
        URI.equal(doc.uri.toString(), uri.toString()),
      );
      if (openTextDocument !== undefined) {
        return openTextDocument.getText();
      }

      const fileStats = await this.ideUtils.stat(uri);
      if (fileStats === null || fileStats.size > 10 * VsCodeIde.MAX_BYTES) {
        return "";
      }

      const bytes = await this.ideUtils.readFile(uri);
      if (bytes === null) {
        return "";
      }

      // Truncate the buffer to the first MAX_BYTES
      const truncatedBytes = bytes.slice(0, VsCodeIde.MAX_BYTES);
      const contents = new TextDecoder().decode(truncatedBytes);
      return contents;
    } catch (e) {
      return "";
    }
  }

  async openUrl(url: string): Promise<void> {
    await vscode.env.openExternal(this.parseUri(url));
  }

  async getExternalUri(uri: string): Promise<string> {
    const vsCodeUri = this.parseUri(uri);
    const externalUri = await vscode.env.asExternalUri(vsCodeUri);
    return externalUri.toString(true);
  }

  async getOpenFiles(): Promise<string[]> {
    return this.ideUtils.getOpenFiles().map((uri) => uri.toString());
  }

  async getCurrentFile() {
    if (!vscode.window.activeTextEditor) {
      return undefined;
    }
    return {
      isUntitled: vscode.window.activeTextEditor.document.isUntitled,
      path: vscode.window.activeTextEditor.document.uri.toString(),
      contents: vscode.window.activeTextEditor.document.getText(),
    };
  }

  async getPinnedFiles(): Promise<string[]> {
    const tabArray = vscode.window.tabGroups.all[0].tabs;

    return tabArray
      .filter((t) => t.isPinned)
      .map((t) => (t.input as vscode.TabInputText).uri.toString());
  }

  runRipgrepQuery(dirUri: string, args: string[]) {
    const relativeDir = this.parseUri(dirUri).fsPath;
    const ripGrepUri = vscode.Uri.joinPath(
      getExtensionUri(),
      "out/node_modules/@vscode/ripgrep/bin/rg",
    );
    const p = child_process.spawn(ripGrepUri.fsPath, args, {
      cwd: relativeDir,
    });
    let output = "";

    p.stdout.on("data", (data) => {
      output += data.toString();
    });

    return new Promise<string>((resolve, reject) => {
      p.on("error", reject);
      p.on("close", (code) => {
        if (code === 0) {
          resolve(output);
        } else if (code === 1) {
          // No matches
          resolve(
            "No matches found. Build, secrets, etc. dirs and files are not included.",
          );
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    });
  }

  private async buildWorkspaceIgnoreGlobs(options?: {
    includeMedia?: boolean;
  }): Promise<string[]> {
    const ignoreFiles = await vscode.workspace.findFiles(
      "**/.agentignore",
      null,
    );

    const baseIgnores = options?.includeMedia
      ? DEFAULT_FILE_ATTACH_IGNORES // @ Files attach: allow media + other file kinds
      : DEFAULT_IGNORES;

    const ignoreGlobs: Set<string> = new Set();
    for (const ignorePattern of baseIgnores) {
      ignoreGlobs.add(ignorePattern);
    }

    for (const file of ignoreFiles) {
      const content = await this.ideUtils.readFile(file);
      if (content === null) {
        continue;
      }
      const filePath = vscode.workspace.asRelativePath(file);
      const fileDir = filePath
        .replace(/\\/g, "/")
        .replace(/\/$/, "")
        .split("/")
        .slice(0, -1)
        .join("/");

      const patterns = Buffer.from(content)
        .toString()
        .split("\n")
        .map((line) => line.trim())
        .filter(
          (line) => line && !line.startsWith("#") && !line.startsWith("!"),
        );

      patterns
        .map((ignoreLine) => {
          const normalizedPattern = ignoreLine.replace(/\\/g, "/");

          if (normalizedPattern.startsWith("/")) {
            if (fileDir) {
              return `{/,}${normalizedPattern}`;
            } else {
              return `${fileDir}/${normalizedPattern.substring(1)}`;
            }
          } else {
            if (fileDir) {
              return `${fileDir}/${normalizedPattern}`;
            } else {
              return `**/${normalizedPattern}`;
            }
          }
        })
        .map((ignoreLine) => {
          return ignoreLine.endsWith("/") ? `${ignoreLine}**/*` : ignoreLine;
        })
        .forEach((ignoreLine) => {
          ignoreGlobs.add(ignoreLine);
        });
    }

    return Array.from(ignoreGlobs);
  }

  private async getRemoteWorkspaceSearchResults(
    query: string,
    maxResults?: number,
  ): Promise<string> {
    const ignoreGlobsArray = await this.buildWorkspaceIgnoreGlobs();
    const fileScanLimit = maxResults ? Math.min(maxResults * 50, 5000) : 5000;
    const files = await vscode.workspace.findFiles(
      "**/*",
      ignoreGlobsArray.length ? `{${ignoreGlobsArray.join(",")}}` : null,
      fileScanLimit,
    );

    let pattern: RegExp;
    try {
      pattern = new RegExp(query, "i");
    } catch {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      pattern = new RegExp(escaped, "i");
    }

    const outputLines: string[] = [];
    let matchCount = 0;
    let currentFile: string | null = null;

    for (const file of files) {
      if (maxResults && matchCount >= maxResults) {
        break;
      }

      const content = await this.ideUtils.readFile(file);
      if (content === null) {
        continue;
      }

      const relPath = `./${vscode.workspace.asRelativePath(file)}`;
      const lines = new TextDecoder().decode(content).split("\n");

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        if (!pattern.test(lines[lineIndex])) {
          continue;
        }

        if (currentFile !== relPath) {
          if (currentFile !== null) {
            outputLines.push("--");
          }
          outputLines.push(relPath);
          currentFile = relPath;
        }

        const contextStart = Math.max(0, lineIndex - 2);
        const contextEnd = Math.min(lines.length - 1, lineIndex + 2);
        for (let j = contextStart; j <= contextEnd; j++) {
          const prefix = j === lineIndex ? ":" : "-";
          outputLines.push(`${prefix}${lines[j]}`);
        }

        matchCount++;
        if (maxResults && matchCount >= maxResults) {
          break;
        }
      }
    }

    if (outputLines.length === 0) {
      return "No matches found. Build, secrets, etc. dirs and files are not included.";
    }

    return outputLines.join("\n");
  }

  async getFileResults(
    pattern: string,
    maxResults?: number,
    options?: { includeMedia?: boolean },
  ): Promise<string[]> {
    const ignoreGlobsArray = await this.buildWorkspaceIgnoreGlobs(options);
    const results = await vscode.workspace.findFiles(
      pattern,
      ignoreGlobsArray.length ? `{${ignoreGlobsArray.join(",")}}` : null,
      maxResults,
    );
    return results.map((result) => vscode.workspace.asRelativePath(result));
  }

  async readFileAsDataUrl(
    fileUri: string,
    maxBytes = 5 * 1024 * 1024,
  ): Promise<string | undefined> {
    try {
      const uri = this.parseUri(fileUri);
      const fileStats = await this.ideUtils.stat(uri);
      if (fileStats === null || fileStats.size > maxBytes) {
        return undefined;
      }
      const bytes = await this.ideUtils.readFile(uri);
      if (bytes === null || bytes.byteLength === 0) {
        return undefined;
      }

      const ext = uri.path.split(".").pop()?.toLowerCase() ?? "";
      const mime =
        INLINE_IMAGE_MIME_BY_EXT[ext] ?? "application/octet-stream";
      const base64 = Buffer.from(bytes).toString("base64");
      return `data:${mime};base64,${base64}`;
    } catch {
      return undefined;
    }
  }

  async getSearchResults(query: string, maxResults?: number): Promise<string> {
    if (vscode.env.remoteName) {
      return this.getRemoteWorkspaceSearchResults(query, maxResults);
    }

    const results: string[] = [];

    for (const dir of await this.getWorkspaceDirs()) {
      const dirResults = await this.runRipgrepQuery(dir, [
        "-i", // Case-insensitive search
        "--ignore-file",
        ".agentignore",
        "--ignore-file",
        ".gitignore",
        "-C",
        "2", // Show 2 lines of context
        "--heading", // Only show filepath once per result
        // Use a single glob with all default ignores
        "--glob",
        defaultIgnoresGlob,
        ...(maxResults ? ["-m", maxResults.toString()] : []),
        "-e",
        query, // Pattern to search for
        ".", // Directory to search in
      ]);

      results.push(dirResults);
    }

    const allResults = results.join("\n");
    if (maxResults) {
      // In case of multiple workspaces, do max results per workspace and then truncate to maxResults
      // Will prioritize first workspace results, fine for now
      // Results are separated by either ./ or --
      const matches = Array.from(allResults.matchAll(/(\n--|\n\.\/)/g));
      if (matches.length > maxResults) {
        return allResults.substring(0, matches[maxResults].index);
      } else {
        return allResults;
      }
    } else {
      return allResults;
    }
  }

  async getProblems(fileUri?: string | undefined): Promise<Problem[]> {
    const uri = fileUri
      ? this.parseUri(fileUri)
      : vscode.window.activeTextEditor?.document.uri;
    if (!uri) {
      return [];
    }
    return vscode.languages.getDiagnostics(uri).map((d) => {
      return {
        filepath: uri.toString(),
        range: {
          start: {
            line: d.range.start.line,
            character: d.range.start.character,
          },
          end: { line: d.range.end.line, character: d.range.end.character },
        },
        message: d.message,
      };
    });
  }

  async subprocess(command: string, cwd?: string): Promise<[string, string]> {
    return new Promise((resolve, reject) => {
      exec(command, { cwd }, (error, stdout, stderr) => {
        if (error) {
          console.warn(error);
          reject(stderr);
        }
        resolve([stdout, stderr]);
      });
    });
  }

  async getBranch(dir: string): Promise<string> {
    return this.ideUtils.getBranch(this.parseUri(dir));
  }

  async getGitRootPath(dir: string): Promise<string | undefined> {
    const root = await this.ideUtils.getGitRoot(this.parseUri(dir));
    return root?.toString();
  }

  private parseUri(uri: string): vscode.Uri {
    try {
      const parsed = vscode.Uri.parse(uri);
      if (parsed.scheme === "") {
        return vscode.Uri.file(uri);
      }
      return parsed;
    } catch (e) {
      return vscode.Uri.file(uri);
    }
  }

  async listDir(dir: string): Promise<[string, FileType][]> {
    const entries = await this.ideUtils.readDirectory(this.parseUri(dir));
    return entries === null ? [] : (entries as any);
  }

  private getIdeSettingsSync(): IdeSettings {
    return {};
  }

  async getIdeSettings(): Promise<IdeSettings> {
    const ideSettings = this.getIdeSettingsSync();
    return ideSettings;
  }

  async getBrowserPages(): Promise<AgentBrowserPageSummary[]> {
    return (
      (await vscode.commands.executeCommand<AgentBrowserPageSummary[]>(
        AGENT_BROWSER_GET_OPEN_PAGES_COMMAND,
      )) ?? []
    );
  }

  async getBrowserPageContext(browserId: string) {
    return vscode.commands.executeCommand<string | undefined>(
      AGENT_BROWSER_GET_PAGE_CONTEXT_COMMAND,
      browserId,
    );
  }

  async ensureBrowserPageShared(browserId: string) {
    return (
      (await vscode.commands.executeCommand<boolean>(
        AGENT_BROWSER_ENSURE_SHARED_COMMAND,
        browserId,
      )) ?? false
    );
  }

  async invokeBrowserTool(
    toolId: string,
    parameters: Record<string, unknown>,
  ): Promise<string> {
    return (
      (await vscode.commands.executeCommand<string>(
        AGENT_BROWSER_INVOKE_TOOL_COMMAND,
        { toolId, parameters },
      )) ?? ""
    );
  }

  async notifyAgentBrowserSubmit(): Promise<void> {
    await vscode.commands.executeCommand(AGENT_BROWSER_NOTIFY_SUBMIT_COMMAND);
  }
}

export { VsCodeIde };
