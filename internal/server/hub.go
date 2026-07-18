package server

import "sync"

// subscriberBuffer bounds each subscriber's pending events. A slow client that
// fills its buffer drops events rather than blocking the broadcaster.
const subscriberBuffer = 16

// event is a single server-sent event.
type event struct {
	// name is the SSE event type (started, update, file-changed).
	name string
	// data is the JSON-encoded payload.
	data string
}

// hub fans out events to all connected SSE subscribers.
type hub struct {
	mu   sync.Mutex
	subs map[chan event]struct{}
}

func newHub() *hub {
	return &hub{subs: map[chan event]struct{}{}}
}

func (h *hub) subscribe() chan event {
	ch := make(chan event, subscriberBuffer)

	h.mu.Lock()
	h.subs[ch] = struct{}{}
	h.mu.Unlock()

	return ch
}

func (h *hub) unsubscribe(ch chan event) {
	h.mu.Lock()
	if _, ok := h.subs[ch]; ok {
		delete(h.subs, ch)
		close(ch)
	}
	h.mu.Unlock()
}

// broadcast delivers e to every subscriber without blocking. Events destined
// for a full subscriber buffer are dropped for that subscriber only.
func (h *hub) broadcast(e event) {
	h.mu.Lock()
	defer h.mu.Unlock()

	for ch := range h.subs {
		select {
		case ch <- e:
		default:
		}
	}
}

// closeAll disconnects every subscriber. Called during shutdown so long-lived
// SSE handlers return.
func (h *hub) closeAll() {
	h.mu.Lock()
	defer h.mu.Unlock()

	for ch := range h.subs {
		delete(h.subs, ch)
		close(ch)
	}
}
