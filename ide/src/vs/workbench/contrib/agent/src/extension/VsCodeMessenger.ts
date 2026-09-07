import { ConfigHandler } from "core/config/ConfigHandler";
import { EDIT_MODE_STREAM_ID } from "core/edit/constants";
import {
  FromCoreProtocol,
  FromWebviewProtocol,
  ToCoreProtocol,
} from "core/protocol";
import { ToWebviewFromCoreProtocol } from "core/protocol/coreWebview";
import { ToIdeFromWebviewOrCoreProtocol } from "core/protocol/ide";
import { ToIdeFromCoreProtocol } from "core/protocol/ideCore";
import { InProcessMessenger, Message } from "core/protocol/messenger";
import {
  CORE_TO_WEBVIEW_PASS_THROUGH,
  WEBVIEW_TO_CORE_PASS_THROUGH,
} from "core/protocol/passThrough";
import { stripImages } from "core/util/messageContent";
import * as vscode from "vscode";

import { ApplyManager } from "../apply";
import { VerticalDiffManager } from "../diff/vertical/manager";
import { addCurrentSelectionToEdit } from "../quickEdit/AddCurrentSelection";
import EditDecorationManager from "../quickEdit/EditDecorationManager";
import { handleLLMError } from "../util/errorHandling";
import { getExtensionUri } from "../util/vscode";
import { VsCodeIde } from "../VsCodeIde";
import { VsCodeWebviewProtocol } from "../webviewProtocol";

import { VsCodeExtension } from "./VsCodeExtension";

type ToIdeOrWebviewFromCoreProtocol = ToIdeFromCoreProtocol &
  ToWebviewFromCoreProtocol;

/**
 * Routes messages between Core, the Agent webview, and VS Code IDE APIs.
 */
export class VsCodeMessenger {
  onWebview<T extends keyof FromWebviewProtocol>(
    messageType: T,
    handler: (
      message: Message<FromWebviewProtocol[T][0]>,
    ) => Promise<FromWebviewProtocol[T][1]> | FromWebviewProtocol[T][1],
  ): void {
    void this.webviewProtocol.on(messageType, handler);
  }

  onCore<T extends keyof ToIdeOrWebviewFromCoreProtocol>(
    messageType: T,
    handler: (
      message: Message<ToIdeOrWebviewFromCoreProtocol[T][0]>,
    ) =>
      | Promise<ToIdeOrWebviewFromCoreProtocol[T][1]>
      | ToIdeOrWebviewFromCoreProtocol[T][1],
  ): void {
    this.inProcessMessenger.externalOn(messageType, handler);
  }

  onWebviewOrCore<T extends keyof ToIdeFromWebviewOrCoreProtocol>(
    messageType: T,
    handler: (
      message: Message<ToIdeFromWebviewOrCoreProtocol[T][0]>,
    ) =>
      | Promise<ToIdeFromWebviewOrCoreProtocol[T][1]>
      | ToIdeFromWebviewOrCoreProtocol[T][1],
  ): void {
    this.onWebview(messageType, handler);
    this.onCore(messageType, handler);
  }

