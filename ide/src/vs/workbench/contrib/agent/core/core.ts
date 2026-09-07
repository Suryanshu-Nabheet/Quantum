import { fetchwithRequestOptions } from "fetch";
import * as URI from "uri-js";
import { v4 as uuidv4 } from "uuid";

import { CompletionProvider } from "./autocomplete/CompletionProvider";
import {
  openedFilesLruCache,
  prevFilepaths,
} from "./autocomplete/util/openedFilesLruCache";
import { ConfigHandler } from "./config/ConfigHandler";
import {
  addGuiPrompt,
  addGuiRule,
  addMcpServer,
  addModel,
  deleteGuiPrompt,
  deleteGuiRule,
  deleteMcpServer,
  deleteModel,
  updateGuiPrompt,
  updateGuiRule,
  updateMcpServer,
  updateModel,
} from "./config/util";

import { countTokens } from "./llm/countTokens";
import Lemonade from "./llm/llms/Lemonade";
import Ollama from "./llm/llms/Ollama";
import { callTool } from "./tools/callTool";
import { ChatDescriber } from "./util/chatDescriber";
import { compactConversation } from "./util/conversationCompaction";
import { GlobalContext } from "./util/GlobalContext";
import historyManager from "./util/history";
import {
  isProcessBackgrounded,
  killTerminalProcess,
  markProcessAsBackgrounded,
} from "./util/processTerminalStates";
import { getSymbolsForManyFiles } from "./util/symbols";
import { TTS } from "./util/tts";

import {
  ContextItemWithId,
  ContextSubmenuItem,
  ModelDescription,
  ToolCall,
  type ContextItem,
  type IDE
} from ".";

import { GitDiffCache } from "./autocomplete/snippets/gitDiffCache";
import { stringifyMcpPrompt } from "./commands/slash/mcpSlashCommand";
import {
  isAgentConfigRelatedUri,
  isColocatedRulesFile,
} from "./config/loadLocalAssistants";
import { CodebaseRulesCache } from "./config/markdown/loadCodebaseRules";
import { loadMarkdownSkills } from "./config/markdown/loadMarkdownSkills";
import { MCPManagerSingleton } from "./context/mcp/MCPManagerSingleton";


import { myersDiff } from "./diff/myers";
import { ApplyAbortManager } from "./edit/applyAbortManager";
import { streamDiffLines } from "./edit/streamDiffLines";
import { shouldIgnore } from "./indexing/shouldIgnore";
import { walkDirCache } from "./indexing/walkDir";
import { LLMLogger } from "./llm/logger";
import { llmStreamChat } from "./llm/streamChat";
import type { FromCoreProtocol, ToCoreProtocol } from "./protocol";
import type { IMessenger, Message } from "./protocol/messenger";
import { AgentError, AgentErrorReason } from "./util/errors";
import { shareSession } from "./util/historyUtils";
import { Logger } from "./util/Logger.js";

export class Core {
  configHandler: ConfigHandler;
  completionProvider: CompletionProvider;
  private globalContext = new GlobalContext();
  llmLogger = new LLMLogger();

  private messageAbortControllers = new Map<string, AbortController>();
  private addMessageAbortController(id: string): AbortController {
    const controller = new AbortController();
    this.messageAbortControllers.set(id, controller);
    controller.signal.addEventListener("abort", () => {
      this.messageAbortControllers.delete(id);
    });
    return controller;
  }
  private abortById(messageId: string) {
    this.messageAbortControllers.get(messageId)?.abort();
  }

  invoke<T extends keyof ToCoreProtocol>(
    messageType: T,
    data: ToCoreProtocol[T][0],
  ): ToCoreProtocol[T][1] {
    return this.messenger.invoke(messageType, data);
  }

  send<T extends keyof FromCoreProtocol>(
    messageType: T,
    data: FromCoreProtocol[T][0],
    messageId?: string,
  ): string {
    return this.messenger.send(messageType, data, messageId);
  }

