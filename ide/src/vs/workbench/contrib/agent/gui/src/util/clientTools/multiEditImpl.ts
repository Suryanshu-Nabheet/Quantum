import { validateMultiEdit } from "core/edit/searchAndReplace/multiEditValidation";
import { executeMultiFindAndReplace } from "core/edit/searchAndReplace/performReplace";
import { validateSearchAndReplaceFilepath } from "core/edit/searchAndReplace/validateArgs";
import { v4 as uuid } from "uuid";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import {
  driverOwnsToolBatch,
  enqueueFileEdit,
  waitForFileEditToSettle,
} from "../../redux/util";
import { ClientToolImpl } from "./callClientTool";

export const multiEditImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const { edits } = validateMultiEdit(args);

  return enqueueFileEdit(async () => {
    const fileUri = await validateSearchAndReplaceFilepath(
      args.filepath,
      extras.ideMessenger.ide,
    );
    const editingFileContents = await extras.ideMessenger.ide.readFile(fileUri);
    const newFileContents = executeMultiFindAndReplace(
      editingFileContents,
      edits,
    );

    const streamId = uuid();
    void extras.dispatch(
      applyForEditTool({
        streamId,
        toolCallId,
        text: newFileContents,
        filepath: fileUri,
        isSearchAndReplace: true,
      }),
    );
    if (driverOwnsToolBatch()) {
      await waitForFileEditToSettle(extras.getState, toolCallId);
    }

    return {
      respondImmediately: false,
      output: undefined,
    };
  });
};
