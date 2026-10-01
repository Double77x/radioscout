import { Capacitor } from "@capacitor/core";

/**
 * Single gate for all native branches. Web stays fully functional with zero
 * plugins — every native call site MUST have a web fallback.
 */
export const isNative = () => Capacitor.isNativePlatform();

export const getPlatform = (): "ios" | "android" | "web" => {
  const platform = Capacitor.getPlatform();
  return platform === "android" || platform === "ios" ? platform : "web";
};
