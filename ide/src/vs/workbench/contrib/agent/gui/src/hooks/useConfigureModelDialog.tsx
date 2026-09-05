import { ModelDescription } from "core";
import { AddModelForm } from "../forms/AddModelForm";
import { useAppDispatch } from "../redux/hooks";
import { setDialogMessage, setShowDialog } from "../redux/slices/uiSlice";

export function useConfigureModelDialog() {
  const dispatch = useAppDispatch();

  return (model: ModelDescription) => {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <AddModelForm
          existingModel={model}
          formTitle="Configure model"
          onDone={() => {
            dispatch(setShowDialog(false));
          }}
        />,
      ),
    );
  };
}
