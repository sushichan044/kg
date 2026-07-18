//go:build windows

package cmd

import (
	"os/exec"
	"syscall"
)

const (
	detachedProcess       = 0x00000008
	createNewProcessGroup = 0x00000200
)

// configureDaemonProc detaches the child from the parent console so it keeps
// running after the launching shell exits.
func configureDaemonProc(proc *exec.Cmd) {
	proc.SysProcAttr = &syscall.SysProcAttr{CreationFlags: detachedProcess | createNewProcessGroup}
}
