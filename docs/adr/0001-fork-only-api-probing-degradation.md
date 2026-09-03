# Fork-only Clash API endpoints degrade by probing, not erroring

Date: 2026-09-03 · Status: accepted

## Decision

The preferred-ip page (desktop sidebar entry and mobile FAB secondary menu
item) is gated by a one-shot `GET /preferred-ip` probe, cached per endpoint
and invalidated on endpoint switch — mirroring `useEndpointScopedKey`
semantics. A 404 hides the page and its nav entries entirely; only endpoints
that serve the endpoint see it. This applies to every future fork-only Clash
API surface the dashboard adopts.

Why: the dashboard must stay fully usable against official Mihomo kernels,
which will never serve `/preferred-ip`. An always-visible page that errors on
open, or an env/config feature flag, pushes fork-maintenance noise onto
upstream users or adds a config surface that can drift from the truth — the
probe result _is_ the truth.

## Rejected alternatives

- Always-visible page with an error/empty state — noise for upstream users,
  and indistinguishable from "kernel broken".
- Static feature flags (build-time or user setting) — duplicates knowledge
  the endpoint itself already answers.

## Consequences

- Nav item lists become capability-computed, not static.
- One extra request per endpoint connection; cached, so navigation is free.
