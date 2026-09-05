/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';

/** True when Quantum Agent-native mode is active (Copilot AI disabled, Agent owns the sidebar). */
export const AgentNativeModeContext = new RawContextKey<boolean>('agentNativeMode', false);

export const AGENT_ATTACH_BROWSER_CONTEXT_COMMAND = 'agent.attachBrowserContext';
export const AGENT_BROWSER_NOTIFY_SUBMIT_COMMAND = 'agent.browser.notifySubmit';
