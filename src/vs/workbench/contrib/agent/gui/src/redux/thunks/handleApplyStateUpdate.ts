import { createAsyncThunk } from "@reduxjs/toolkit";
import { ApplyState, ApplyToFilePayload } from "core";
import { EDIT_MODE_STREAM_ID } from "core/edit/constants";
import {
  selectApplyStateByToolCallId,
  selectToolCallById,
} from "../selectors/selectToolCalls";
import { updateEditStateApplyState } from "../slices/editState";
import {
  acceptToolCall,
  errorToolCall,
  updateApplyState,
  updateToolCallOutput,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { driverOwnsToolBatch, findToolCallById, logToolUsage } from "../util";
import { appendToolResultMessage } from "../util/toolResultMessages";
import { exitEdit } from "./edit";
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";

export const handleApplyStateUpdate = createAsyncThunk<
  void,
  ApplyState,
  ThunkApiType
>(
  "apply/handleStateUpdate",
  async (applyState, { dispatch, getState, extra }) => {
    if (applyState.streamId === EDIT_MODE_STREAM_ID) {
      dispatch(updateEditStateApplyState(applyState));

      if (applyState.status === "closed") {
        const toolCallState = findToolCallById(
          getState().session.history,
          applyState.toolCallId!,
        );
        if (toolCallState) {
          logToolUsage(toolCallState, true, true, extra.hostBridge);
        }
        void dispatch(exitEdit({}));
      }
    } else {
      // chat or agent
      dispatch(updateApplyState(applyState));

      // Handle apply status updates - use toolCallId from event payload
      if (applyState.toolCallId) {
        const toolCallState = findToolCallById(
          getState().session.history,
          applyState.toolCallId,
        );

        // Write the edit and continue. The user reviews the saved files after
        // the turn, instead of accepting each file before the next one starts.
        if (applyState.status === "done" && toolCallState) {
          extra.hostBridge.post("acceptDiff", {
            streamId: applyState.streamId,
            filepath: applyState.filepath,
          });
        }

        if (applyState.status === "closed") {
          if (toolCallState) {
            // Accepting the diff already continued this tool. A later review
            // click must not start another turn.
            if (toolCallState.status === "done") {
              return;
            }

            const accepted = toolCallState.status !== "canceled";

            logToolUsage(toolCallState, accepted, true, extra.hostBridge);

            if (accepted) {
              if (toolCallState.status !== "errored") {
                dispatch(
                  acceptToolCall({
                    toolCallId: applyState.toolCallId,
                  }),
                );

                // Add autoformatting diff to tool output if present
                if (applyState.autoFormattingDiff) {
                  dispatch(
                    updateToolCallOutput({
                      toolCallId: applyState.toolCallId,
                      contextItems: [
                        {
                          icon: "info",
                          name: "Auto-formatting Applied",
                          description: "Editor auto-formatting changes",
                          content: `Along with your edits, the editor applied the following auto-formatting:\n\n${applyState.autoFormattingDiff}\n\n(Note: Pay close attention to changes such as single quotes being converted to double quotes, semicolons being removed or added, long lines being broken into multiple lines, adjusting indentation style, adding/removing trailing commas, etc. This will help you ensure future SEARCH/REPLACE operations to this file are accurate.)`,
                          hidden: false,
                        },
                      ],
                    }),
                  );
                } else {
                  dispatch(
                    updateToolCallOutput({
                      toolCallId: applyState.toolCallId,
                      contextItems: [
                        {
                          name: "Edit Success",
                          content: `Successfully edited ${applyState.filepath}`,
                          description: "",
                          hidden: true,
                        },
                      ],
                    }),
                  );
                }
              } else {
                dispatch(
                  updateToolCallOutput({
                    toolCallId: applyState.toolCallId,
                    contextItems: [
                      {
                        name: "Edit Failed",
                        content: `Failed to edit ${applyState.filepath}. To keep working with the file, read it again to see the most up-to-date contents`,
                        description: "",
                        hidden: true,
                      },
                    ],
                  }),
                );
              }

              if (driverOwnsToolBatch()) {
                appendToolResultMessage(
                  dispatch,
                  getState().session.history,
                  applyState.toolCallId,
                );
              } else {
                void dispatch(
                  streamResponseAfterToolCall({
                    toolCallId: applyState.toolCallId,
                  }),
                );
              }

              const stored = getState().session.codeBlockApplyStates.states.find(
                (state) => state.streamId === applyState.streamId,
              );
              const original = stored?.originalFileContent;
              if (original !== undefined && applyState.filepath) {
                for (const prior of getState().session.codeBlockApplyStates
                  .states) {
                  if (
                    prior.filepath === applyState.filepath &&
                    prior.streamId !== applyState.streamId &&
                    prior.status === "review"
                  ) {
                    dispatch(
                      updateApplyState({
                        streamId: prior.streamId,
                        status: "closed",
                      }),
                    );
                  }
                }
                dispatch(
                  updateApplyState({
                    streamId: applyState.streamId,
                    status: "review",
                    filepath: applyState.filepath,
                    originalFileContent: original,
                    fileContent: applyState.fileContent ?? stored?.fileContent,
                  }),
                );
              }
            }
          }
        }
      }
    }
  },
);

export const applyForEditTool = createAsyncThunk<
  void,
  ApplyToFilePayload & { toolCallId: string },
  ThunkApiType
>("apply/editTool", async (payload, { dispatch, getState, extra }) => {
  const { toolCallId, streamId } = payload;
  dispatch(
    updateApplyState({
      streamId,
      toolCallId,
      status: "not-started",
    }),
  );

  let didError = false;
  try {
    const response = await extra.hostBridge.request("applyToFile", payload);
    if (response.status === "error") {
      didError = true;
    }
  } catch (e) {
    didError = true;
  }
  if (didError) {
    const state = getState();

    const toolCallState = selectToolCallById(state, toolCallId);
    const applyState = selectApplyStateByToolCallId(state, toolCallId);
    if (
      toolCallState &&
      applyState &&
      applyState.status !== "closed" &&
      toolCallState.status === "calling"
    ) {
      dispatch(
        errorToolCall({
          toolCallId,
        }),
      );
      dispatch(
        updateToolCallOutput({
          toolCallId,
          contextItems: [
            {
              icon: "problems",
              name: "Apply Error",
              description: "Failed to apply changes",
              content: `Error editing file: failed to apply changes to file.\n\nPlease try again with correct args or notify the user and request further instructions.`,
              hidden: false,
            },
          ],
        }),
      );
      void dispatch(
        handleApplyStateUpdate({
          status: "closed",
          streamId: applyState.streamId,
          toolCallId,
        }),
      );
    }
  }
});
