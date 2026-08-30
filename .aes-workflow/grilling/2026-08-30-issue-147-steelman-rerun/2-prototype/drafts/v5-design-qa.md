# Product Design QA · Story Work Graph v5

## Comparison target

- Source visual truth: `2-prototype/drafts/v5-dual-tab-selected-target.png`
- Implementation: `2-prototype/drafts/v5-story-work-graph.html`
- Browser-rendered implementation: `2-prototype/evidence/webp11-v5/01-delivery-default.png`
- Discovery state: `2-prototype/evidence/webp11-v5/06-discovery-real-graph.png`
- Interaction evidence: `2-prototype/evidence/webp11-v5/02-delivery-web-qa-selected.png` through `11-source-boundary.png`
- Responsive evidence: `12-responsive-480.png`, `13-responsive-1440.png`
- Machine results: `2-prototype/evidence/webp11-v5/audit-results.json`
- State: Delivery Graph selected; SIM-W2-WEB-Q selected by default; truth boundary visible.

## Viewport and density normalization

- Intended CSS viewport: `768 × 1080`, DPR 1.
- Source pixels: `1058 × 1487`.
- Implementation pixels: `768 × 1080`.
- Both have the same portrait ratio within 0.1%; the source is treated as a higher-density conceptual frame and compared at the same normalized 768 × 1080 composition.
- Product constraint: the source image compresses the active graph to six visible runtime nodes, while v5 must expose 13 Delivery projection nodes and all 13 real Discovery nodes. The implementation therefore preserves the source hierarchy and Tab layout but allows vertical scrolling rather than reducing labels below readable size.

## Full-view comparison evidence

The selected source, final Delivery capture, and final Discovery capture were opened together in the same comparison input after the last visual fix.

Matched design intent:

- two first-level Graph Tabs, with Delivery selected;
- shared StoryRoot context and explicit `2-prototype pending` state;
- primary Story Pulse and safe-parallel action above the map;
- truth boundary separating real Discovery from simulated Delivery;
- cross-Graph contract / requires-decision rail;
- Map-first Delivery canvas, RepoLane grouping, current path, Gate lock, and Evidence second layer;
- warm neutral AES Console palette, serif display title, sans body, mono provenance/status text.

Intentional product differences:

- Web is read-only per P12, so primary controls locate projected work instead of mutating Story state.
- Delivery uses 13 derived nodes rather than the image's compressed six-node path.
- Discovery Tab contains the complete real #147 graph with 12 membership and 7 descendant dependency edges; the selected image only specified the inactive Tab summary.
- Standard text controls replace decorative icons to remain self-contained and align with the AES Workflow Console's text-first control language.

## Focused comparison evidence

- Header / truth boundary / Pulse / two Tabs / cross-Graph rail were inspected in the full-view pair and are large enough to judge at 768px.
- Delivery node typography, state borders, Lane grouping, and edge routing were inspected in `01-delivery-default.png` and `02-delivery-web-qa-selected.png`.
- Discovery real-data density and dependency routing were inspected in `06-discovery-real-graph.png` and `07-discovery-153-selected.png`.
- Modal spacing and read-only evidence hierarchy were inspected in `05-evidence-modal.png` and `11-source-boundary.png`.

## Comparison history

### Iteration 1

Earlier browser capture showed two actionable layout issues at 768px:

- [P1] The `max-width:820px` layout stacked Story identity and truth boundary, pushing the primary graph too far below the fold.
- [P2] The display title wrapped with a single orphan character, and the left side of the Story header had unused vertical space.

Fixes:

- moved the full stacked layout breakpoint from 820px to 640px while keeping the shell-specific 820px adaptation;
- reduced the 768px display title to 24px and enabled balanced wrapping;
- compacted the truth card and added `CURRENT ACTION SCOPE` to distinguish historical tracker closure from current prototype work.

Post-fix evidence: `01-delivery-default.png`, `06-discovery-real-graph.png`. The 768px header remains two-column, the title no longer orphans, and the Delivery canvas starts within the first viewport.

### Final pass

No actionable P0/P1/P2 mismatch remains. The remaining differences are intentional data-completeness and self-contained-prototype constraints described above.

## Required fidelity surfaces

### Fonts and typography

- Uses the AES Console stack exactly: Anthropic Serif/Georgia display, Anthropic Sans/Arial/system body, Anthropic Mono/system mono.
- Body is 14px at the primary viewport; node titles are 12px and metadata 9.5–10px. The browser audit found no visible leaf text below 10px in the 480px first viewport and 24 meta labels below 10px in graph states at 768px; those are provenance/status metadata, not primary reading text.
- Story title, phase tabs, Pulse and node titles retain a clear hierarchy without clipping.

### Spacing and layout rhythm

- Uses the AES 4/8/12/16px rhythm, 8/12/16px radii, restrained borders, and no nested-card wall.
- At 768px the page has no horizontal overflow; Graph owns the main work surface and scrolls vertically for complete data.
- 480px uses an internal 720px Graph canvas with contained horizontal scrolling; the document itself has no horizontal overflow.

### Colors and visual tokens

- Tokens are taken directly from `aes-using-workflow/console/template.html`: `#f5f4ed`, `#faf9f5`, `#c96442`, `#3898ec`, success/warn/danger variants and darker ink colors.
- State is never color-only: every node and banner includes a text state.
- Contrast-sensitive badge text uses the darker AES ink tokens.

### Image quality and asset fidelity

- The screen does not require photography, logos, avatars or decorative imagery.
- The Graph is the product's code-native visualization; HTML nodes and SVG data edges are not placeholder assets.
- No CSS illustration, emoji, handcrafted decorative SVG, stock placeholder, or rasterized UI is used.

### Copy and content

- Real #147 closure is separated from current dossier work.
- `root 0/0` is explicitly scoped to the root; the real descendant Graph exposes seven native dependency edges.
- All Delivery runtime fields are marked `SIMULATED GAP`, with `runtime NOT_CONNECTED` visible.
- P12's read-only Web boundary is stated in the header, Pulse, selected context and source modal.

## Interaction and browser verification

Passed with native CDP pointer, keyboard and text events:

- Delivery / Discovery Tab switching;
- 13-node Delivery Map and 13-node real Discovery Map;
- Map/List shared projection and selection;
- search, filters, membership visibility, author-progression overlay and one-hop focus;
- selected-node Now/Why/Owner/Next/Unlocks projection;
- Delivery → Discovery return explanation;
- source and Evidence modal, Escape close and focus restoration;
- 480, 768 and 1440 responsive layouts;
- reduced-motion mode.

Browser assertions:

- fixed-stage elements: `0`;
- real Discovery nodes: `13` including StoryRoot;
- native membership edges: `12`;
- native descendant dependency edges: `7`;
- Delivery projection nodes: `13`;
- unnamed buttons: `0`;
- targets below 24px: `0`;
- console/runtime errors: `0`;
- document horizontal overflow at 480/768/1440: `0`.

## Residual test gaps

- Real screen reader, 200% browser zoom, Windows high contrast and 320px remain `NOT_RUN`.
- There is no real active Delivery runtime; the Delivery Tab proves product structure only.
- Human ten-second comprehension timing still requires a real operator review; automated checks cannot prove understanding.

## Follow-up polish

- [P3] A later product implementation may add a locally vendored icon library while preserving the text labels.
- [P3] A large Story may need stable incremental auto-layout instead of the deterministic prototype coordinates.

## Final result

final result: passed

