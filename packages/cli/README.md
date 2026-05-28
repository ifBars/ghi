# @ifbars/ghi

AI-native GitHub issue intake CLI for developers.

Install globally:

```bash
npm install -g @ifbars/ghi
```

or:

```bash
bun install -g @ifbars/ghi
```

Then run `ghi` from inside a GitHub-backed repository:

```bash
ghi "inventory dupes after reconnect"
ghi --review "mobile project cards are awkward once opened"
ghi close 42 "fixed by reconnect reconciliation"
```

Requirements:

- Node.js 20+
- Git
- GitHub CLI authenticated for the target repository
- A working local Codex session for `@openai/codex-sdk`

See the full project README at https://github.com/ifBars/ghi.
