package cmd

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	probeTimeout   = 500 * time.Millisecond
	requestTimeout = 2 * time.Second
)

type daemonStatus struct {
	Version   string   `json:"version"`
	PID       int      `json:"pid"`
	FileCount int      `json:"file_count"`
	Roots     []string `json:"roots"`
}

func baseURL(port int) string {
	return fmt.Sprintf("http://127.0.0.1:%d", port)
}

// probeRunning reports whether a kg server is already listening on port.
func probeRunning(port int) bool {
	_, err := fetchStatusWithTimeout(port, probeTimeout)

	return err == nil
}

func fetchStatus(port int) (daemonStatus, error) {
	return fetchStatusWithTimeout(port, requestTimeout)
}

func fetchStatusWithTimeout(port int, timeout time.Duration) (daemonStatus, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL(port)+"/_/api/status", nil)
	if err != nil {
		return daemonStatus{}, fmt.Errorf("build status request: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return daemonStatus{}, fmt.Errorf("request status: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return daemonStatus{}, fmt.Errorf("request status returned status %d", resp.StatusCode)
	}

	var status daemonStatus
	if err = json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return daemonStatus{}, fmt.Errorf("decode status: %w", err)
	}

	return status, nil
}

func postJSON(port int, path string, body any) error {
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request: %w", err)
		}
		reader = bytes.NewReader(data)
	}

	ctx, cancel := context.WithTimeout(context.Background(), requestTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL(port)+path, reader)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("request %s: %w", path, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("request %s returned status %d", path, resp.StatusCode)
	}

	return nil
}

func addRoots(port int, paths []string) error {
	return postJSON(port, "/_/api/roots", map[string][]string{"paths": paths})
}

func requestShutdown(port int) error {
	return postJSON(port, "/_/api/shutdown", nil)
}

func requestRestart(port int) error {
	return postJSON(port, "/_/api/restart", nil)
}
