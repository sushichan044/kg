# AGENTS.md

This file provides guidance to Coding Agents when working with code in this repository.

---

## Generic Coding Standard

- Use arrange-act-assert pattern and insert proper newlines for readability.

## Golang Coding Standard

- use `testify` for testing and assertions.
- use `golang-...` skills to follow Go best practices and idioms.

## Web Coding Standard

- Prefer [Extending test context with `test.extend()`](https://vitest.dev/guide/test-context.md) rather than beforeEach/afterEach.
- Use [`expect.assert()](https://vitest.dev/api/expect.html#assert) for assert premises rather than conditional / optional-chain / non-null statements.
- Follow `kamae` or `kamae-review` skill for TypeScript logic and domain modeling.

<!--VITE PLUS START-->

## Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at <https://viteplus.dev/guide/>.

### Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
