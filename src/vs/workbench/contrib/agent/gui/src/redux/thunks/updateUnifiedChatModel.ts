import { ModelRole } from "agent-config";
import { createAsyncThunk } from "@reduxjs/toolkit";
import { ProfileDescription } from "core/config/ProfileLifecycleManager";
import { updateSelectedModelByRole } from "./updateSelectedModelByRole";
import { ThunkApiType } from "../store";

const CHAT_ALIGNED_ROLES: ModelRole[] = ["chat", "edit", "apply", "subagent"];

/**
 * Sets the primary chat model and mirrors the same provider credential to
 * inline edit / apply / subagent when that title exists on those role lists.
 */
export const updateUnifiedChatModel = createAsyncThunk<
  void,
  {
    modelTitle: string;
    selectedProfile: ProfileDescription | null;
  },
  ThunkApiType
>(
  "config/updateUnifiedChatModel",
  async ({ modelTitle, selectedProfile }, { dispatch, getState }) => {
    if (!selectedProfile) {
      return;
    }
    const { modelsByRole } = getState().config.config;

    for (const role of CHAT_ALIGNED_ROLES) {
      const exists = modelsByRole[role]?.some((m) => m.title === modelTitle);
      if (!exists) {
        continue;
      }
      await dispatch(
        updateSelectedModelByRole({
          role,
          modelTitle,
          selectedProfile,
        }),
      );
    }
  },
);
