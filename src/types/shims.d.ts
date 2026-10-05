// `vite/client` types are gone (vite resolves to vite-plus-core, which
// ships none); this keeps import.meta.env typed for the app instead.
interface ImportMeta {
  readonly env: Record<string, unknown>;
}

// Raw text imports (`import css from "./index.css?raw"`) for static
// assertions over stylesheets in unit tests.
declare module "*?raw" {
  const content: string;
  export default content;
}
