/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

export type AgentPlanTaskStatus = 'pending' | 'in_progress' | 'done';

export interface IAgentPlanTask {
	readonly id: string;
	readonly text: string;
	readonly status: AgentPlanTaskStatus;
}

export interface IAgentPlanViewData {
	readonly sessionId: string;
	readonly title: string;
	readonly overview: string;
	readonly approach: string;
	readonly todos: readonly IAgentPlanTask[];
	readonly isBuilding: boolean;
}

export interface IAgentPlanEditorService {
	readonly _serviceBrand: undefined;
	openPlan(data: IAgentPlanViewData): Promise<void>;
	updatePlan(data: IAgentPlanViewData): void;
}

export const IAgentPlanEditorService = createDecorator<IAgentPlanEditorService>('agentPlanEditorService');
