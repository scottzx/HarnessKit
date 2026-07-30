# Controlled Fork Policy

This repository is the 1agents-controlled fork of
[`RealZST/HarnessKit`](https://github.com/RealZST/HarnessKit).

## Baseline

- Upstream repository: `https://github.com/RealZST/HarnessKit.git`
- Fork repository: `https://github.com/scottzx/HarnessKit.git`
- Initial upstream base: `db2d8a81a681cf76eea6780a39d09b968efcf550`
- Baseline workspace version: `1.8.0`
- Parent repository pin: the exact `modules/HarnessKit` submodule commit

1agents releases must never build HarnessKit from a floating branch or tag.

## Patch Ownership

Changes that are generally useful to HarnessKit belong in this fork and should
remain suitable for upstream contribution:

- configurable data directories and supervised-server hardening;
- extension-kind and adapter capabilities;
- scoped inventory APIs and scan performance;
- reusable web application dependency injection and custom-element embedding.

1agents-specific authentication, workspace IDs, host routes, process lifecycle,
migration orchestration, and packaging policy stay in the 1agents repository.

## Protected Artwork

Upstream marks `public/icons/` and
`src/components/shared/agent-mascot/` as All Rights Reserved. The 1agents fork
must not redistribute those assets or derivatives. See
[`ASSET-LICENSES.md`](ASSET-LICENSES.md). Release artifact checks must inspect
source maps, generated JavaScript/CSS, npm tarballs, archives, containers, and
desktop resources as well as source paths.

The byte-identical alternate application icon copies under
`crates/hk-desktop/icons/` are removed as part of the same policy.

## Manual Upstream Sync

The first 1agents cutover uses a reproducible manual validation flow:

1. Fetch `upstream/main` without changing the production submodule pin.
2. Create a temporary sync branch from the current fork production commit.
3. Merge `upstream/main` into that branch.
4. Resolve conflicts without reintroducing protected artwork or 1agents host
   assumptions.
5. Run `cargo test --workspace`, the frontend test suite, frontend production
   build, CLI/web smoke tests, and the banned-artifact scan.
6. Review the complete fork delta and update the baseline commit in this file
   only when the parent repository intentionally advances its exact pin.

Scheduled upstream-sync automation is intentionally deferred until after the
first cutover.
