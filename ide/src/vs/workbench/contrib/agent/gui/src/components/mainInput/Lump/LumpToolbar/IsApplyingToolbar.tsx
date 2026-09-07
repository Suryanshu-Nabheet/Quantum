import { useContext } from "react";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppDispatch } from "../../../../redux/hooks";
import { cancelStream } from "../../../../redux/thunks/cancelStream";
import { GeneratingIndicator } from "./GeneratingIndicator";

export const IsApplyingToolbar = () => {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();

  return (
    <div className="flex w-full items-center justify-between text-foreground">
      <GeneratingIndicator text="Applying" testId={"notch-applying-text"} />
      <button
        type="button"
        data-testid="notch-applying-cancel-button"
        className="text-description text-2xs cursor-pointer border-0 bg-transparent p-0.5 pr-1 hover:brightness-125"
        onClick={() => {
          // Note that this will NOT stop generation but once apply is cancelled will show the Generating/cancel option
          // Apply is prioritized because it can be more catastrophic
          // Intentional to be more WYSIWYG for now
          void dispatch(cancelStream());
          ideMessenger.post("rejectDiff", {});
        }}
      >
        Cancel
      </button>
    </div>
  );
};
