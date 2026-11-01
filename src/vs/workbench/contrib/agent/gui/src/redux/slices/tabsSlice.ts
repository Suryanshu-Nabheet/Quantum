import { PayloadAction, createSlice } from "@reduxjs/toolkit";

/**
 * Session tabs are a pure view over the set of open session ids.
 * Each open session appears at most once, keyed by its id, so tabs cannot be
 * duplicated by repeated new-session or session-change events.
 */
export interface TabsState {
  openSessionIds: string[];
  activeSessionId: string | undefined;
}

export const INITIAL_TABS_STATE: TabsState = {
  openSessionIds: [],
  activeSessionId: undefined,
};

export const tabsSlice = createSlice({
  name: "tabs",
  initialState: INITIAL_TABS_STATE,
  reducers: {
    openSession: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      if (!state.openSessionIds.includes(id)) {
        state.openSessionIds.push(id);
      }
      state.activeSessionId = id;
    },
    setActiveSession: (state, action: PayloadAction<string>) => {
      if (state.openSessionIds.includes(action.payload)) {
        state.activeSessionId = action.payload;
      }
    },
    closeSession: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      const index = state.openSessionIds.indexOf(id);
      if (index === -1) return;

      state.openSessionIds.splice(index, 1);
      if (state.activeSessionId === id) {
        // Activate the neighbour that took the closed tab's place.
        state.activeSessionId =
          state.openSessionIds[Math.min(index, state.openSessionIds.length - 1)];
      }
    },
    /** Drop open ids whose session no longer exists on disk. */
    pruneSessions: (state, action: PayloadAction<string[]>) => {
      const existing = new Set(action.payload);
      state.openSessionIds = state.openSessionIds.filter((id) =>
        existing.has(id),
      );
      if (
        state.activeSessionId &&
        !state.openSessionIds.includes(state.activeSessionId)
      ) {
        state.activeSessionId = state.openSessionIds[0];
      }
    },
  },
});

export const { openSession, setActiveSession, closeSession, pruneSessions } =
  tabsSlice.actions;

export default tabsSlice.reducer;