  // through the messenger (it does in the case of any non-VS Code IDEs already)
  constructor(
    private readonly messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
    private readonly ide: IDE,
  ) {
    try {
      // Ensure .agent directory is created


      const ideInfoPromise = messenger.request("getIdeInfo", undefined);
      this.configHandler = new ConfigHandler(
        this.ide,
        this.llmLogger,
      );


      MCPManagerSingleton.getInstance().onConnectionsRefreshed = () => {
        void this.configHandler.reloadConfig("MCP Connections refreshed");

        // Refresh @mention dropdown submenu items for MCP providers
        const mcpManager = MCPManagerSingleton.getInstance();
        const mcpProviderNames = Array.from(mcpManager.connections.keys()).map(
          (mcpId) => `mcp-${mcpId}`,
        );

        if (mcpProviderNames.length > 0) {
          this.messenger.send("refreshSubmenuItems", {
            providers: mcpProviderNames,
          });
        }
      };

      this.configHandler.onConfigUpdate((result) => {
        void (async () => {
          const serializedResult =
            await this.configHandler.getSerializedConfig();
          this.messenger.send("configUpdate", {
            result: serializedResult,
            profileId:
              this.configHandler.currentProfile?.profileDescription.id || null,
            profiles: this.configHandler.getSerializedProfiles(),
          });

          // update additional submenu context providers registered via VSCode API
          const additionalProviders =
            this.configHandler.getAdditionalSubmenuContextProviders();
          if (additionalProviders.length > 0) {
            this.messenger.send("refreshSubmenuItems", {
              providers: additionalProviders,
            });
          }
        })();
      });


      const getLlm = async () => {
        const { config } = await this.configHandler.loadConfig();
        if (!config) {
          return undefined;
        }
        return (
          config.selectedModelByRole.autocomplete ??
          config.selectedModelByRole.chat ??
          config.selectedModelByRole.edit ??
          config.selectedModelByRole.apply ??
          config.selectedModelByRole.subagent ??
          Object.values(config.selectedModelByRole).find(Boolean) ??
          Object.values(config.modelsByRole).flat().find(Boolean) ??
          undefined
        );
      };
      this.completionProvider = new CompletionProvider(
        this.configHandler,
        getLlm,
        () => { },
      );

      this.registerMessageHandlers();
    } catch (error) {
      Logger.error(error);
      throw error; // Re-throw to prevent partially initialized core
    }
  }

