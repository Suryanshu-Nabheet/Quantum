import { FromWebviewProtocol, ToWebviewProtocol } from "core/protocol";
import { Message } from "core/protocol/messenger";
import { IMessenger } from "core/protocol/messenger";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";

import { handleLLMError } from "./util/errorHandling";
import { QUANTUM_SETTINGS } from "./util/extensionMeta";

const WEBVIEW_REQUEST_TIMEOUT_MS = 15_000;

export class VsCodeWebviewProtocol
  implements IMessenger<FromWebviewProtocol, ToWebviewProtocol>
{
  listeners = new Map<
    keyof FromWebviewProtocol,
    ((message: Message) => any)[]
  >();

  private _webviews = new Set<vscode.Webview>();
  private _webviewListeners = new Map<vscode.Webview, vscode.Disposable>();
  private _errorHandlers: ((message: Message, error: Error) => void)[] = [];

  send(messageType: string, data: any, messageId?: string): string {
    const id = messageId ?? uuidv4();
    this._webviews.forEach((webview) => {
      webview.postMessage({
        messageType,
        data,
        messageId: id,
      });
    });
    return id;
  }

  on<T extends keyof FromWebviewProtocol>(
    messageType: T,
    handler: (
      message: Message<FromWebviewProtocol[T][0]>,
    ) => Promise<FromWebviewProtocol[T][1]> | FromWebviewProtocol[T][1],
  ): void {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, []);
    }
    this.listeners.get(messageType)?.push(handler);
  }

  get webview(): vscode.Webview | undefined {
    return this._webviews.values().next().value;
  }

  set webview(webView: vscode.Webview) {
    if (this._webviews.has(webView)) {return;}
    this._webviews.add(webView);

    const handleMessage = async (msg: Message): Promise<void> => {
      if (!("messageType" in msg) || !("messageId" in msg)) {
        throw new Error(`Invalid webview protocol msg: ${JSON.stringify(msg)}`);
      }

      const respond = (message: any) =>
        webView.postMessage({
          messageType: msg.messageType,
          data: message,
          messageId: msg.messageId,
        });

      const handlers =
        this.listeners.get(msg.messageType as keyof FromWebviewProtocol) || [];
      for (const handler of handlers) {
        try {
          const response = await handler(msg);
          // For generator types e.g. llm/streamChat
          if (
            response &&
            typeof response[Symbol.asyncIterator] === "function"
          ) {
            let next = await response.next();
            while (!next.done) {
              respond({
                done: false,
                content: next.value,
                status: "success",
              });
              next = await response.next();
            }
            respond({
              done: true,
              content: next.value,
              status: "success",
            });
          } else {
            respond({ done: true, content: response, status: "success" });
          }
        } catch (e: any) {
          if (await handleLLMError(e)) {
            // Respond without an error, so the UI doesn't show the error component
            respond({ done: true, status: "error" });
          }
          let message = e.message;
          respond({ done: true, error: message, status: "error" });

          const stringified = JSON.stringify({ msg }, null, 2);
          console.error(
            `Error handling webview message: ${stringified}\n\n${e}`,
          );

          if (
            stringified.includes("llm/streamChat") ||
            stringified.includes("chatDescriber/describe")
          ) {
            return;
          }

          if (e.cause) {
            if (e.cause.name === "ConnectTimeoutError") {
              message = `Connection timed out. Increase the timeout in config: "requestOptions": { "timeout": 10000 }`;
            } else if (e.cause.code === "ECONNREFUSED") {
              message = `Connection was refused. Check that your LLM server is running and apiBase is correct in ${QUANTUM_SETTINGS} → Models.`;
            } else {
              message = `The request failed with "${e.cause.name}": ${e.cause.message}`;
            }
          }

          for (const handler of this._errorHandlers) {
            handler(msg, e instanceof Error ? e : new Error(message));
          }
        }
      }
    };

    const listener = webView.onDidReceiveMessage(handleMessage);
    this._webviewListeners.set(webView, listener);
  }

  removeWebview(webView: vscode.Webview) {
    this._webviews.delete(webView);
    this._webviewListeners.get(webView)?.dispose();
    this._webviewListeners.delete(webView);
  }

  constructor() {}

  invoke<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    messageId?: string,
  ): FromWebviewProtocol[T][1] {
    const handlers = this.listeners.get(messageType) ?? [];
    if (handlers.length === 0) {
      return undefined as FromWebviewProtocol[T][1];
    }
    const msg: Message<FromWebviewProtocol[T][0]> = {
      messageType: messageType as string,
      data,
      messageId: messageId ?? uuidv4(),
    };
    return handlers[0](msg) as FromWebviewProtocol[T][1];
  }

  onError(handler: (message: Message, error: Error) => void): void {
    this._errorHandlers.push(handler);
  }

  public request<T extends keyof ToWebviewProtocol>(
    messageType: T,
    data: ToWebviewProtocol[T][0],
    retry: boolean = true,
  ): Promise<ToWebviewProtocol[T][1]> {
    const messageId = uuidv4();
    return new Promise(async (resolve) => {
      if (retry) {
        let i = 0;
        while (!this.webview) {
          if (i >= 10) {
            resolve(undefined);
            return;
          } else {
            await new Promise((res) => setTimeout(res, i >= 5 ? 1000 : 500));
            i++;
          }
        }
      }

      const targetWebview = this.webview;
      if (targetWebview) {
        let settled = false;
        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            disposable.dispose();
            resolve(undefined);
          }
        }, WEBVIEW_REQUEST_TIMEOUT_MS);
        const disposable = targetWebview.onDidReceiveMessage(
          (msg: Message<ToWebviewProtocol[T][1]>) => {
            if (!settled && msg.messageId === messageId) {
              settled = true;
              clearTimeout(timeout);
              resolve(msg.data);
              disposable.dispose();
            }
          },
        );
        targetWebview.postMessage({
          messageType,
          data,
          messageId,
        });
      } else if (!retry) {
        resolve(undefined);
      }
    });
  }
}
