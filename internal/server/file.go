package server

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const (
	txtExt       = ".txt"
	fileIDLength = 8
)

// File is a watched text file exposed to the browser.
type File struct {
	// ID is a stable identifier derived from the absolute path.
	ID string `json:"id"`
	// AbsPath is the cleaned absolute path on disk.
	AbsPath string `json:"-"`
	// RelPath is the label shown in the UI, relative to the working directory.
	RelPath string `json:"path"`
}

// FileID returns a stable short identifier for an absolute path. The same path
// always yields the same ID so re-adding a file is idempotent.
func FileID(absPath string) string {
	sum := sha256.Sum256([]byte(absPath))
	return hex.EncodeToString(sum[:])[:fileIDLength]
}

func newFile(absPath, baseDir string) File {
	rel, err := filepath.Rel(baseDir, absPath)
	if err != nil {
		// A path on a different volume than baseDir cannot be made relative;
		// fall back to the absolute path so the label stays meaningful.
		rel = absPath
	}

	return File{
		ID:      FileID(absPath),
		AbsPath: absPath,
		RelPath: filepath.ToSlash(rel),
	}
}

// discover expands the given roots into the sorted set of .txt files to serve
// and the directories that must be watched for changes. Directory roots are
// scanned recursively; a file root is included only when it is a .txt file.
//
// A root or entry that cannot be read is logged and skipped rather than failing
// the whole scan: one deleted folder or unreadable subdirectory must not freeze
// the catalog for every other root.
func discover(ctx context.Context, roots []string, baseDir string, logger *slog.Logger) ([]File, []string) {
	files := map[string]File{}
	dirs := map[string]struct{}{}

	for _, root := range roots {
		matcher := newIgnoreMatcher(root)

		info, err := os.Stat(root)
		if err != nil {
			logger.WarnContext(ctx, "skip unreadable root", "root", root, "error", err)

			continue
		}

		if info.IsDir() {
			walkTxt(ctx, root, baseDir, files, dirs, matcher, logger)

			continue
		}

		if isTxt(root) && !matcher.ignored(root, false) {
			f := newFile(root, baseDir)
			files[f.AbsPath] = f
			dirs[filepath.Dir(root)] = struct{}{}
		}
	}

	return sortedFiles(files), sortedKeys(dirs)
}

func walkTxt(
	ctx context.Context,
	root, baseDir string,
	files map[string]File,
	dirs map[string]struct{},
	matcher *ignoreMatcher,
	logger *slog.Logger,
) {
	// The callback never returns a non-skip error, so WalkDir cannot fail.
	_ = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			logger.WarnContext(ctx, "skip unreadable path", "path", path, "error", err)
			if d != nil && d.IsDir() {
				return fs.SkipDir
			}

			return nil
		}

		if d.IsDir() {
			// Skip dot-directories (.git, .vscode, .obsidian, …) entirely, except
			// the walk root itself so a writer can still target one explicitly.
			if path != root && strings.HasPrefix(d.Name(), ".") {
				return fs.SkipDir
			}
			if matcher.ignored(path, true) {
				return fs.SkipDir
			}
			dirs[path] = struct{}{}

			return nil
		}

		if isTxt(path) && !matcher.ignored(path, false) {
			f := newFile(path, baseDir)
			files[f.AbsPath] = f
		}

		return nil
	})
}

func isTxt(path string) bool {
	return strings.EqualFold(filepath.Ext(path), txtExt)
}

func sortedFiles(files map[string]File) []File {
	out := make([]File, 0, len(files))
	for _, f := range files {
		out = append(out, f)
	}

	sort.Slice(out, func(i, j int) bool {
		return out[i].RelPath < out[j].RelPath
	})

	return out
}

func sortedKeys(set map[string]struct{}) []string {
	out := make([]string, 0, len(set))
	for k := range set {
		out = append(out, k)
	}

	sort.Strings(out)

	return out
}
