import { describe, it } from "vite-plus/test";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../lint/no-unjustified-effect.js";

RuleTester.describe = (name, fn) => {
  describe(name, fn);
};
RuleTester.it = (name, fn) => {
  it(name, fn);
};

const rule = plugin.rules["no-unjustified-effect"];
const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

ruleTester.run("no-unjustified-effect", rule, {
  valid: [
    {
      name: "a call within the audited count",
      code: "useEffect(() => {}, []);",
      filename: "src/components/theme.tsx",
      options: [{ allow: { "src/components/theme.tsx": 1 } }],
    },
    {
      name: "the last audited call in a file with several",
      code: "useEffect(() => {}, []); useEffect(() => {}, []);",
      filename: "src/components/theme.tsx",
      options: [{ allow: { "src/components/theme.tsx": 2 } }],
    },
    {
      name: "a Windows absolute filename maps to the repo path",
      code: "useEffect(() => {}, []);",
      filename: "C:\\repo\\src\\components\\theme.tsx",
      options: [{ allow: { "src/components/theme.tsx": 1 } }],
    },
    {
      name: "a POSIX absolute filename maps to the repo path",
      code: "useEffect(() => {}, []);",
      filename: "/home/ci/repo/src/components/theme.tsx",
      options: [{ allow: { "src/components/theme.tsx": 1 } }],
    },
  ],
  invalid: [
    {
      name: "the call over the audited count",
      code: "useEffect(() => {}, []); useEffect(() => {}, []);",
      filename: "src/components/theme.tsx",
      options: [{ allow: { "src/components/theme.tsx": 1 } }],
      errors: [{ messageId: "unjustified" }],
    },
    {
      name: "a file with no audited call",
      code: "useEffect(() => {}, []);",
      filename: "src/components/NewThing.tsx",
      options: [{ allow: {} }],
      errors: [{ messageId: "unjustified" }],
    },
    {
      name: "a React.useEffect member call counts too",
      code: "React.useEffect(() => {}, []);",
      filename: "src/components/NewThing.tsx",
      options: [{ allow: {} }],
      errors: [{ messageId: "unjustified" }],
    },
    {
      name: "a computed React.useEffect member call counts too",
      code: 'React["useEffect"](() => {}, []);',
      filename: "src/components/NewThing.tsx",
      options: [{ allow: {} }],
      errors: [{ messageId: "unjustified" }],
    },
    {
      name: "every call over the quota is reported at its own line",
      code: "useEffect(() => {}, []);\nuseEffect(() => {}, []);\nuseEffect(() => {}, []);",
      filename: "src/components/theme.tsx",
      options: [{ allow: { "src/components/theme.tsx": 1 } }],
      errors: [
        { messageId: "unjustified", line: 2 },
        { messageId: "unjustified", line: 3 },
      ],
    },
  ],
});
