package server

import (
	"bufio"
	"os"
	"path/filepath"

	gitignore "github.com/sabhiram/go-gitignore"
)

const gitDirName = ".git"

// ignoreMatcher reports whether paths are excluded by the enclosing git
// repository's ignore rules, so kg does not surface files the writer keeps out
// of version control (build output, dependencies, drafts, etc.). It is nil when
// the root is not inside a git repository, in which case only the .git directory
// itself is skipped.
type ignoreMatcher struct {
	base string
	gi   *gitignore.GitIgnore
}

// newIgnoreMatcher builds a matcher from the .gitignore and .git/info/exclude of
// the git repository enclosing root. It returns nil when root is not in a repo.
func newIgnoreMatcher(root string) *ignoreMatcher {
	repoRoot, ok := findGitRoot(root)
	if !ok {
		return nil
	}

	lines := readIgnoreLines(filepath.Join(repoRoot, ".gitignore"))
	lines = append(lines, readIgnoreLines(filepath.Join(repoRoot, gitDirName, "info", "exclude"))...)

	return &ignoreMatcher{base: repoRoot, gi: gitignore.CompileIgnoreLines(lines...)}
}

// ignored reports whether path is excluded. The .git directory is always
// treated as ignored. A nil matcher ignores nothing but .git.
func (m *ignoreMatcher) ignored(path string, isDir bool) bool {
	if isDir && filepath.Base(path) == gitDirName {
		return true
	}
	if m == nil {
		return false
	}

	rel, err := filepath.Rel(m.base, path)
	if err != nil || rel == "." {
		return false
	}

	return m.gi.MatchesPath(filepath.ToSlash(rel))
}

// findGitRoot walks up from start looking for a .git entry and returns the
// directory containing it.
func findGitRoot(start string) (string, bool) {
	dir := start
	for {
		if _, err := os.Stat(filepath.Join(dir, gitDirName)); err == nil {
			return dir, true
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", false
		}
		dir = parent
	}
}

func readIgnoreLines(path string) []string {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer func() { _ = f.Close() }()

	var lines []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	// A read error just yields the lines gathered so far; ignore rules are
	// best-effort and a partial .gitignore should not break discovery.
	_ = scanner.Err()

	return lines
}
