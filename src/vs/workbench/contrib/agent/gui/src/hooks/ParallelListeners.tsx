import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { HostBridgeContext } from "../context/HostBridge";

import { FromCoreProtocol } from "core/protocol";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { setConfigLoading, setConfigResult } from "../redux/slices/configSlice";
import { setLastNonEditSessionEmpty } from "../redux/slices/editState";
import {
  initializeProfilePreferences,
  setProfiles,
  setSelectedProfile,
} from "../redux/slices/profilesSlice";
import {
  addContextItemsAtIndex,
  newSession,
  setHasReasoningEnabled,
  setIsSessionMetadataLoading,
} from "../redux/slices/sessionSlice";
import { setTTSActive } from "../redux/slices/uiSlice";

import { modelSupportsReasoning } from "core/llm/autodetect";
import { cancelStream } from "../redux/thunks/cancelStream";
import { handleApplyStateUpdate } from "../redux/thunks/handleApplyStateUpdate";
import { refreshSessionMetadata } from "../redux/thunks/session";
import {
  setDocumentStylesFromTheme,
} from "../styles/theme";
import { setLocalStorage } from "../util/localStorage";
import { migrateLocalStorage } from "../util/migrateLocalStorage";
import { useWebviewListener } from "./useWebviewListener";

function ParallelListeners() {
  const dispatch = useAppDispatch();
  const hostBridge = useContext(HostBridgeContext);
  const history = useAppSelector((store) => store.session.history);
  const isInEdit = useAppSelector((store) => store.session.isInEdit);
  const selectedProfileId = useAppSelector(
    (store) => store.profiles.selectedProfileId,
  );
  const reasoningSettings = useAppSelector(
    (store) => store.ui.reasoningSettings,
  );
  const hasDoneInitialConfigLoad = useRef(false);

  // Load symbols for chat on any session change
  const sessionId = useAppSelector((state) => state.session.id);

  const handleConfigUpdate = useCallback(
    async (isInitial: boolean, result: FromCoreProtocol["configUpdate"][0]) => {
      const {
        result: configResult,
        profileId,
        profiles,
      } = result;
      if (isInitial && hasDoneInitialConfigLoad.current) {
        return;
      }
      if (configResult.configLoadInterrupted) {
        dispatch(
          setConfigResult({
            config: undefined,
            errors: [
              {
                fatal: true,
                message:
                  "Failed to load Settings. Check ~/.agent/index/globalContext.json and reload.",
              },
            ],
            configLoadInterrupted: true,
          }),
        );
        return;
      }
      hasDoneInitialConfigLoad.current = true;
      dispatch(setSelectedProfile(profileId));
      if (profiles?.length) {
        dispatch(setProfiles(profiles));
      }
      dispatch(setConfigResult(configResult));

      const isNewProfileId = profileId && profileId !== selectedProfileId;

      if (isNewProfileId) {
        dispatch(
          initializeProfilePreferences({
            defaultSlashCommands: [],
            profileId,
          }),
        );
      }

      // Perform any actions needed with the config
      if (configResult.config?.ui?.fontSize) {
        setLocalStorage("fontSize", configResult.config.ui.fontSize);
        document.body.style.fontSize = `${configResult.config.ui.fontSize}px`;
      }

      const chatModel = configResult.config?.selectedModelByRole.chat;
      const supportsReasoning = modelSupportsReasoning(chatModel);
      const isReasoningDisabled =
        chatModel?.completionOptions?.reasoning === false;
      const wasReasoningPreviouslyEnabled = chatModel?.title
        ? reasoningSettings[chatModel.title] !== false
        : true;
      dispatch(
        setHasReasoningEnabled(
          supportsReasoning &&
            !isReasoningDisabled &&
            wasReasoningPreviouslyEnabled,
        ),
      );
    },
    [dispatch, hasDoneInitialConfigLoad, selectedProfileId, reasoningSettings],
  );

  // Load config from the IDE
  useLayoutEffect(() => {
    let cancelled = false;

    async function initialLoadConfig() {
      dispatch(setConfigLoading(true));
      try {
        const result = await hostBridge.request(
          "config/getSerializedProfileInfo",
          undefined,
        );
        if (!cancelled && result.status === "success") {
          await handleConfigUpdate(true, result.content);
        }
        if (!cancelled && result.status === "error") {
          dispatch(
            setConfigResult({
              config: undefined,
              errors: [
                {
                  fatal: true,
                  message: result.error || "Failed to load Agent settings.",
                },
              ],
              configLoadInterrupted: true,
            }),
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load Agent settings:", error);
          dispatch(
            setConfigResult({
              config: undefined,
              errors: [
                {
                  fatal: true,
                  message:
                    error instanceof Error
                      ? error.message
                      : "Failed to load Agent settings.",
                },
              ],
              configLoadInterrupted: true,
            }),
          );
        }
      } finally {
        if (!cancelled) {
          dispatch(setConfigLoading(false));
        }
      }
    }

    void initialLoadConfig();
    return () => {
      cancelled = true;
    };
  }, [hostBridge]);

  // The workbench restores the active session for the current workspace.
  // Load metadata separately for the History UI.
  useEffect(() => {
    let cancelled = false;

    async function restoreHistory() {
      dispatch(setIsSessionMetadataLoading(true));
      try {
        const refreshResult = dispatch(refreshSessionMetadata({}));
        if (
          refreshResult &&
          typeof refreshResult.unwrap === "function"
        ) {
          await refreshResult.unwrap();
        }
      } catch (error) {
        console.error("Failed to list saved chat sessions:", error);
      }

      if (!cancelled) {
        dispatch(setIsSessionMetadataLoading(false));
      }
    }

    void restoreHistory();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useWebviewListener(
    "configUpdate",
    async (update) => {
      if (!update) {
        return;
      }
      await handleConfigUpdate(false, update);
    },
    [handleConfigUpdate],
  );

  // ON LOAD
  useEffect(() => {
    // Override persisted state
    void dispatch(cancelStream());
  }, []);

  // IDE event listeners
  useWebviewListener(
    "getWebviewHistoryLength",
    async () => {
      return history.length;
    },
    [history],
  );

  useWebviewListener(
    "getCurrentSessionId",
    async () => {
      return sessionId;
    },
    [sessionId],
  );

  useWebviewListener("setInactive", async () => {
    void dispatch(cancelStream());
  });

  useWebviewListener("loadAgentSession", async (data) => {
    dispatch(newSession(data.session));
  });

  useWebviewListener("setTTSActive", async (status) => {
    dispatch(setTTSActive(status));
  });

  useWebviewListener("addContextItem", async (data) => {
    dispatch(
      addContextItemsAtIndex({
        index: data.historyIndex,
        contextItems: [data.item],
      }),
    );
  });


  useWebviewListener(
    "updateApplyState",
    async (state) => {
      void dispatch(handleApplyStateUpdate(state));
    },
    [],
  );

  useEffect(() => {
    if (!isInEdit) {
      dispatch(setLastNonEditSessionEmpty(history.length === 0));
    }
  }, [isInEdit, history]);

  useEffect(() => {
    migrateLocalStorage(dispatch);
  }, []);

  return <></>;
}

export default ParallelListeners;
