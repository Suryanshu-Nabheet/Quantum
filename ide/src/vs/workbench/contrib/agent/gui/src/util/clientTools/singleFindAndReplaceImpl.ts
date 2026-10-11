import { validateSingleEdit } from "core/edit/searchAndReplace/findAndReplaceUtils";
import { executeFindAndReplace } from "core/edit/searchAndReplace/performReplace";
import { validateSearchAndReplaceFilepath } from "core/edit/searchAndReplace/validateArgs";
import { v4 as uuid } from "uuid";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import {
  driverOwnsToolBatch,
  enqueueFileEdit,
  waitForFileEditToSettle,
} from "../../redux/util";
import { ClientToolImpl } from "./callClientTool";

export const singleFindAndReplaceImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const { oldString, newString, replaceAll } = validateSingleEdit(
    args.old_string,
    args.new_string,
    args.replace_all,
  );

  return enqueueFileEdit(async () => {
    const fileUri = await validateSearchAndReplaceFilepath(
      args.filepath,
      extras.ideMessenger.ide,
    );
    const editingFileContents = await extras.ideMessenger.ide.readFile(fileUri);
    const newFileContents = executeFindAndReplace(
      editingFileContents,
      oldString,
      newString,
      replaceAll ?? false,
      0,
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
