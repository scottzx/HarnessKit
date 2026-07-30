# Asset and License Manifest

HarnessKit code in this controlled fork is distributed under Apache-2.0, subject
to the repository `LICENSE` and locked dependency licenses. Product names and
third-party trademarks remain the property of their respective owners.

The shipped 1agents product surface is named **1agents Extensions**. The
HarnessKit name is used for source attribution and the internal module/binary,
not as a redistributed logo or endorsement claim.

## Banned Upstream Artwork

| Upstream path | Upstream status | Fork action | Allowed distribution surfaces |
|---|---|---|---|
| `public/icons/**` | All Rights Reserved | Remove; replace application identity with 1agents-owned text/geometric assets | None |
| `src/components/shared/agent-mascot/**` | All Rights Reserved | Remove; replace agent decoration with Lucide icons or text initials | None |
| `crates/hk-desktop/icons/app-icon-{1,2}.png` | Byte-identical copies of protected upstream application icons | Remove; disable the alternate-icon selector | None |

No copied, traced, recolored, rasterized, or generated derivative of these
assets is approved.

## Approved Replacement Sources

| Asset class | Source/license | Approved surfaces |
|---|---|---|
| Lucide icons imported by the frontend | `lucide-react`, ISC | Source, web embed, desktop, npm, archives |
| Text initials and CSS-only geometric marks authored in this fork | 1agents-owned, Apache-2.0 contribution | Source, web embed, desktop, npm, archives |
| Existing 1agents-owned product marks | 1agents-owned | 1agents product surfaces only |

## Release Verification

The release pipeline must:

1. fail if either banned source directory or a known banned filename remains;
2. build the production frontend after replacements are applied;
3. inspect generated JavaScript, CSS, source maps, desktop resources, npm
   tarballs, archives, and container layers for banned paths and known hashes;
4. include the Apache-2.0 license and generated third-party notices/SBOM;
5. fail closed when a visual asset has no manifest entry.
