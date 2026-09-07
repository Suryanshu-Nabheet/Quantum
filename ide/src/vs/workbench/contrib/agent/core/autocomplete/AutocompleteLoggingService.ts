import {
  COUNT_COMPLETION_REJECTED_AFTER,
  DO_NOT_COUNT_REJECTED_BEFORE,
} from "../util/parameters.js";

import { AutocompleteOutcome } from "./util/types.js";

/** Tracks tab-autocomplete accept/reject outcomes locally (no network). */
export class AutocompleteLoggingService {
  private static instance: AutocompleteLoggingService;

  private outcomes = new Map<string, AutocompleteOutcome>();
  private rejectionTimeouts = new Map<string, NodeJS.Timeout>();
  private lastDisplayed:
    | { id: string; displayedAt: number }
    | undefined = undefined;

  private constructor() {}

  static getInstance(): AutocompleteLoggingService {
    if (!AutocompleteLoggingService.instance) {
      AutocompleteLoggingService.instance = new AutocompleteLoggingService();
    }
    return AutocompleteLoggingService.instance;
  }

  markDisplayed(completionId: string, outcome: AutocompleteOutcome): void {
    if (this.rejectionTimeouts.has(completionId)) {
      clearTimeout(this.rejectionTimeouts.get(completionId)!);
      this.rejectionTimeouts.delete(completionId);
    }

    const stored = { ...outcome, accepted: false };
    this.outcomes.set(completionId, stored);

    const timeout = setTimeout(() => {
      const current = this.outcomes.get(completionId);
      if (current && current.time > DO_NOT_COUNT_REJECTED_BEFORE) {
        current.accepted = false;
        this.outcomes.delete(completionId);
      }
      this.rejectionTimeouts.delete(completionId);
    }, COUNT_COMPLETION_REJECTED_AFTER);

    this.rejectionTimeouts.set(completionId, timeout);

    const previous = this.lastDisplayed;
    const now = Date.now();
    if (previous && this.rejectionTimeouts.has(previous.id)) {
      const prevOutcome = this.outcomes.get(previous.id);
      const c1 = prevOutcome?.completion.split("\n")[0] ?? "";
      const c2 = stored.completion.split("\n")[0];
      if (
        prevOutcome &&
        (c1.endsWith(c2) ||
          c2.endsWith(c1) ||
          c1.startsWith(c2) ||
          c2.startsWith(c1))
      ) {
        this.cancelRejectionTimeout(previous.id);
      } else if (now - previous.displayedAt < 500) {
        this.cancelRejectionTimeout(previous.id);
      }
    }

    this.lastDisplayed = { id: completionId, displayedAt: now };
  }

  accept(completionId: string): AutocompleteOutcome | undefined {
    this.cancelRejectionTimeout(completionId);
    const outcome = this.outcomes.get(completionId);
    if (outcome) {
      outcome.accepted = true;
      this.outcomes.delete(completionId);
      return outcome;
    }
    return undefined;
  }

  cancel(): void {
    for (const timeout of this.rejectionTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.rejectionTimeouts.clear();
    this.outcomes.clear();
    this.lastDisplayed = undefined;
  }

  private cancelRejectionTimeout(completionId: string): void {
    if (this.rejectionTimeouts.has(completionId)) {
      clearTimeout(this.rejectionTimeouts.get(completionId)!);
      this.rejectionTimeouts.delete(completionId);
    }
    this.outcomes.delete(completionId);
  }
}
