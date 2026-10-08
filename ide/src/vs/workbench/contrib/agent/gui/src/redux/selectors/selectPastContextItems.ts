import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { getContextItemsFromHistory } from "../thunks/updateFileSymbols";

type ContextItemWithId = ReturnType<typeof getContextItemsFromHistory>[number];

/**
 * Context items attached to history items up to and including `index`.
 *
 * Streaming replaces only the tail history item, so prior items keep their
 * identity. Memoizing on the prior items (not the whole history array) lets a
 * per-row markdown preview skip re-rendering while the tail streams.
 */
export function makeSelectPastContextItems(index: number | undefined) {
  return createSelector(
    [(state: RootState) => state.session.history],
    (history) => {
      if (index === undefined) {
        return [];
      }
      return getContextItemsFromHistory(history, index);
    },
    {
      memoizeOptions: {
        resultEqualityCheck: (a: ContextItemWithId[], b: ContextItemWithId[]) =>
          a.length === b.length && a.every((item, i) => item === b[i]),
      },
    },
  );
}
