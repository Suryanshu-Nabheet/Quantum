import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setInlineErrorMessage } from "../../redux/slices/sessionSlice";
import { CONFIG_ROUTES } from "../../util/navigation";

export type InlineErrorMessageType = "out-of-context" | "max-agent-steps";

export default function InlineErrorMessage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const inlineErrorMessage = useAppSelector(
    (state) => state.session.inlineErrorMessage,
  );
  if (inlineErrorMessage === "max-agent-steps") {
    return (
      <div
        className={`border-border relative m-2 flex flex-col rounded-md border border-solid bg-transparent p-4`}
      >
        <p className={`thread-message text-error text-center`}>
          Agent paused after reaching the step limit for this turn. Send another
          message to continue the task.
        </p>
        <div className="text-description flex flex-row items-center justify-center gap-1.5 px-3">
          <span
            className="cursor-pointer text-xs hover:underline"
            onClick={() => {
              dispatch(setInlineErrorMessage(undefined));
            }}
          >
            Dismiss
          </span>
        </div>
      </div>
    );
  }
  if (inlineErrorMessage === "out-of-context") {
    return (
      <div
        className={`border-border relative m-2 flex flex-col rounded-md border border-solid bg-transparent p-4`}
      >
        <p className={`thread-message text-error text-center`}>
          {`Message exceeds context limit.`}
        </p>
        <div className="text-description flex flex-row items-center justify-center gap-1.5 px-3">
          <div
            className="cursor-pointer text-xs hover:underline"
            onClick={() => navigate(CONFIG_ROUTES.MODELS)}
          >
            <span className="xs:flex hidden">Open Settings</span>
            <span className="xs:hidden">Settings</span>
          </div>
          |
          <span
            className="cursor-pointer text-xs hover:underline"
            onClick={() => {
              dispatch(setInlineErrorMessage(undefined));
            }}
          >
            Hide
          </span>
        </div>
      </div>
    );
  }
  return null;
}