  /* eslint-disable max-lines-per-function */
  private registerMessageHandlers() {
    const on = this.messenger.on.bind(this.messenger);

    // Note, VsCode's in-process messenger doesn't do anything with this
    this.messenger.onError((message, err) => {
      void this.ide.showToast("error", err.message);
    });

    on("abort", (msg) => {
      this.abortById(msg.data ?? msg.messageId);
    });

    on("ping", (msg) => {
      if (msg.data !== "ping") {
        throw new Error("ping message incorrect");
      }
      return "pong";
    });

    // History
    on("history/list", async (msg) => {
      const localSessions = historyManager.list(msg.data);

      const allSessions = [...localSessions].sort(
        (a, b) =>
          new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime(),
      );

      // Apply limit if specified
      const limit = msg.data?.limit ?? 100;
      return allSessions.slice(0, limit);
    });

    on("history/delete", (msg) => {
      historyManager.delete(msg.data.id);
    });

    on("history/load", (msg) => {
      return historyManager.load(msg.data.id);
    });


    on("history/save", (msg) => {
      historyManager.save(msg.data);
    });

    on("history/share", async (msg) => {
      const session = historyManager.load(msg.data.id);
      const outputDir = msg.data.outputDir;
      const history = session.history.map((msg) => msg.message);
      await shareSession(this.ide, history, outputDir);
    });

    on("history/clear", (msg) => {
      historyManager.clearAll();
    });


    on("config/addModel", async (msg) => {
      addModel(msg.data.model, {
        role: msg.data.role,
        roles: msg.data.roles,
        profileId: this.configHandler.currentProfile?.profileDescription.id,
      });
      await this.configHandler.reloadConfig(
        "Model added (config/addModel message)",
      );
    });

    on("config/addMcpServer", async (msg) => {
      addMcpServer(msg.data);
      await this.configHandler.reloadConfig(
        "MCP server added (config/addMcpServer message)",
      );
    });

    on("config/updateMcpServer", async (msg) => {
      updateMcpServer(msg.data.originalName, msg.data.server);
      await this.configHandler.reloadConfig(
        "MCP server updated (config/updateMcpServer message)",
      );
    });

    on("config/updateModel", async (msg) => {
      updateModel(msg.data.title, msg.data.model);
      await this.configHandler.reloadConfig(
        "Model updated (config/updateModel message)",
      );
    });

    on("config/addRule", async (msg) => {
      addGuiRule({
        name: msg.data.name,
        rule: msg.data.content,
        description: msg.data.description,
        globs: msg.data.globs,
        regex: msg.data.regex,
        alwaysApply: msg.data.alwaysApply,
        invokable: msg.data.invokable,
      });
      await this.configHandler.reloadConfig(
        "Rule added (config/addRule message)",
      );
    });

    on("config/updateRule", async (msg) => {
      updateGuiRule(msg.data.ruleId, {
        name: msg.data.name,
        rule: msg.data.content,
        description: msg.data.description,
        globs: msg.data.globs,
        regex: msg.data.regex,
        alwaysApply: msg.data.alwaysApply,
        invokable: msg.data.invokable,
      });
      await this.configHandler.reloadConfig(
        "Rule updated (config/updateRule message)",
      );
    });

    on("config/deleteModel", async (msg) => {
      deleteModel(msg.data.title);
      await this.configHandler.reloadConfig(
        "Model removed (config/deleteModel message)",
      );
    });

    on("config/addPrompt", async (msg) => {
      addGuiPrompt({
        name: msg.data.name,
        prompt: msg.data.prompt,
        description: msg.data.description,
      });
      await this.configHandler.reloadConfig(
        "Prompt added (config/addPrompt message)",
      );
    });

    on("config/updatePrompt", async (msg) => {
      updateGuiPrompt(msg.data.promptId, {
        name: msg.data.name,
        prompt: msg.data.prompt,
        description: msg.data.description,
      });
      await this.configHandler.reloadConfig(
        "Prompt updated (config/updatePrompt message)",
      );
    });

    on("config/deletePrompt", async (msg) => {
      deleteGuiPrompt(msg.data.promptId);
      await this.configHandler.reloadConfig(
        "Prompt removed (config/deletePrompt message)",
      );
    });

    on("config/listSkills", async () => {
      const { skills } = await loadMarkdownSkills(this.ide);
      const workspaceDirs = await this.ide.getWorkspaceDirs();
      return skills.map((skill) => {
        const inWorkspace = skill.sourceFile
          ? workspaceDirs.some((dir) => skill.sourceFile!.startsWith(dir))
          : false;
        return {
          name: skill.name,
          description: skill.description,
          sourceFile: skill.sourceFile,
          displayPath: skill.path,
          scope: inWorkspace ? ("workspace" as const) : ("global" as const),
        };
      });
    });

    on("config/deleteMcpServer", async (msg) => {
      deleteMcpServer(msg.data.name);
      await this.configHandler.reloadConfig(
        "MCP server removed (config/deleteMcpServer message)",
      );
    });

    on("config/deleteRule", async (msg) => {
      deleteGuiRule(msg.data.ruleId);
      await this.configHandler.reloadConfig(
        "Rule removed (config/deleteRule message)",
      );
    });

    on("config/openProfile", async (msg) => {
      await this.configHandler.openConfigProfile(
        msg.data.profileId,
        msg.data.element,
      );
    });

    on("config/ideSettingsUpdate", async (msg) => {
      await this.configHandler.updateIdeSettings(msg.data);
    });

    on("config/refreshProfiles", async (msg) => {
      // User force reloading will retrigger colocated rules
      const codebaseRulesCache = CodebaseRulesCache.getInstance();
      await codebaseRulesCache.refresh(this.ide);

      const { selectProfileId, reason } = msg.data ?? {};
      await this.configHandler.refreshAll(reason);
      if (selectProfileId) {
        await this.configHandler.setSelectedProfileId(selectProfileId);
      }
    });

    on("config/updateSharedConfig", async (msg) => {
      const newSharedConfig = this.globalContext.updateSharedConfig(msg.data);
      await this.configHandler.reloadConfig(
        "Shared config update (config/updateSharedConfig message)",
      );
      return newSharedConfig;
    });

    on("config/updateSelectedModel", async (msg) => {
      const newSelectedModels = this.globalContext.updateSelectedModel(
        msg.data.profileId,
        msg.data.role,
        msg.data.title,
      );
      await this.configHandler.reloadConfig(
        "Selected model update (config/updateSelectedModel message)",
      );
      return newSelectedModels;
    });


    on("mcp/reloadServer", async (msg) => {
      await MCPManagerSingleton.getInstance().refreshConnection(msg.data.id);
    });
    on("mcp/setServerEnabled", async (msg) => {
      const { id, enabled } = msg.data;
      await MCPManagerSingleton.getInstance().setEnabled(id, enabled);
    });
    on("mcp/getPrompt", async (msg) => {
      const { serverName, promptName, args } = msg.data;
      const prompt = await MCPManagerSingleton.getInstance().getPrompt(
        serverName,
        promptName,
        args,
      );
      const stringifiedPrompt = stringifyMcpPrompt(prompt);
      return {
        prompt: stringifiedPrompt,
        description: prompt.description,
      };
    });


    on("context/loadSubmenuItems", async (msg) => {
      await this.configHandler.isInitialized;
      const { config } = await this.configHandler.loadConfig();
      if (!config) {
        return [];
      }

      const { title } = msg.data;
      const provider = config.contextProviders?.find(
        (p) => p.description.title === title,
      );

      if (!provider) {
        return [];
      }

      try {
        return await provider.loadSubmenuItems({
          config,
          ide: this.ide,
          fetch: fetchwithRequestOptions,
        });
      } catch (e) {
        Logger.debug(`Error loading submenu items for ${title}: ${e}`);
        return [];
      }
    });

    on("context/getContextItems", async (msg) => {
      const { name, query, fullInput, selectedCode } = msg.data;
      const { config } = await this.configHandler.loadConfig();
      if (!config) {
        return [];
      }

      const provider = config.contextProviders?.find(
        (p) => p.description.title === name,
      );

      if (!provider) {
        return [];
      }

      const llm =
        config.selectedModelByRole.chat ?? config.modelsByRole.chat?.[0];
      if (!llm) {
        Logger.debug(
          `No chat model available for context provider "${name}"`,
        );
        return [];
      }

      try {
        const items = await provider.getContextItems(query, {
          ide: this.ide,
          config,
          fullInput,
          selectedCode,
          embeddingsProvider: config.selectedModelByRole.embed,
          llm: llm,
          reranker: config.selectedModelByRole.rerank,
          fetch: fetchwithRequestOptions,
          isInAgentMode: msg.data.isInAgentMode,
        });
        return items.map((item) => ({
          ...item,
          id: {
            providerTitle: name,
            itemId: uuidv4(),
          },
        }));
      } catch (e) {
        Logger.error(`Error getting context items for ${name}: ${e}`);
        return [];
      }
    });

    on("context/getSymbolsForFiles", async (msg) => {
      const { uris } = msg.data;
      return await getSymbolsForManyFiles(uris, this.ide);
    });

    on("config/getSerializedProfileInfo", async (msg) => {
      return {
        result: await this.configHandler.getSerializedConfig(),
        profileId:
          this.configHandler.currentProfile?.profileDescription.id ?? null,
        profiles: this.configHandler.getSerializedProfiles(),
      };
    });

    on("llm/streamChat", (msg) => {
      const abortController = this.addMessageAbortController(msg.messageId);
      return llmStreamChat(
        this.configHandler,
        abortController,
        msg,
        this.ide,
        this.messenger,
      );
    });

    on("llm/complete", async (msg) => {
      const { config } = await this.configHandler.loadConfig();
      const model = config?.selectedModelByRole.chat;
      if (!model) {
        throw new Error("No chat model selected");
      }
      const abortController = this.addMessageAbortController(msg.messageId);

      const completion = await model.complete(
        msg.data.prompt,
        abortController.signal,
        msg.data.completionOptions,
      );
      return completion;
    });
    on("llm/listModels", this.handleListModels.bind(this));

    on("llm/compileChat", async (msg) => {
      const { messages, options } = msg.data;
      const model = (await this.configHandler.loadConfig()).config
        ?.selectedModelByRole.chat;

      if (!model) {
        throw new Error("No chat model selected");
      }

      return model.compileChatMessages(messages, options);
    });

    // Provide messenger to utils so they can interact with GUI + state
    TTS.messenger = this.messenger;
    ChatDescriber.messenger = this.messenger;

    on("tts/kill", async () => {
      void TTS.kill();
    });

    on("chatDescriber/describe", async (msg) => {
      const currentModel = (await this.configHandler.loadConfig()).config
        ?.selectedModelByRole.chat;

      if (!currentModel) {
        throw new Error("No chat model selected");
      }

      return await ChatDescriber.describe(currentModel, {}, msg.data.text);
    });

    on("conversation/compact", async (msg) => {
      const currentModel = (await this.configHandler.loadConfig()).config
        ?.selectedModelByRole.chat;

      if (!currentModel) {
        throw new Error("No chat model selected");
      }

      try {
        await compactConversation({
          sessionId: msg.data.sessionId,
          index: msg.data.index,
          historyManager,
          currentModel,
        });
        return undefined;
      } catch (error) {
        Logger.error(`Error compacting conversation: ${error}`);
        return undefined;
      }
    });

    // Autocomplete
    on("autocomplete/complete", async (msg) => {
      const outcome =
        await this.completionProvider.provideLightweightInlineCompletionItems(
          msg.data,
          undefined,
        );
      return outcome ? [outcome.completion] : [];
    });
    on("autocomplete/accept", async (msg) => {
      this.completionProvider.accept(msg.data.completionId);
    });
    on("autocomplete/cancel", async (msg) => {
      this.completionProvider.cancel();
    });

    on("streamDiffLines", async (msg) => {
      const { config } = await this.configHandler.loadConfig();
      if (!config) {
        throw new Error("Failed to load config");
      }

      const { data } = msg;

      // Title can be an edit, chat, or apply model
      // Fall back to chat
      const llm =
        config.modelsByRole.edit.find((m) => m.title === data.modelTitle) ??
        config.modelsByRole.apply.find((m) => m.title === data.modelTitle) ??
        config.modelsByRole.chat.find((m) => m.title === data.modelTitle) ??
        config.selectedModelByRole.chat;

      if (!llm) {
        throw new Error("No model selected");
      }

      const abortManager = ApplyAbortManager.getInstance();
      const abortController = abortManager.get(
        data.fileUri ?? "current-file-stream",
      ); // not super important since currently cancelling apply will cancel all streams it's one file at a time

      return streamDiffLines(
        data,
        llm,
        abortController,
        undefined,
        data.includeRulesInSystemMessage ? config.rules : undefined,
      );
    });

    on("getDiffLines", (msg) => {
      return myersDiff(msg.data.oldContent, msg.data.newContent);
    });

    on("cancelApply", async (msg) => {
      const abortManager = ApplyAbortManager.getInstance();
      abortManager.clear(); // for now abort all streams
    });


    on("addAutocompleteModel", this.handleAddAutocompleteModel.bind(this));


    on("files/changed", this.handleFilesChanged.bind(this));
    const refreshIfNotIgnored = async (uris: string[]) => {
      const toRefresh: string[] = [];
      for (const uri of uris) {
        const ignore = await shouldIgnore(uri, this.ide);
        if (!ignore) {
          toRefresh.push(uri);
        }
      }
      if (toRefresh.length > 0) {
        this.messenger.send("refreshSubmenuItems", {
          providers: ["file"],
        });
      }
    };

    on("files/created", async ({ data }) => {
      if (!data?.uris?.length) {
        return;
      }

      walkDirCache.invalidate();
      void refreshIfNotIgnored(data.uris);

      const colocatedRulesUris = data.uris.filter(isColocatedRulesFile);
      const nonColocatedRuleUris = data.uris.filter(
        (uri) => !isColocatedRulesFile(uri),
      );
      if (colocatedRulesUris) {
        const rulesCache = CodebaseRulesCache.getInstance();
        void Promise.all(
          colocatedRulesUris.map((uri) => rulesCache.update(this.ide, uri)),
        ).then(() => {
          void this.configHandler.reloadConfig("Codebase rule file created");
        });
      }

      if (nonColocatedRuleUris.some(isAgentConfigRelatedUri)) {
        await this.configHandler.reloadConfig(
          ".agent config-related file created",
        );
      }
    });

    on("files/deleted", async ({ data }) => {
      if (!data?.uris?.length) {
        return;
      }

      walkDirCache.invalidate();
      void refreshIfNotIgnored(data.uris);

      const colocatedRulesUris = data.uris.filter(isColocatedRulesFile);
      const nonColocatedRuleUris = data.uris.filter(
        (uri) => !isColocatedRulesFile(uri),
      );

      if (colocatedRulesUris) {
        const rulesCache = CodebaseRulesCache.getInstance();
        void Promise.all(
          colocatedRulesUris.map((uri) => rulesCache.remove(uri)),
        ).then(() => {
          void this.configHandler.reloadConfig("Codebase rule file deleted");
        });
      }

      // If it's a local config being deleted, we want to reload all configs so it disappears from the list
      if (nonColocatedRuleUris.some(isAgentConfigRelatedUri)) {
        await this.configHandler.reloadConfig(
          ".agent config-related file deleted",
        );
      }
    });

    on("files/closed", async ({ data }) => {
      try {
        const fileUris = await this.ide.getOpenFiles();
        if (fileUris) {
          const filepaths = fileUris.map((uri) => uri.toString());

          if (!prevFilepaths.filepaths.length) {
            prevFilepaths.filepaths = filepaths;
          }

          // If there is a removal, including if the number of tabs is the same (which can happen with temp tabs)
          if (filepaths.length <= prevFilepaths.filepaths.length) {
            // Remove files from cache that are no longer open (i.e. in the cache but not in the list of opened tabs)
            for (const [key, _] of openedFilesLruCache.entriesDescending()) {
              if (!filepaths.includes(key)) {
                openedFilesLruCache.delete(key);
              }
            }
          }
          prevFilepaths.filepaths = filepaths;
        }
      } catch (e) {
        Logger.error(
          `didChangeVisibleTextEditors: failed to update openedFilesLruCache`,
        );
      }

      if (data.uris) {
        this.messenger.send("didCloseFiles", {
          uris: data.uris,
        });
      }
    });

    on("files/opened", async ({ data: { uris } }) => {
      if (uris) {
        for (const filepath of uris) {
          try {
            const ignore = await shouldIgnore(filepath, this.ide);
            if (!ignore) {
              // Set the active file as most recently used (need to force recency update by deleting and re-adding)
              if (openedFilesLruCache.has(filepath)) {
                openedFilesLruCache.delete(filepath);
              }
              openedFilesLruCache.set(filepath, filepath);
            }
          } catch (e) {
            Logger.error(
              `files/opened: failed to update openedFiles cache for ${filepath}`,
            );
          }
        }
      }
    });

    on("didChangeSelectedProfile", async (msg) => {
      if (msg.data.id) {
        await this.configHandler.setSelectedProfileId(msg.data.id);
      }
    });


    on("tools/call", async ({ data: { toolCall } }) =>
      this.handleToolCall(toolCall),
    );

    on(
      "tools/evaluatePolicy",
      async ({ data: { toolName, basePolicy, parsedArgs, processedArgs } }) => {
        const { config } = await this.configHandler.loadConfig();
        if (!config) {
          throw new Error("Config not loaded");
        }

        const tool = config.tools.find((t) => t.function.name === toolName);
        if (!tool) {
          return { policy: basePolicy };
        }

        // Extract display value for specific tools
        let displayValue: string | undefined;
        if (toolName === "runTerminalCommand" && parsedArgs.command) {
          displayValue = parsedArgs.command as string;
        }

        if (tool.evaluateToolCallPolicy) {
          const evaluatedPolicy = tool.evaluateToolCallPolicy(
            basePolicy,
            parsedArgs,
            processedArgs,
          );
          return { policy: evaluatedPolicy, displayValue };
        }
        return { policy: basePolicy, displayValue };
      },
    );

    on("tools/preprocessArgs", async ({ data: { toolName, args } }) => {
      const { config } = await this.configHandler.loadConfig();
      if (!config) {
        throw new Error("Config not loaded");
      }

      const tool = config?.tools.find((t) => t.function.name === toolName);
      if (!tool) {
        throw new Error(`Tool ${toolName} not found`);
      }

      try {
        const preprocessedArgs = await tool.preprocessArgs?.(args, {
          ide: this.ide,
        });
        return {
          preprocessedArgs,
        };
      } catch (e) {
        let errorReason =
          e instanceof AgentError ? e.reason : AgentErrorReason.Unknown;
        let errorMessage =
          e instanceof Error
            ? e.message
            : `Error preprocessing tool call args for ${toolName}\n${JSON.stringify(args)}`;
        return {
          preprocessedArgs: undefined,
          errorReason,
          errorMessage,
        };
      }
    });

    on("isItemTooBig", async ({ data: { item } }) => {
      return this.isItemTooBig(item);
    });

    // Process state handlers
    on("process/markAsBackgrounded", async ({ data: { toolCallId } }) => {
      markProcessAsBackgrounded(toolCallId);
    });

    on(
      "process/isBackgrounded",
      async ({ data: { toolCallId }, messageId }) => {
        const isBackgrounded = isProcessBackgrounded(toolCallId);
        return isBackgrounded; // Return true to indicate the message was handled successfully
      },
    );

    on("process/killTerminalProcess", async ({ data: { toolCallId } }) => {
      await killTerminalProcess(toolCallId);
    });

  }

