import { configureStore } from "@reduxjs/toolkit";
import { act, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";
import configReducer, {
  EMPTY_CONFIG,
  updateConfig,
} from "../../redux/slices/configSlice";
import sessionReducer, {
  setContextUsage,
  submitEditorAndInitAtIndex,
} from "../../redux/slices/sessionSlice";
import ContextStatus from "./ContextStatus";

// Match the component's `toLocaleString()` grouping instead of hard-coding
// separators, so the label is asserted identically under any machine locale
// (e.g. en-IN renders 1,000,000 as "10,00,000").
const tokensLoadedPattern = (loaded: number, contextLength: number) =>
  new RegExp(`${loaded.toLocaleString()} of ${contextLength.toLocaleString()} tokens loaded`);

describe("ContextStatus", () => {
  it("shows usage only after it is calculated for the current turn and model", () => {
    const store = configureStore({
      reducer: { config: configReducer, session: sessionReducer },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({ serializableCheck: false }),
    });
    const model = {
      title: "First",
      provider: "custom",
      underlyingProviderName: "custom",
      model: "first",
      contextLength: 1_000_000,
    };
    const select = (selected: typeof model) =>
      store.dispatch(
        updateConfig({
          ...EMPTY_CONFIG,
          selectedModelByRole: {
            ...EMPTY_CONFIG.selectedModelByRole,
            chat: selected,
          },
        }),
      );
    select(model);
    render(
      <Provider store={store}>
        <ContextStatus />
      </Provider>,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();

    act(() =>
      store.dispatch(
        setContextUsage({
          inputTokens: 8000,
          contextLength: 1_000_000,
          modelKey: JSON.stringify(["custom", "first", "First"]),
        }),
      ),
    );
    expect(
      screen.getByLabelText(tokensLoadedPattern(8_000, 1_000_000)),
    ).toBeInTheDocument();

    act(() => {
      store.dispatch(
        submitEditorAndInitAtIndex({
          index: 0,
          editorState: { type: "doc", content: [] },
        }),
      );
    });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();

    act(() =>
      store.dispatch(
        setContextUsage({
          inputTokens: 9000,
          contextLength: 1_000_000,
          modelKey: JSON.stringify(["custom", "first", "First"]),
        }),
      ),
    );
    expect(
      screen.getByLabelText(tokensLoadedPattern(9_000, 1_000_000)),
    ).toBeInTheDocument();

    act(() =>
      select({
        ...model,
        title: "Second",
        model: "second",
        contextLength: 2_000_000,
      }),
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
