import { useCallback, useContext, useEffect, useRef } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";

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
  setMode,
} from "../redux/slices/sessionSlice";
import { store } from "../redux/store";
import { setTTSActive } from "../redux/slices/uiSlice";

import { modelSupportsReasoning } from "core/llm/autodetect";
import { cancelStream } from "../redux/thunks/cancelStream";
import { handleApplyStateUpdate } from "../redux/thunks/handleApplyStateUpdate";
import {
  loadSession,
  refreshSessionMetadata,
} from "../redux/thunks/session";
import {
  setDocumentStylesFromTheme,
} from "../styles/theme";
import { setLocalStorage } from "../util/localStorage";
import { migrateLocalStorage } from "../util/migrateLocalStorage";
import { useWebviewListener } from "./useWebviewListener";

function ParallelListeners() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
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
                  "Failed to load Quantum Settings. Check ~/.agent/index/globalContext.json and reload.",
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
  useEffect(() => {
    async function initialLoadConfig() {
      dispatch(setConfigLoading(true));
      const result = await ideMessenger.request(
        "config/getSerializedProfileInfo",
        undefined,
      );
      if (result.status === "success") {
        await handleConfigUpdate(true, result.content);
      }
      dispatch(setConfigLoading(false));
    }
    void initialLoadConfig();
  }, [ideMessenger]);

  // Restore chat history from ~/.agent/sessions on webview boot.
  // Message history is not kept in redux-persist — only session id is —
  // so without this the History UI and chat look empty after every reload
  // even though session files were saved correctly.
  useEffect(() => {
    let cancelled = false;

    async function restoreHistory() {
      dispatch(setIsSessionMetadataLoading(true));
      try {
        await dispatch(refreshSessionMetadata({})).unwrap();
      } catch (error) {
        console.error("Failed to list saved chat sessions:", error);
        if (!cancelled) {
          dispatch(setIsSessionMetadataLoading(false));
        }
      }

      if (cancelled) {
        return;
      }

      // PersistGate has already rehydrated session.id / lastSessionId.
      // history[] itself is never persisted, so reload it from disk.
      const sessionState = store.getState().session;
      if (sessionState.history.length > 0) {
        return;
      }

      const candidateIds = [
        sessionState.id,
        sessionState.lastSessionId,
      ].filter((id): id is string => !!id);

      for (const sessionId of [...new Set(candidateIds)]) {
        try {
          await dispatch(
            loadSession({
              sessionId,
              saveCurrentSession: false,
            }),
          ).unwrap();
          return;
        } catch {
          // Try next candidate (e.g. brand-new id never written to disk).
        }
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
    dispatch(setMode("agent"));
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
