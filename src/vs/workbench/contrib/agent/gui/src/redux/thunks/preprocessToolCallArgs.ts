import { ToolCallState } from "core";
import { AgentErrorReason } from "core/util/errors";
import { IHostBridge } from "../../context/HostBridge";
import {
  errorToolCall,
  setProcessedToolCallArgs,
  updateToolCallOutput,
} from "../slices/sessionSlice";
import { AppThunkDispatch } from "../store";

export async function preprocessToolCalls(
  dispatch: AppThunkDispatch,
  hostBridge: IHostBridge,
  generatedToolCalls: ToolCallState[],
): Promise<void> {
  // Tool call pre-processing
  await Promise.all(
    generatedToolCalls.map(async (tcState) => {
      let errorReason: AgentErrorReason | undefined = undefined;
      let errorMessage: string | undefined = undefined;
      let preprocessedArgs: Record<string, unknown> | undefined = undefined;
      const result = await hostBridge.request("tools/preprocessArgs", {
        toolName: tcState.toolCall.function.name,
        args: tcState.parsedArgs,
      });
      if (result.status === "success") {
        preprocessedArgs = result.content.preprocessedArgs;
        errorMessage = result.content.errorMessage;
        errorReason = result.content.errorReason;
      } else {
        errorMessage = result.error;
        errorReason = AgentErrorReason.Unknown;
      }
      if (errorReason) {
        dispatch(
          errorToolCall({
            toolCallId: tcState.toolCallId,
          }),
        );
        dispatch(
          updateToolCallOutput({
            toolCallId: tcState.toolCallId,
            contextItems: [
              {
                icon: "problems",
                name: "Could Not Prepare Tool Call",
                description: "",
                content: `The ${tcState.toolCall.function.name} tool call was not run because its arguments could not be prepared: ${errorMessage}\n\nCorrect the arguments or choose another available tool, then continue with the task. Do not repeat the same call unchanged.`,
                hidden: false,
              },
            ],
          }),
        );
      } else if (preprocessedArgs) {
        dispatch(
          setProcessedToolCallArgs({
            toolCallId: tcState.toolCallId,
            newArgs: preprocessedArgs,
          }),
        );
      }
    }),
  );
}