  private async handleToolCall(toolCall: ToolCall) {
    const { config } = await this.configHandler.loadConfig();
    if (!config) {
      throw new Error("Config not loaded");
    }

    const tool = config.tools.find(
      (t) => t.function.name === toolCall.function.name,
    );

    if (!tool) {
      throw new Error(`Tool ${toolCall.function.name} not found`);
    }

    if (!config.selectedModelByRole.chat) {
      throw new Error("No chat model selected");
    }

    // Define a callback for streaming output updates
    const onPartialOutput = (params: {
      toolCallId: string;
      contextItems: ContextItem[];
    }) => {
      this.messenger.send("toolCallPartialOutput", params);
    };

    const result = await callTool(tool, toolCall, {
      config,
      ide: this.ide,
      llm: config.selectedModelByRole.chat,
      fetch: (url, init) =>
        fetchwithRequestOptions(url, init, config.requestOptions),
      tool,
      toolCallId: toolCall.id,
      onPartialOutput,
    });

    return result;
  }

  private async isItemTooBig(item: ContextItemWithId) {
    const { config } = await this.configHandler.loadConfig();
    if (!config) {
      return false;
    }

    const llm = config?.selectedModelByRole.chat;
    if (!llm) {
      throw new Error("No chat model selected");
    }

    const tokens = countTokens(item.content, llm.model);

    // Only block if it's truly massive (e.g. > 250k tokens)
    // Most modern models handle truncation gracefully, and we want to avoid "diverting" the user.
    if (tokens > 250_000) {
      return true;
    }

    return false;
  }

