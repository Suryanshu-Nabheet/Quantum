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

describe("ContextStatus", () => {
  it("stays visible between turns and avoids reusing another model's count", () => {
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
    expect(
      screen.getByLabelText(/not yet calculated.*1,000,000/),
    ).toBeInTheDocument();

    act(() => {
      store.dispatch(
        setContextUsage({
          inputTokens: 8000,
          contextLength: 1_000_000,
          modelKey: JSON.stringify(["custom", "first", "First"]),
        }),
      );
      store.dispatch(
        submitEditorAndInitAtIndex({
          index: 0,
          editorState: { type: "doc", content: [] },
        }),
      );
    });
    expect(
      screen.getByLabelText(/8,000 of 1,000,000 tokens loaded/),
    ).toBeInTheDocument();

    act(() =>
      select({
        ...model,
        title: "Second",
        model: "second",
        contextLength: 2_000_000,
      }),
    );
    expect(
      screen.getByLabelText(/not yet calculated.*2,000,000/),
    ).toBeInTheDocument();
  });
});
