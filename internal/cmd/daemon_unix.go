//go:build !windows

package cmd

import (
	"os/exec"
	"syscall"
)

// configureDaemonProc puts the child in its own session so it survives the
// parent terminal closing.
func configureDaemonProc(proc *exec.Cmd) {
	proc.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
}
