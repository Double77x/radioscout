// Oxlint rule: a new useEffect call needs a deliberate decision, not a habit.
// The allow map is the mechanical half of the audit in
// docs/plans/REFACTOR_PERFORMANCE_USEEFFECT.md §5: raising a count is only
// legitimate alongside a row that says why the work is imperative.
import { definePlugin, defineRule } from "vite-plus/lint/plugins";

function repoPath(filename) {
  const normalized = String(filename ?? "").replaceAll("\\", "/");
  const marker = "/src/";
  const index = normalized.lastIndexOf(marker);
  return index === -1 ? normalized.replace(/^\.\//, "") : normalized.slice(index + 1);
}

const noUnjustifiedEffect = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Keep useEffect to the call sites audited as genuinely imperative",
    },
    messages: {
      unjustified:
        "useEffect #{{seen}} in this file; the audit allows {{allowed}}. A new effect needs a justification: " +
        "if the work is genuinely imperative, raise this file's count in toolchain.config.ts and add a row to " +
        "docs/plans/REFACTOR_PERFORMANCE_USEEFFECT.md §5. Otherwise derive during render, use the event handler, " +
        "TanStack Query, or useSyncExternalStore (CODING_STANDARDS §3.E).",
    },
    schema: [
      {
        type: "object",
        properties: {
          allow: {
            type: "object",
            additionalProperties: { type: "integer", minimum: 0 },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const allow = (context.options[0] && context.options[0].allow) || {};
    const allowed = allow[repoPath(context.filename)] ?? 0;
    let seen = 0;

    function check(node) {
      seen += 1;
      if (seen <= allowed) return;
      context.report({
        node,
        messageId: "unjustified",
        data: { seen: String(seen), allowed: String(allowed) },
      });
    }

    return {
      CallExpression(node) {
        const { callee } = node;
        if (callee.type === "Identifier" && callee.name === "useEffect") {
          check(node);
          return;
        }
        if (
          callee.type === "MemberExpression" &&
          callee.object.type === "Identifier" &&
          callee.object.name === "React"
        ) {
          const property = callee.property;
          if (
            (property.type === "Identifier" && property.name === "useEffect") ||
            (callee.computed && property.type === "Literal" && property.value === "useEffect")
          ) {
            check(node);
          }
        }
      },
    };
  },
});

export default definePlugin({
  meta: { name: "scout" },
  rules: { "no-unjustified-effect": noUnjustifiedEffect },
});
