# AGENTS.md

This file provides guidance to Coding Agents when working with code in this repository.

---

## Coding Standard

- use `testify` for testing and assertions.
- use `golang-...` skills to follow Go best practices and idioms.

## Commands

You must check `vp run fmt`, `vp run lint:fix`, `vp run test`, and
`vp run -r check` before ending your work.

```bash
vp run test                 # Run Go tests with coverage
vp run lint                 # Run Go code quality checks
vp run lint:fix             # Run and auto-fix Go code quality checks
vp run fmt                  # Format Go code
vp run build                # Build the kg binary and embedded frontend
vp run clean                # Remove Go build outputs

# Standard Go commands
go test ./...               # Run all tests
go mod tidy                 # Clean up dependencies

# Frontend commands
vp run -r check             # Check all frontend packages
vp run -r check:fix         # Check and fix all frontend packages
vp run check:generated      # Verify the checked-in frontend build
```
