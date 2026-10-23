import type { defineRule } from "vite-plus/lint/plugins";

declare const plugin: {
  meta: { name: string };
  rules: Record<string, ReturnType<typeof defineRule>>;
};

export default plugin;
