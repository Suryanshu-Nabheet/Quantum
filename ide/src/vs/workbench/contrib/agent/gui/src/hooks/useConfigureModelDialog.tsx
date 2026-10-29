import { ModelDescription } from "core";
import { LazyAddModelForm } from "../forms/LazyAddModelForm";
import { useAppDispatch } from "../redux/hooks";
import { setDialogMessage, setShowDialog } from "../redux/slices/uiSlice";

export function useConfigureModelDialog() {
  const dispatch = useAppDispatch();

  return (model: ModelDescription) => {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <LazyAddModelForm
          existingModel={model}
          formTitle="Configure provider"
          onDone={() => {
            dispatch(setShowDialog(false));
          }}
        />,
      ),
    );
  };
}