  constructor(
    private readonly inProcessMessenger: InProcessMessenger<
      ToCoreProtocol,
      FromCoreProtocol
    >,
    private readonly webviewProtocol: VsCodeWebviewProtocol,
    private readonly ide: VsCodeIde,
    private readonly verticalDiffManagerPromise: Promise<VerticalDiffManager>,
    private readonly configHandlerPromise: Promise<ConfigHandler>,
    private readonly editDecorationManager: EditDecorationManager,
    _context: vscode.ExtensionContext,
    _vsCodeExtension: VsCodeExtension,
  ) {
    this.onWebview("showFile", (msg) => {
      this.ide.openFile(msg.data.filepath);
    });

    this.onWebview("vscode/openMoveRightMarkdown", () => {
      void vscode.commands.executeCommand(
        "markdown.showPreview",
        vscode.Uri.joinPath(
          getExtensionUri(),
          "media",
          "move-chat-panel-right.md",
        ),
      );
    });

    this.onWebview("toggleDevTools", () => {
      void vscode.commands.executeCommand("agent.viewLogs");
    });

    this.onWebview("reloadWindow", () => {
      void vscode.commands.executeCommand("workbench.action.reloadWindow");
    });
    this.onWebview("focusEditor", () => {
      void vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    });

    this.onWebview("showWorkbenchHover", (msg) => {
      void vscode.commands.executeCommand(
        "agent.internal.showWebviewHover",
        msg.data,
      );
    });

    this.onWebview("hideWorkbenchHover", () => {
      void vscode.commands.executeCommand("agent.internal.hideWebviewHover");
    });
    this.onWebview("openConfigPage", () => {
      void vscode.commands.executeCommand("agent.openConfigPage");
    });
    this.onWebview("openVscodeSettings", () => {
      void vscode.commands.executeCommand("workbench.action.openSettings");
    });
    this.onWebview("openKeyboardShortcuts", () => {
      void vscode.commands.executeCommand(
        "workbench.action.openGlobalKeybindings",
      );
    });
    this.onWebview("toggleFullScreen", () => {
      void vscode.commands.executeCommand("agent.openInNewWindow");
    });

    this.onWebview("acceptDiff", async ({ data: { filepath, streamId } }) => {
      await vscode.commands.executeCommand(
        "agent.acceptDiff",
        filepath,
        streamId,
      );
    });

    this.onWebview("rejectDiff", async ({ data: { filepath, streamId } }) => {
      await vscode.commands.executeCommand(
        "agent.rejectDiff",
        filepath,
        streamId,
      );
    });

    this.onWebview("applyToFile", async ({ data }) => {
      const [verticalDiffManager, configHandler] = await Promise.all([
        this.verticalDiffManagerPromise,
        this.configHandlerPromise,
      ]);

      const applyManager = new ApplyManager(
        this.ide,
        this.webviewProtocol,
        verticalDiffManager,
        configHandler,
      );

      await applyManager.applyToFile(data);
    });

    this.onWebview(
      "overwriteFile",
      async ({ data: { prevFileContent, filepath } }) => {
        if (prevFileContent === null) {
          return;
        }

        await this.ide.openFile(filepath);

        const editor = vscode.window.activeTextEditor;

        if (!editor) {
          void vscode.window.showErrorMessage(
            "No active editor to apply edits to",
          );
          return;
        }

        await editor.edit((builder) =>
          builder.replace(
            new vscode.Range(
              editor.document.positionAt(0),
              editor.document.positionAt(editor.document.getText().length),
            ),
            prevFileContent,
          ),
        );
      },
    );

    this.onWebview("insertAtCursor", async (msg) => {
      const editor = vscode.window.activeTextEditor;
      if (editor === undefined || !editor.selection) {
        return;
      }

      await editor.edit((editBuilder) => {
        editBuilder.replace(
          new vscode.Range(editor.selection.start, editor.selection.end),
          msg.data.text,
        );
      });
    });
    this.onWebview("edit/addCurrentSelection", async () => {
      const verticalDiffManager = await this.verticalDiffManagerPromise;
      await addCurrentSelectionToEdit({
        args: undefined,
        editDecorationManager: this.editDecorationManager,
        webviewProtocol: this.webviewProtocol,
        verticalDiffManager,
      });
    });
    this.onWebview("edit/sendPrompt", async (msg) => {
      const prompt = msg.data.prompt;
      const { start, end } = msg.data.range.range;
      const verticalDiffManager = await this.verticalDiffManagerPromise;

      const configHandler = await this.configHandlerPromise;
      const { config } = await configHandler.loadConfig();

      if (!config) {
        throw new Error("Edit: Failed to load config");
      }

      const model =
        config?.selectedModelByRole.edit ?? config?.selectedModelByRole.chat;

      if (!model) {
        throw new Error("No Edit or Chat model selected");
      }

      const fileAfterEdit = await verticalDiffManager.streamEdit({
        input: stripImages(prompt),
        llm: model,
        streamId: EDIT_MODE_STREAM_ID,
        range: new vscode.Range(
          new vscode.Position(start.line, start.character),
          new vscode.Position(end.line, end.character),
        ),
        rulesToInclude: config.rules,
        isApply: false,
      });

      return fileAfterEdit;
    });

    this.onWebview("edit/clearDecorations", async () => {
      this.editDecorationManager.clear();
    });

    this.onWebview("session/share", async (msg) => {
      await vscode.commands.executeCommand(
        "agent.shareSession",
        msg.data.sessionId,
      );
    });

    WEBVIEW_TO_CORE_PASS_THROUGH.forEach((messageType) => {
      this.onWebview(messageType, async (msg) => {
        return await this.inProcessMessenger.externalRequest(
          messageType,
          msg.data,
          msg.messageId,
        );
      });
    });

    // Fire-and-forget updates must reach every open Agent webview (sidebar +
    // Settings tab). request() only targets the first registered panel.
    const coreToWebviewBroadcast = new Set<string>([
      "configUpdate",
      "sessionUpdate",
      "addContextItem",
      "refreshSubmenuItems",
      "setTTSActive",
      "didCloseFiles",
      "toolCallPartialOutput",
    ]);

    CORE_TO_WEBVIEW_PASS_THROUGH.forEach((messageType) => {
      this.onCore(messageType, async (msg) => {
        if (coreToWebviewBroadcast.has(messageType)) {
          this.webviewProtocol.send(messageType, msg.data);
          return;
        }
        return this.webviewProtocol.request(messageType, msg.data);
      });
    });

    this.onWebviewOrCore("readRangeInFile", async (msg) => {
      return await vscode.workspace
        .openTextDocument(msg.data.filepath)
        .then((document) => {
          const start = new vscode.Position(0, 0);
          const end = new vscode.Position(5, 0);
          const range = new vscode.Range(start, end);

          return document.getText(range);
        });
    });

    this.onWebviewOrCore("getIdeSettings", async () => {
      return this.ide.getIdeSettings();
    });
    this.onWebviewOrCore("getDiff", async (msg) => {
      return this.ide.getDiff(msg.data.includeUnstaged);
    });
    this.onWebviewOrCore("getTerminalContents", async () => {
      return this.ide.getTerminalContents();
    });
    this.onWebviewOrCore("getDebugLocals", async (msg) => {
      return this.ide.getDebugLocals(Number(msg.data.threadIndex));
    });
    this.onWebviewOrCore("getAvailableThreads", async () => {
      return this.ide.getAvailableThreads();
    });
    this.onWebviewOrCore("getTopLevelCallStackSources", async (msg) => {
      return this.ide.getTopLevelCallStackSources(
        msg.data.threadIndex,
        msg.data.stackDepth,
      );
    });
    this.onWebviewOrCore("getWorkspaceDirs", async () => {
      return this.ide.getWorkspaceDirs();
    });
    this.onWebviewOrCore("writeFile", async (msg) => {
      return this.ide.writeFile(msg.data.path, msg.data.contents);
    });
    this.onWebviewOrCore("showVirtualFile", async (msg) => {
      return this.ide.showVirtualFile(msg.data.name, msg.data.content);
    });
    this.onWebviewOrCore("openFile", async (msg) => {
      return this.ide.openFile(msg.data.path);
    });
    this.onWebviewOrCore("runCommand", async (msg) => {
      await this.ide.runCommand(msg.data.command);
    });
    this.onWebviewOrCore("getSearchResults", async (msg) => {
      return this.ide.getSearchResults(msg.data.query, msg.data.maxResults);
    });
    this.onWebviewOrCore("getFileResults", async (msg) => {
      return this.ide.getFileResults(msg.data.pattern, msg.data.maxResults, {
        includeMedia: msg.data.includeMedia,
      });
    });
    this.onWebviewOrCore("readFileAsDataUrl", async (msg) => {
      return this.ide.readFileAsDataUrl?.(
        msg.data.filepath,
        msg.data.maxBytes,
      );
    });
    this.onWebviewOrCore("subprocess", async (msg) => {
      return this.ide.subprocess(msg.data.command, msg.data.cwd);
    });
    this.onWebviewOrCore("getProblems", async (msg) => {
      return this.ide.getProblems(msg.data.filepath);
    });
    this.onWebviewOrCore("getBranch", async (msg) => {
      const { dir } = msg.data;
      return this.ide.getBranch(dir);
    });
    this.onWebviewOrCore("getOpenFiles", async () => {
      return this.ide.getOpenFiles();
    });
    this.onWebviewOrCore("getCurrentFile", async () => {
      return this.ide.getCurrentFile();
    });
    this.onWebviewOrCore("getPinnedFiles", async () => {
      return this.ide.getPinnedFiles();
    });
    this.onWebviewOrCore("showLines", async (msg) => {
      const { filepath, startLine, endLine } = msg.data;
      return this.ide.showLines(filepath, startLine, endLine);
    });
    this.onWebviewOrCore("showToast", (msg) => {
      this.ide.showToast(...msg.data);
    });
    this.onWebviewOrCore("saveFile", async (msg) => {
      return await this.ide.saveFile(msg.data.filepath);
    });
    this.onWebviewOrCore("readFile", async (msg) => {
      return await this.ide.readFile(msg.data.filepath);
    });
    this.onWebviewOrCore("openUrl", (msg) => {
      void vscode.env.openExternal(vscode.Uri.parse(msg.data));
    });

    this.onWebviewOrCore("fileExists", async (msg) => {
      return await this.ide.fileExists(msg.data.filepath);
    });

    this.onWebviewOrCore("gotoDefinition", async (msg) => {
      return await this.ide.gotoDefinition(msg.data.location);
    });

    this.onWebviewOrCore("getReferences", async (msg) => {
      return await this.ide.getReferences(msg.data.location);
    });

    this.onWebviewOrCore("getDocumentSymbols", async (msg) => {
      return await this.ide.getDocumentSymbols(msg.data.textDocumentIdentifier);
    });

    this.onWebviewOrCore("getBrowserPages", async () => {
      return await this.ide.getBrowserPages();
    });

    this.onWebviewOrCore("getBrowserPageContext", async (msg) => {
      return await this.ide.getBrowserPageContext(msg.data.browserId);
    });

    this.onWebviewOrCore("ensureBrowserPageShared", async (msg) => {
      return await this.ide.ensureBrowserPageShared(msg.data.browserId);
    });

    this.onWebviewOrCore("invokeBrowserTool", async (msg) => {
      return await this.ide.invokeBrowserTool(
        msg.data.toolId,
        msg.data.parameters,
      );
    });

    this.onWebviewOrCore("notifyAgentBrowserSubmit", async () => {
      await this.ide.notifyAgentBrowserSubmit();
    });

    this.onWebviewOrCore("getFileStats", async (msg) => {
      return await this.ide.getFileStats(msg.data.files);
    });

    this.onWebviewOrCore("getGitRootPath", async (msg) => {
      return await this.ide.getGitRootPath(msg.data.dir);
    });

    this.onWebviewOrCore("listDir", async (msg) => {
      return await this.ide.listDir(msg.data.dir);
    });

    this.onWebviewOrCore("getRepoName", async (msg) => {
      return await this.ide.getRepoName(msg.data.dir);
    });

    this.onWebviewOrCore("getIdeInfo", async () => {
      return await this.ide.getIdeInfo();
    });

    this.onWebviewOrCore("isTelemetryEnabled", async () => {
      return await this.ide.isTelemetryEnabled();
    });

    this.onWebviewOrCore("getUniqueId", async () => {
      return await this.ide.getUniqueId();
    });

    this.onWebviewOrCore("reportError", async (msg) => {
      await handleLLMError(msg.data);
    });
  }
}
