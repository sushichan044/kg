package cmd

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strconv"
)

// spawnDaemon starts a detached background server watching the roots recorded in
// restorePath and sending its output to logFile. The child runs in foreground
// mode (it is the actual server) but is detached from this process's terminal.
func spawnDaemon(exe string, port int, restorePath string, logFile *os.File) error {
	// context.Background: the daemon must outlive this launcher process, so its
	// lifetime is not tied to any context here.
	proc := exec.CommandContext(
		context.Background(),
		exe,
		"--foreground",
		"--no-open",
		"--restore", restorePath,
		"-p", strconv.Itoa(port),
	)
	proc.Stdout = logFile
	proc.Stderr = logFile
	configureDaemonProc(proc)

	if err := proc.Start(); err != nil {
		return fmt.Errorf("start daemon: %w", err)
	}

	return proc.Process.Release()
}
