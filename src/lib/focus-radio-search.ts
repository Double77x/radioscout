/** Cross-component signal that focuses the header search (no prop drilling). */
export const FOCUS_RADIO_SEARCH_EVENT = "focus-radio-search";

/** Focus the header search from anywhere (the dock Browse button). */
export function focusRadioSearch(): void {
  globalThis.dispatchEvent(new Event(FOCUS_RADIO_SEARCH_EVENT));
}
