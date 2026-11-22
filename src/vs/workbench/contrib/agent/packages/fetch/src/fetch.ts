import { RequestOptions } from "config-types";
import * as followRedirects from "follow-redirects";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { RequestInit, Response } from "node-fetch";
import { getAgentOptions } from "./getAgentOptions.js";
import patchedFetch from "./node-fetch-patch.js";
import { getProxy, shouldBypassProxy } from "./util.js";

const { http, https } = (followRedirects as any).default;

export async function fetchwithRequestOptions(
  url_: URL | string,
  init?: RequestInit,
  requestOptions?: RequestOptions,
): Promise<Response> {
  const url = typeof url_ === "string" ? new URL(url_) : url_;


  const agentOptions = await getAgentOptions(requestOptions);

  // Get proxy from options or environment variables
  const proxy = getProxy(url.protocol, requestOptions);

  // Check if should bypass proxy based on requestOptions or NO_PROXY env var
  const shouldBypass = shouldBypassProxy(url.hostname, requestOptions);

  // Create agent
  const protocol = url.protocol === "https:" ? https : http;
  const agent =
    proxy && !shouldBypass
      ? protocol === https
        ? new HttpsProxyAgent(proxy, agentOptions)
        : new HttpProxyAgent(proxy, agentOptions)
      : new protocol.Agent(agentOptions);

  let headers: { [key: string]: string } = {};

  // Handle different header formats
  if (init?.headers) {
    const headersSource = init.headers as any;

    // Check if it's a Headers-like object (OpenAI v5 HeadersList, standard Headers)
    if (headersSource && typeof headersSource.forEach === "function") {
      // Use forEach method which works reliably on Headers objects
      headersSource.forEach((value: string, key: string) => {
        headers[key] = value;
      });
    } else if (Array.isArray(headersSource)) {
      // This is an array of [key, value] tuples
      for (const [key, value] of headersSource) {
        headers[key] = value as string;
      }
    } else if (headersSource && typeof headersSource === "object") {
      // This is a plain object
      for (const [key, value] of Object.entries(headersSource)) {
        headers[key] = value as string;
      }
    }
  }

  headers = {
    ...headers,
    ...requestOptions?.headers,
  };

  // Replace localhost with 127.0.0.1


  // add extra body properties if provided
  let updatedBody: string | undefined = undefined;
  try {
    if (requestOptions?.extraBodyProperties && typeof init?.body === "string") {
      const parsedBody = JSON.parse(init.body);
      updatedBody = JSON.stringify({
        ...parsedBody,
        ...requestOptions.extraBodyProperties,
      });
    }
  } catch (e) {
    console.log("Unable to parse HTTP request body");
  }

  const finalBody = updatedBody ?? init?.body;
  const method = init?.method || "GET";

  // Verbose logging for debugging - log request details
  if (process.env.VERBOSE_FETCH) {
    console.log(`[fetch] ${method} ${url.protocol}//${url.host}`);
  }

  // fetch the request with the provided options
  try {
    const resp = await patchedFetch(url, {
      ...init,
      body: finalBody,
      headers: headers,
      agent: agent,
    });

    // Verbose logging for debugging - log response details
    if (process.env.VERBOSE_FETCH) {
      console.log(`[fetch] HTTP ${resp.status}`);
    }

    if (!resp.ok) {
      const requestId = resp.headers.get("x-request-id");
      if (requestId) {
        console.log(`Request ID: ${requestId}, Status: ${resp.status}`);
      }
    }

    return resp;
  } catch (error) {
    // Verbose logging for errors
    if (process.env.VERBOSE_FETCH) {
      console.log("[fetch] Request failed");
    }

    if (error instanceof Error && error.name === "AbortError") {
      // Return a Response object that streamResponse etc can handle
      return new Response(null, {
        status: 499, // Client Closed Request
        statusText: "Client Closed Request",
      });
    }
    throw error;
  }
}