  private handleAddAutocompleteModel(
    msg: Message<{
      model: ModelDescription;
    }>,
  ) {
    const model = msg.data.model;
    addModel(model, { roles: ["autocomplete"] });
    void this.configHandler.reloadConfig("Autocomplete model added");
  }

  private async handleFilesChanged({
    data,
  }: Message<{
    uris?: string[];
  }>): Promise<void> {
    if (data?.uris?.length) {
      GitDiffCache.invalidateAll();
      const currentProfileUri =
        this.configHandler.currentProfile?.profileDescription.uri ?? "";
      const hasWorkspaceFileChange = data.uris.some(
        (uri) => !URI.equal(uri, currentProfileUri),
      );
      if (hasWorkspaceFileChange) {
        walkDirCache.invalidate();
      }
      for (const uri of data.uris) {
        if (URI.equal(uri, currentProfileUri)) {
          // Trigger a toast notification to provide UI feedback that config has been updated
          const showToast =
            this.globalContext.get("showConfigUpdateToast") ?? true;
          if (showToast) {
            const selection = await this.ide.showToast(
              "info",
              "Config updated",
              "Don't show again",
            );
            if (selection === "Don't show again") {
              this.globalContext.update("showConfigUpdateToast", false);
            }
          }
          await this.configHandler.reloadConfig(
            "Profile configuration updated",
          );
          continue;
        }
        if (isColocatedRulesFile(uri)) {
          try {
            const codebaseRulesCache = CodebaseRulesCache.getInstance();
            void codebaseRulesCache.update(this.ide, uri).then(() => {
              void this.configHandler.reloadConfig("Codebase rule update");
            });
          } catch (e) {
            Logger.error(`Failed to update codebase rule: ${e}`);
          }
        } else if (isAgentConfigRelatedUri(uri)) {
          await this.configHandler.reloadConfig(
            "Local config-related file updated",
          );
        } else if (
          uri.endsWith(".agentignore") ||
          uri.endsWith(".gitignore")
        ) {
          walkDirCache.invalidate();
        } else {
          const ignore = await shouldIgnore(uri, this.ide);
          if (!ignore) {
            this.messenger.send("refreshSubmenuItems", {
              providers: ["file"],
            });
          }
        }
      }
    }
  }

  private async handleListModels(msg: Message<{ title: string }>) {
    const { config } = await this.configHandler.loadConfig();
    if (!config) {
      return [];
    }

    const model =
      config.modelsByRole.chat.find(
        (model) => model.title === msg.data.title,
      ) ??
      config.modelsByRole.chat.find((model) =>
        model.title?.startsWith(msg.data.title),
      );

    try {
      if (model) {
        return await model.listModels();
      } else {
        if (msg.data.title === "Ollama") {
          const models = await new Ollama({ model: "" }).listModels();
          return models;
        } else if (msg.data.title === "Lemonade") {
          const models = await new Lemonade({ model: "" }).listModels();
          return models;
        } else {
          return undefined;
        }
      }
    } catch (e) {
      console.debug(`Error listing Ollama models: ${e}`);
      return undefined;
    }
  }


}
