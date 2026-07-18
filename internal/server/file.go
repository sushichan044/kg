package server

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
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
func discover(roots []string, baseDir string) ([]File, []string, error) {
	files := map[string]File{}
	dirs := map[string]struct{}{}

	for _, root := range roots {
		matcher := newIgnoreMatcher(root)

		info, err := os.Stat(root)
		if err != nil {
			return nil, nil, fmt.Errorf("stat %q: %w", root, err)
		}

		if info.IsDir() {
			if walkErr := walkTxt(root, baseDir, files, dirs, matcher); walkErr != nil {
				return nil, nil, walkErr
			}

			continue
		}

		if isTxt(root) && !matcher.ignored(root, false) {
			f := newFile(root, baseDir)
			files[f.AbsPath] = f
			dirs[filepath.Dir(root)] = struct{}{}
		}
	}

	return sortedFiles(files), sortedKeys(dirs), nil
}

func walkTxt(root, baseDir string, files map[string]File, dirs map[string]struct{}, matcher *ignoreMatcher) error {
	walkErr := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
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
	if walkErr != nil {
		return fmt.Errorf("walk %q: %w", root, walkErr)
	}

	return nil
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
