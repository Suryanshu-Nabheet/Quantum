import { getPlatform } from "../util";

/** Linux webviews need an on-screen context menu (copy/cut/paste) when OSR is active. */
export default function useIsOSREnabled() {
  return getPlatform() === "linux";
}
