import { useContext, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppSelector } from "../../redux/hooks";
import { selectSelectedProfile } from "../../redux/slices/profilesSlice";
import { CONFIG_ROUTES } from "../../util/navigation";
import Alert from "../gui/Alert";

export const FatalErrorIndicator = () => {
  const configError = useAppSelector((store) => store.config.configError);
  const location = useLocation();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);
  const selectedProfile = useAppSelector(selectSelectedProfile);

  const hasFatalErrors = useMemo(() => {
    return configError?.some((error) => error.fatal);
  }, [configError]);

  const configLoading = useAppSelector((state) => state.config.loading);
  const showConfigPage = () => {
    navigate(CONFIG_ROUTES.MODELS);
  };
  const currentPath = `${location.pathname}${location.search}`;

  if (!hasFatalErrors) {
    return null;
  }

  const displayName = selectedProfile?.title ?? "config";

  return (
    <Alert type="error" className="mx-2 my-1 px-2">
      <span>{`Error loading`}</span>{" "}
      <span className="italic">{displayName}</span>
      {". "}
      <span>{`Chat is disabled until a model is available.`}</span>
      <div className="mt-2 flex flex-row flex-wrap items-center gap-x-3 gap-y-1.5">
        {configLoading ? (
          <div>Reloading...</div>
        ) : (
          <div
            className={`cursor-pointer underline`}
            onClick={() => {
              ideMessenger.post("config/refreshProfiles", undefined);
            }}
          >
            Reload
          </div>
        )}
        {currentPath !== CONFIG_ROUTES.MODELS && (
          <div onClick={showConfigPage} className="cursor-pointer underline">
            View
          </div>
        )}
      </div>
    </Alert>
  );
};
