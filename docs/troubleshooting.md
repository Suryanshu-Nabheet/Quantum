# Troubleshooting

## Agent cannot load settings or has no model

Open **Settings → Models** and confirm a provider and chat model are configured. Check the provider's endpoint, model ID, credentials, and whether its server is reachable. For a local server, start it before connecting. Reload the window after fixing configuration. If the Agent runtime has stopped, restart Quantum; if it persists, inspect the application logs and include the relevant error in a bug report without sharing secrets.

## A model cannot use a tool

Check that Agent mode is selected, the tool is enabled, and the provider/model supports tool calling. Review access and terminal settings and any approval request. Model support and endpoint compatibility vary; a configured custom endpoint must implement the tool protocol expected by its model.

## Web search fails

Web search uses Exa's anonymous service. Network failures, service errors, and rate limits can prevent a search; a successful earlier request does not guarantee later availability. Check connectivity and retry later if appropriate. The Agent should distinguish unavailable search from an empty set of results.

## Context window or autocomplete looks wrong

Check the selected model and its provider's documented context limit. For a custom provider, set the context window explicitly if needed. Configure an autocomplete model and enable autocomplete in Settings. Model capabilities and actual server limits govern what works.

## Browser context is missing

Open the page in Quantum's browser, confirm it is shared with the Agent, and attach the page or selected element again. Browser tool policies and page restrictions can limit interaction.

## Source build or launch fails

Check Node against [`.nvmrc`](../.nvmrc), install the platform prerequisites, and follow the [development guide](development.md). If generated output is missing, run setup again. For a persistent issue, record the command and error, operating system, and Quantum version. Remove API keys, tokens, private paths, and sensitive prompt content before sharing logs.
