# Integrated browser

Quantum includes a browser alongside the editor. It is useful for viewing a running application, inspecting a page, and sharing selected page context with the Agent.

## Share a page or element

1. Open the browser from the workbench and navigate to the page you want to inspect.
2. Share the page with the Agent when prompted, or attach browser context from the Agent input.
3. Use the element picker to attach a specific element when you want help with a control or layout.
4. Describe the problem or desired change, including how to reproduce it.

Share only pages and content appropriate for the task. The Agent can receive the selected page context and send relevant content to the configured model provider.

## Browser tools

When browser tools are available and permitted, the Agent can list and open pages, navigate, read page content, capture screenshots, click, type, hover, drag, handle dialogs, and run browser automation code. The exact actions available depend on the page, tool policy, and sharing state. Review actions that affect accounts, forms, or external services before approving them.

The integrated browser and web search serve different purposes: browser tools interact with pages, while the Agent's web search tool discovers source links and excerpts. See [Quantum Agent](agent.md#tools-and-approvals).

If a page or element is unavailable to the Agent, verify that the page is open and shared, then attach it again. Some pages restrict automation or change their content dynamically.
