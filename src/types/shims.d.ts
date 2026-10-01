// `vite/client` types are gone (vite resolves to vite-plus-core, which
// ships none); this keeps import.meta.env typed for the app instead.
interface ImportMeta {
  readonly env: Record<string, unknown>;
}
