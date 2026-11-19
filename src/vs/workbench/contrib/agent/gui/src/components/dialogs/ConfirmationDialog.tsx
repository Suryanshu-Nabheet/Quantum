import { useState } from "react";
import { useDispatch } from "react-redux";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { Button } from "../ui/Button";

interface ConfirmationDialogProps {
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  text: string;
  title?: string;
  hideCancelButton?: boolean;
  confirmText?: string;
}

function ConfirmationDialog(props: ConfirmationDialogProps) {
  const dispatch = useDispatch();
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleConfirm() {
    setIsConfirming(true);
    setErrorMessage(undefined);
    try {
      await props.onConfirm();
      dispatch(setShowDialog(false));
      dispatch(setDialogMessage(undefined));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The operation failed.",
      );
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <div className="p-4 pt-0">
      <h1 className="mb-1 text-center text-xl">
        {props.title ?? "Confirmation"}
      </h1>
      <p className="text-center text-base" style={{ whiteSpace: "pre-wrap" }}>
        {props.text}
      </p>
      {errorMessage && (
        <p className="text-error mt-3 text-center text-sm" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="w/1/2 flex justify-end gap-2">
        {!!props.hideCancelButton || (
          <Button
            variant="outline"
            disabled={isConfirming}
            onClick={() => {
              dispatch(setShowDialog(false));
              dispatch(setDialogMessage(undefined));
              props.onCancel?.();
            }}
          >
            Cancel
          </Button>
        )}
        <Button
          disabled={isConfirming}
          onClick={() => void handleConfirm()}
        >
          {isConfirming ? "Working..." : (props.confirmText ?? "Confirm")}
        </Button>
      </div>
    </div>
  );
}

export default ConfirmationDialog;
