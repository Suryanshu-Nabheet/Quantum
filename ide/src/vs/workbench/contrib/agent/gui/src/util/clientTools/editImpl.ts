import { resolveRelativePathInDir } from "core/util/ideUtils";
import { v4 as uuid } from "uuid";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import {
  driverOwnsToolBatch,
  enqueueFileEdit,
  waitForFileEditToSettle,
} from "../../redux/util";
import { ClientToolImpl } from "./callClientTool";

export const editToolImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  if (!args.filepath || !args.changes) {
    throw new Error(
      "`filepath` and `changes` arguments are required to edit an existing file.",
    );
  }
  return enqueueFileEdit(async () => {
    let filepath = args.filepath;
    if (filepath.startsWith("./")) {
      filepath = filepath.slice(2);
    }

    let firstUriMatch = await resolveRelativePathInDir(
      filepath,
      extras.ideMessenger.ide,
    );

    if (!firstUriMatch) {
      const openFiles = await extras.ideMessenger.ide.getOpenFiles();
      for (const uri of openFiles) {
        if (uri.endsWith(filepath)) {
          firstUriMatch = uri;
          break;
        }
      }
    }

    if (!firstUriMatch) {
      throw new Error(`${filepath} does not exist`);
    }
    const streamId = uuid();
    void extras.dispatch(
      applyForEditTool({
        streamId,
        text: args.changes,
        toolCallId,
        filepath: firstUriMatch,
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
