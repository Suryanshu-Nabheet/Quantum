import { z } from "zod";

/** Data sink schema — no cloud telemetry. Field accepted in config but not processed. */
export const dataSchema = z.object({}).passthrough();

export type DataDestination = z.infer<typeof dataSchema>;
export type DataLogLevel = never;
export type DevEventName = never;
export type DevDataLogEvent = never;
export const allDevEventNames: DevEventName[] = [];
