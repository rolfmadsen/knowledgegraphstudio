Architecture Notations Refactoring Implementation Plan

Repository: rolfmadsen/knowledgegraphstudioBaseline reviewed: main at 7f5c8bd9dc8bdb8d89763aab141d9af2b3a4e363Scope: Knowledge Graph, Conceptual Model, Information Model, Logical Data Model, C4, ArchiMate, DCR, and Event ModelingGoal: Make node, edge, handle, grid, selection, and canvas behavior consistent where it is genuinely shared, while preserving every notation's semantics and working layout.

1. Executive recommendation

Refactor incrementally through an opt-in canvas policy. First establish characterization tests and narrow shared contracts, then migrate one notation at a time. Do not replace the notation renderers with one universal node or boundary component.

The reusable layer should own mechanics:

Grid constants and grid arithmetic.

Initial node geometry and measured-bound rules.

React Flow's hidden floating-handle registration.

Selection, focus, keyboard, and connection interaction contracts.

Generic edge intersection, orthogonal routing, hit areas, labels, and bend handling.

Performance conventions for large canvases.

Each notation should continue to own meaning:

Node content, shapes, stereotypes, icons, and semantic colors.

Allowed concepts and relations, validation, and quick actions.

Containers and layout semantics that carry domain meaning.

Notation-specific edge meaning, markers, line styles, and simulation state.

Event Modeling is deliberately the final migration. Its leaf-node width is an explicit notation rule of 10 * GRID_SIZE (currently 240 px). Its chapter, slice, swimlane, payload, and cross-slice gutter behavior must remain notation-specific. The current seeded height is existing behavior to characterize, not a new product rule inferred from the width.

2. What the repository currently contains

There are eight registered view types but seven distinct renderer profiles because Information Model and Logical Data Model share the Information renderer:

View

Renderer profile

Current leaf width

Special behavior

Knowledge Graph

Knowledge Graph

240 px / 10 * GRID_SIZE

Generic concepts and grouping boundaries

Conceptual Model

Core Conceptual

288 px / 12 * GRID_SIZE

Name and definition card

Information Model

Core Information

288 px / 12 * GRID_SIZE

Properties, datatypes, and enumerations

Logical Data Model

Core Information

288 px / 12 * GRID_SIZE

Shares presentation code with Information, but has its own view contract

C4

C4

288 px / 12 * GRID_SIZE

Hierarchical boundaries, external elements, C4 relation styling

ArchiMate

ArchiMate

288 px / 12 * GRID_SIZE

Layer/type semantics and grouping

DCR

DCR

288 px / 12 * GRID_SIZE for events

Simulation state, roles/principals, subprocesses, semantic edge markers

Event Modeling

Event Modeling

240 px / 10 * GRID_SIZE

Opinionated chapter/slice layout, payloads, completeness, gutter routing

Important observations from the current code:

ReactFlowCanvas.tsx and NotationCanvasWrapper.tsx contain hard-coded branches for individual view types. Shared canvas mechanics and notation policy are therefore mixed together.

Hidden source/target handles are repeated throughout the notation renderers. Some versions use pointerEvents: 'none'; others do not.

Visible cards in several notations are 288 px wide, while getConceptNodeSize() and some canvas fallbacks use 240 px. Initial layout, routing assumptions, and rendered dimensions can disagree.

Selection scaling was removed in a recent performance improvement, but edge padding code still appears to reserve space for the old selected-node scale.

GRID_SIZE and grid-related fallbacks are repeated in multiple modules.

ADR 0006 describes content-first/measured sizing while ADR 0007 describes strict fixed-grid sizing. Both are accepted, so the intended geometry contract is ambiguous.

The current tests are strongest for pure routing and Event Modeling layout. There is little renderer-level coverage and no deterministic visual regression suite.

Recent work targets canvases over 1,500 nodes. Any abstraction must preserve memoization, stable props, and inexpensive render trees.

3. Non-negotiable invariants

These invariants apply to every phase and every pull request:

No big-bang rewrite. A notation opts into the new policy only after its characterization tests exist.

A shared abstraction is introduced only for behavior already demonstrated in at least two notations, except for foundational contracts such as geometry and handles.

Measured React Flow dimensions are authoritative after a node has rendered. Initial dimensions exist for first layout and unmeasured fallback only.

A node's renderer, initial geometry, layout engine, and edge router must agree on width.

Containers are not treated as ordinary leaf cards. Saved/measured container dimensions take precedence over leaf defaults.

Semantic visual differences are preserved unless a separate product/design decision explicitly changes them.

Selection must not move a node or cause edge endpoints to jump.

Visual convergence must not add transition-all, selection scaling, unstable inline objects, or unnecessary wrappers to every node.

Event Modeling remains opinionated. Its 10 * GRID_SIZE leaf width does not become the default for other notations.

Every migration is independently reversible and leaves the full suite green.

4. Urgent prerequisite — resolve ADR 0006 and ADR 0007

Treat this as PR 0A and a merge prerequisite for every renderer refactor. ADR 0006 and ADR 0007 are both marked accepted while describing incompatible sizing/edge-alignment rules. Leaving both active would let two correct-looking implementations target different contracts.

Do not silently edit history until the two documents appear to agree. Preserve their rationale, but make the active decision unambiguous:

Add a new ADR (the next available number) titled along the lines of Canvas geometry: grid-aligned initial bounds with measured rendered bounds.

Change ADR 0006's status to Superseded by ADR 0008 (or the actual new number) and link to the new decision.

Change ADR 0007's status the same way and link to the new decision.

Add a short “why superseded” note to each: 0006 made measured content authoritative; 0007 required fixed grid-multiple geometry; the new ADR defines where each rule applies.

Search all source, tests, and documentation for references to ADR 0006, ADR 0007, and the stale ADR 0001 grid reference. Point active implementation references to the new ADR; retain old links only where historical context is intentional.

Add executable geometry contract tests in the same PR. The ADR must not remain prose that the code can contradict unnoticed.

Record any known current violations—especially the 240/288 initial-versus-rendered width disagreement—as migration work, rather than changing several notation renderers inside the ADR PR.

The recommended replacement contract is a hybrid that matches how React Flow actually works:

Initial layout geometry is expressed in grid units and is grid-aligned.

A notation may declare a leaf node as fixed or content sized.

Fixed nodes have an exact grid-multiple height and must constrain or truncate content deliberately.

Content-sized nodes have a grid-aligned minHeight; their measured browser height becomes authoritative after render.

Container nodes use their saved, calculated, or measured bounds rather than leaf defaults.

Left/right edge endpoints use the exact measured vertical center of the visible boundary.

Top/bottom anchors and orthogonal bends are snapped to the grid where the routing policy requires it.

Selection rings and shadows are visual decoration and do not change geometry.

The replacement ADR must record the following explicit product decisions:

Event Modeling leaf width is 10 * GRID_SIZE.

Whether Event Modeling's current seeded/minimum height remains fixed, becomes content-sized, or varies by node subtype. Do not infer this from the width decision.

The intended widths for each other renderer profile. The plan assumes preservation of current visible widths: 288 px for Conceptual, Information/Logical, C4, ArchiMate, and DCR events; 240 px for Knowledge Graph and Event Modeling.

Whether exact side-center anchors or fully grid-snapped anchors win when those constraints conflict.

PR 0A acceptance criteria:

Exactly one ADR is active for canvas geometry and edge alignment.

ADR 0006 and ADR 0007 visibly point to that replacement and are no longer marked Accepted without qualification.

src/constants/grid.ts, grid tests, and active architecture documentation link to the replacement ADR.

Contract tests cover measured-over-initial precedence, grid-aligned initial dimensions, container exceptions, side-center anchor behavior, and Event Modeling's 10 * GRID_SIZE leaf width.

The pull request contains no broad renderer refactor; it makes the decision and current deviations explicit.

No notation-refactoring phase may merge until PR 0A is accepted.

5. Target responsibility model

5.1 Common canvas infrastructure

The neutral canvas layer should live under src/features/viewport/graph/, not in a broad src/notations/common/ dumping ground. It may depend on shared domain types, but it must not import individual notation implementations.

Proposed modules:

src/features/viewport/graph/
  contracts/
    canvasPolicy.ts
    nodeGeometry.ts
    edgeRoutingPolicy.ts
  primitives/
    FloatingEdgeHandles.tsx
    NodeInteractionFrame.tsx       # only if two migrations prove it useful
  geometry/
    measuredBounds.ts
    gridGeometry.ts
  routing/
    floatingIntersection.ts
    orthogonalRouting.ts
    routingTypes.ts

Do not move all existing routing code immediately. First wrap and test the current utilities. Move files only when the move is behavior-neutral and import direction is clear.

5.2 Notation-owned presentation policy

Extend the notation contract with pure, focused policy functions. Keep JSX out of src/notations/types.ts and avoid a runtime import from notation types back into ReactFlowCanvas.

Illustrative contract:

type NodeSizingMode = 'fixed' | 'content' | 'container';

interface InitialNodeGeometry {
  width: number;
  height?: number;
  minHeight?: number;
  sizing: NodeSizingMode;
}

interface NotationCanvasPolicy {
  getInitialNodeGeometry(context: NodeGeometryContext): InitialNodeGeometry;
  getNodeRole(context: NodeContext): 'leaf' | 'container' | 'annotation';
  shouldRenderRelation(context: RelationVisibilityContext): boolean;
  getRoutingPolicy(context: EdgeContext): EdgeRoutingPolicy;
  getContainmentPolicy?(context: ContainerContext): ContainerPolicy;
}

The exact names can change during implementation; the separation of responsibilities should not.

Key dependency rule:

ReactFlowCanvas -> neutral policy interfaces <- each notation implementation

The canvas asks the active notation for policy. It does not inspect view.type to rediscover notation behavior.

5.3 Backward-compatible opt-in

Introduce policy fields as optional at first:

const geometry = notation.canvasPolicy?.getInitialNodeGeometry(context)
  ?? getLegacyInitialGeometry(view.type, context);

Each notation migration replaces one part of the fallback. Remove the legacy branch only after a contract test proves that every registered view supplies the policy.

This is the main safety mechanism for one-by-one delivery.

6. Reuse matrix

Concern

Common implementation

Kept notation-specific

Grid

GRID_SIZE, snap/multiply/validate helpers

Chosen grid-unit width, height, lane gaps, and container spacing

Initial geometry

Contract and measured-over-initial precedence

Geometry values by node subtype and view

Hidden handles

Source/target registration primitive and interaction modes

Any notation that intentionally exposes a connect affordance

Node frame

Optional minimal geometry/interaction frame

Content, shape, header, badges, colors, icons, stereotypes

Selection

Focus/selected state contract, no geometry change

Semantic accent only where justified

Edge endpoints

Measured-bound intersection and stable anchor math

Allowed sides and notation routing strategy

Orthogonal bends

Grid snapping, segment representation, dragging mechanics

Gutter/obstacle rules and default side choices

Edge hit area/label

Shared interaction layer

Line style, label content, marker and semantic color

Containers

Common bounds/resize plumbing

C4 boundaries, ArchiMate groupings, DCR subprocesses, Event Modeling chapters/slices

Relation visibility

Policy hook

Which relation types are suppressed in which view

Quick actions

Shared toolbar mechanics

Actions, concepts, directions, and relations offered

Validation

No generic replacement

Entirely notation-owned

Layout

Common layout invocation/result contract

Algorithms and semantic constraints

Performance

Memoization and stable-prop conventions

Renderer-specific expensive content and LOD choices

7. Shared components: intentionally narrow designs

7.1 FloatingEdgeHandles

The first reusable component should register exactly one target and one source handle for the existing floating-edge algorithm.

Requirements:

Retain visibility: hidden; never use display: none, because React Flow must measure the handles.

Use a module-level frozen style object so every render does not allocate a new object.

Place both handles at the center-registration point expected by the floating-edge implementation.

Represent interaction explicitly, for example interaction="pass-through" | "connectable".

Do not globally set pointerEvents: 'none' until characterization confirms that drag-to-connect is not required in any notation. Click-to-connect and keyboard-connect flows must have integration tests first.

Preserve stable handle IDs if the existing edge model relies on them.

Memoize the component.

7.2 Geometry helpers

Provide pure helpers for:

gridUnits(count) or equivalent multiplication by the single GRID_SIZE constant.

Grid alignment validation.

Choosing measured dimensions over stored style and initial policy dimensions.

Normalizing invalid or absent dimensions without view-specific magic numbers.

Do not add another calculateDynamicNodeHeight() if the browser is expected to measure content. If a notation truly uses fixed height tiers, keep the tier function beside that notation's policy and test it there.

7.3 Node frame

Do not begin with a universal NodeShell containing indigo selection, overflow-hidden, fixed rounded corners, or transition-all. Those are visual decisions, and boundaries plus special shapes do not share them.

After Conceptual and Information migrations, evaluate whether a minimal NodeInteractionFrame is justified. It may own only:

The width/minimum-height style contract.

Hidden handles.

selected/focused data attributes.

shared event plumbing and accessibility hooks.

a class-name slot supplied by the notation.

If this component requires many booleans to reproduce existing designs, stop and keep composition in the notation renderers.

7.4 Boundary components

Do not introduce one universal boundary shell. C4 boundaries, ArchiMate groupings, DCR subprocesses, and Event Modeling chapters/slices may look superficially similar but encode different containment and interaction rules.

Only low-level boundary mechanics may be shared:

Resize observer/bounds handling.

Selection and focus plumbing.

Floating handles.

optional resize controls.

The boundary markup and semantic labels remain in their notation modules.

8. Test strategy

The test suite should have five layers. A migration is complete only when the relevant layers are present.

8.1 Pure unit and contract tests

Use the existing Vitest Node environment for policy, geometry, layout, validation, and routing functions.

Add:

src/features/viewport/graph/contracts/__tests__/notationCanvasPolicy.test.ts
src/features/viewport/graph/geometry/__tests__/nodeGeometry.test.ts
src/features/viewport/graph/geometry/__tests__/gridGeometry.test.ts
src/features/viewport/graph/routing/__tests__/floatingIntersection.test.ts
src/features/viewport/graph/routing/__tests__/orthogonalRouting.test.ts
src/notations/__tests__/registeredNotationContracts.test.ts

Core contract cases:

Every registered ViewType resolves to a notation.

Every migrated notation returns finite positive geometry.

Initial widths are grid-aligned.

Event Modeling leaf width is exactly 10 * GRID_SIZE.

Container geometry does not fall through to a leaf-card default.

Measured width/height wins over style and initial fallback.

Style dimensions win over initial fallback before measurement, where that remains intended.

Selection does not alter the routing bounds.

Relation visibility comes from the notation policy rather than a view-type switch.

All edge-routing results contain valid finite points.

Grid-required bends are grid-aligned.

Use table-driven tests over all views and representative node subtypes. Avoid one large snapshot of the entire notation object.

8.2 Renderer component tests

Add jsdom, React Testing Library, @testing-library/jest-dom, and a small React Flow wrapper harness. Use a targeted Vitest browser environment annotation or a separate component-test config so pure tests stay fast.

Common renderer tests:

Exactly one source and one target floating handle are present.

Handles use visibility: hidden, not display: none.

The selected state changes decoration but not width, height, or transform.

A center click reaches the node; a registration-only handle does not intercept it.

Long content follows the notation's fixed/content sizing rule.

Memoized nodes do not re-render when unrelated selection changes.

Accessible name/role and keyboard focus remain available.

Avoid broad DOM snapshots. Assert semantic text, stable data attributes, style contracts, and specific classes only where the class is part of the design contract.

8.3 Canvas integration tests

Render a small deterministic graph in the real ReactFlowCanvas harness and test:

Initial node position and geometry.

Measured-node update and edge endpoint recomputation.

Click selection and keyboard selection.

Click-to-connect, cancellation, and invalid-relation handling.

Node drag and persisted position.

Edge selection, label interaction, and segment dragging.

Container parent/child movement where applicable.

Quick actions and created-node placement.

Relation visibility by view.

Switching between two views without leaking policy from the previous notation.

8.4 Browser visual regression tests

Add Playwright with a test-only notation gallery served through Vite. Keep it outside the production route graph. Each fixture must use fixed data, fixed viewport dimensions, deterministic fonts, disabled animation, and a settled-layout signal before taking screenshots.

For each notation capture:

representative leaf nodes, selected and unselected;

long label/content behavior;

one representative edge, selected and unselected;

relation label and marker where applicable;

boundary/container state where applicable;

a small mixed graph at 100% zoom.

Visual snapshots should answer “did this migration change the UI?” They should not replace semantic assertions.

Snapshot updates require an explicit command and reviewer confirmation. Never update screenshots automatically just to make CI green.

8.5 Performance regression tests

Record a baseline before changing shared node code. Use deterministic datasets at approximately 100, 1,000, and 1,500 nodes.

Measure at least:

time from navigation to settled React Flow render;

React commit count when selecting one node;

number of node renderers invoked for one unrelated selection;

p50/p95 node-drag update duration;

dropped frames during a scripted pan/zoom interval;

memory after layout settles.

Use medians over repeated runs on a fixed CI runner. Make gross regressions blocking; initially report smaller timing variation rather than creating a flaky gate. Recommended blocking rules after the benchmark stabilizes:

no more than 10% regression in the 1,500-node settled-render median;

no canvas-wide node re-render for a single selection;

no new continuous animation or geometry transition on unselected nodes;

no unbounded memory growth over repeated view switches.

Run the full performance job nightly or on an explicit label; run a smaller smoke benchmark in pull requests.

9. Test data and fixture design

Create one fixture builder per notation and a shared graph builder:

src/test/fixtures/graphFixture.ts
src/test/fixtures/notations/conceptualFixture.ts
src/test/fixtures/notations/informationFixture.ts
src/test/fixtures/notations/logicalFixture.ts
src/test/fixtures/notations/knowledgeGraphFixture.ts
src/test/fixtures/notations/c4Fixture.ts
src/test/fixtures/notations/archimateFixture.ts
src/test/fixtures/notations/dcrFixture.ts
src/test/fixtures/notations/eventModelingFixture.ts

Each fixture should contain stable IDs and the minimum graph needed to exercise its semantics. Do not use production databases or random generators in visual tests. Large performance fixtures may be generated from a fixed seed.

10. Delivery sequence

The work is split into small pull requests. Phases 0 and 1 build safeguards and compatibility. Every later phase opts in exactly one notation/view contract at a time.

Phase 0 — Baseline and test harness

Purpose: establish what “no regression” means before extracting code.

Work:

Verify that urgent ADR PR 0A from section 4 is accepted and its contract tests are green.

Document the current geometry matrix by view and node subtype.

Add deterministic notation fixture builders.

Add React renderer test infrastructure and the React Flow test wrapper.

Add the Playwright visual gallery and baseline screenshots.

Add the 100/1,000/1,500-node benchmark and record results for the reviewed baseline commit.

Turn the existing behavior of getConceptNodeSize(), ReactFlowCanvas fallback dimensions, and rendered widths into tests, including tests that expose their current disagreement.

Characterize selection padding, relation visibility, edge anchors, and hidden-handle pointer behavior.

RED: Add tests for the agreed geometry contract. Some should expose the 240/288 mismatch and stale selected-scale padding.

GREEN: This phase does not “fix” those tests by changing visuals. Mark known mismatches as focused contract TODOs linked to Phase 1, while all characterization and harness tests pass.

REFACTOR: Consolidate test-only builders and remove nondeterminism from fixtures.

Exit criteria:

The replacement ADR is accepted and both conflicting ADRs are explicitly superseded.

Every notation has at least one stable visual fixture.

Existing critical interactions are characterized.

A reproducible performance baseline is stored with runner details.

There are no production rendering changes.

Phase 1 — Common contracts and compatibility adapter

Purpose: introduce shared geometry/routing policy without migrating any notation wholesale.

Work:

Make src/constants/grid.ts the only source of the grid constant.

Add pure grid and measured-bounds helpers.

Add optional NotationCanvasPolicy contracts.

Add legacy adapter functions that reproduce current per-view branches.

Change ReactFlowCanvas and NotationCanvasWrapper to ask the adapter for initial geometry, relation visibility, containment, and routing choices.

Keep current view-type switches inside the legacy adapter temporarily; do not scatter new switches.

Remove the stale selected-node scale padding after its characterization test is converted to the agreed behavior.

Make renderer and canvas widths agree according to the ADR, without altering notation content.

RED: Contract tests for precedence, grid alignment, container behavior, relation visibility, and stable selection bounds.

GREEN: Implement the helpers and adapter with identical screenshots apart from explicitly approved geometry bug fixes.

REFACTOR: Centralize magic fallback dimensions behind named legacy policies and document their planned removal.

Exit criteria:

No new view.type checks are added to ReactFlowCanvas or NotationCanvasWrapper.

All existing and new routing/layout tests pass.

Every dimension is traceable to measured data, stored data, notation policy, or a named legacy fallback.

Approved geometry fixes have focused before/after screenshots.

The 1,500-node benchmark remains within budget.

Phase 2 — Shared floating handles; migrate Conceptual Model

Why first: Conceptual Model is the simplest fixed-width leaf-card renderer and has no specialized container renderer. It is the safest proof that the common contracts work.

Reuse introduced/adopted:

FloatingEdgeHandles.

Common initial/measured geometry resolution.

Common selection/focus interaction contract.

Existing shared floating-edge routing.

Keep Conceptual-specific:

Concept type badge and wording.

Name/definition presentation.

Emerald semantic treatment unless design explicitly changes it.

Conceptual validator, allowed relations, inspector, and quick actions.

Content-height thresholds if the ADR chooses fixed tiers; otherwise content measurement.

Tests before changing renderer:

Short, medium, and long name/definition cases.

Selected/unselected geometry equality.

Source/target handle registration.

Representative relation and label.

Quick-action creation in each supported direction.

Visual snapshots for long content and selection.

RED: Opt-in policy contract test and renderer tests.

GREEN: Opt Conceptual Model into the policy and handle primitive.

REFACTOR: Remove only the Conceptual paths from the legacy adapter. Evaluate, but do not yet generalize, a minimal node interaction frame.

Exit criteria: Conceptual has no geometry or relation-visibility dependence on a view.type === 'conceptual_model' branch in shared canvas code.

Phase 3 — Migrate Information Model

Important coupling: Information and Logical share a renderer. Add Logical characterization tests before touching that renderer, even though only the Information view opts into the new policy in this phase.

Reuse adopted:

Floating handles and geometry precedence.

Common interaction frame only if Phase 2 proved it remains minimal.

Common edge routing and label behavior.

Keep Information-specific:

Class, datatype, enumeration headers and colors.

Property/enumerator content and count-driven presentation.

Information-model terminology, validation, relation availability, and inspector behavior.

Any subtype-specific height policy.

Tests:

Class with zero, one, three, and five properties.

Enumeration with short and long value lists.

Datatype card.

Long property names and overflow behavior.

Relations between representative subtypes.

Information validator tests remain unchanged.

Logical renderer screenshots remain unchanged as a cross-view safety check.

RED/GREEN/REFACTOR: Follow the same sequence as Phase 2; remove only Information policy fallbacks. Refactor shared core-model markup only when Conceptual and Information tests demonstrate an identical mechanic.

Exit criteria: Information opts into common policy; Logical still works through its explicit compatibility path; neither view has an unapproved visual diff.

Phase 4 — Migrate Logical Data Model

Why separate despite the shared renderer: The code path can be reused, but the view registration, labels, allowed concepts, validators, and product acceptance are independently important.

Reuse adopted:

The tested Information presentation components where semantics match.

Common geometry, handles, selection, and edges.

Keep Logical-specific:

Logical view identity and terminology.

Logical validator/schema constraints and relation availability.

Any inspector or quick-action differences.

Tests:

A contract test proves the Logical view resolves its own notation and canvas policy.

Representative logical entity, attribute/property, datatype, and enumeration cases.

Cross-view test verifies opening the same model in Information then Logical does not retain the previous view's policy.

Separate visual snapshots labelled Logical, even where pixels intentionally match Information.

Exit criteria: Logical is explicitly opted in; no core-model view depends on legacy geometry branches.

Phase 5 — Migrate Knowledge Graph

Why here: It adds a generic grouping boundary and currently uses the 240 px sizing helper, so it validates that shared policy supports a second width profile without turning 240 px into a global default.

Reuse adopted:

Common grid and measured geometry.

Floating handles.

Generic edge intersection, selection, labels, and hit areas.

Low-level container bounds mechanics, if already tested.

Keep Knowledge Graph-specific:

Generic concept presentation and ontology-independent labels.

Grouping boundary markup and grouping semantics.

Explorer/force-layout behavior and any Knowledge Graph-specific LOD.

Relation visibility and generic edge styling.

Tests:

Leaf width policy and measured content height.

Grouping boundary saved/measured dimensions.

Parent/child drag behavior.

Generic concept and relation labels.

Force/auto-layout path if used by this view.

1,500-node performance case, because this is a likely large-graph view.

Exit criteria: Knowledge Graph uses its own explicit geometry profile; its boundary never inherits leaf dimensions; large-graph performance is not degraded.

Phase 6 — Migrate C4

Reuse adopted:

Common geometry/handle/selection mechanics.

Generic container bounds and resize plumbing.

Common edge path, hit area, label, and orthogonal segment behavior.

Keep C4-specific:

Person, software system, container, and component semantics.

External-element detection and styling.

C4 hierarchy and permitted containment.

Boundary label/shape and nesting rules.

C4-specific relation line style, including dashed relations where applicable.

C4 validator, inspector, and quick actions.

Tests:

Every supported C4 node subtype, internal and external variants.

System/container boundary sizing, nesting, move, and resize.

Valid and invalid containment.

Solid/dashed edge policy and label.

Quick action creates the correct subtype at a grid-aligned location.

Edge endpoints remain on visible boundary before and after selection.

Exit criteria: All C4 branches in the shared canvas have moved to its policy; no universal boundary component contains C4 terminology.

Phase 7 — Migrate ArchiMate

Reuse adopted:

Common mechanics and container bounds.

Common edge route representation and interaction.

Keep ArchiMate-specific:

Layer/type icons, colors, shapes, and stereotypes.

Grouping concept and containment rules.

Allowed ArchiMate relations and validation.

Layer-sensitive quick actions and inspector behavior.

Any ArchiMate-specific relation styling.

Tests:

At least one representative node from every supported layer/category.

A table-driven test for type-to-visual-token mapping.

Grouping bounds and child movement.

A table-driven test for allowed/invalid relations.

Long labels on at least two distinct shapes.

Selection does not replace semantic layer color.

Visual gallery covering the representative layer matrix.

Exit criteria: ArchiMate semantic variation is still implemented in ArchiMate code; the common layer knows nothing about its layers or stereotypes.

Phase 8 — Migrate DCR

Why late: DCR combines graph rendering with executable simulation state and specialized SVG markers. It has more behavior at risk than a normal architecture card.

Reuse adopted:

Common geometry, handles, selection/focus, bounds, and edge interaction.

Container mechanics for subprocesses only where they match tested generic mechanics.

Keep DCR-specific:

Event state presentation: included, executed, pending, enabled, and disabled semantics.

Role/principal capsules.

Subprocess semantics and boundary content.

DCR simulation controls and state transitions.

Condition, response, include, exclude, milestone, and other DCR edge markers/colors.

DCR validator and relation availability.

Tests:

Node visuals for each meaningful simulation-state combination.

Simulation commands update only the expected nodes/edges.

Role/principal and subprocess renderers.

Every DCR relation maps to the correct marker, line style, and direction.

Marker IDs remain unique when multiple canvases are mounted.

Start/step/reset simulation integration test.

Visual screenshots for a compact simulation before and after one step.

Exit criteria: Simulation output and edge semantics are byte-for-byte or visually equivalent where expected; generic routing does not erase DCR markers.

Phase 9 — Migrate Event Modeling last

Purpose: adopt only proven common mechanics without flattening Event Modeling's layout model.

Reuse adopted:

Single grid constant and grid helpers.

Initial/measured geometry contract.

Floating-handle registration, if interaction tests prove compatibility.

Common low-level edge intersection, hit area, label selection, and segment representation.

Common selection/focus behavior where it does not interfere with lanes or containers.

Keep Event Modeling-specific:

Leaf-node width of 10 * GRID_SIZE.

Node subtype content, colors, icons, payload and lineage presentation.

Chapter, slice, swimlane, and lane-header rendering.

Opinionated chapter/slice placement and resize rules.

Same-slice versus cross-slice routing choices.

Gutter routing, including reserved corridors.

Payload expansion and absolute-position preservation.

Completeness calculations and warnings.

Event Modeling quick actions and directional creation rules.

Event Modeling validation.

Tests:

Contract test for exactly 10 * GRID_SIZE leaf width.

One renderer case for every Event Modeling node subtype.

Chapter/slice coordinates and dimensions remain grid-aligned according to the ADR.

Same-slice edge uses the intended top/bottom path.

Cross-slice/chapter edge uses the intended side/gutter path.

Manual positions survive payload collapse/expand and reload.

Child positions remain correct after moving/resizing a chapter or slice.

Completeness state and lineage remain correct.

Quick-action placement respects lanes and grid.

Full visual fixture with at least two chapters and multiple slices.

Performance fixture representative of a large Event Model.

RED: Lock current specialized behavior with unit, integration, and visual tests before replacing any handles or policy branches.

GREEN: Opt Event Modeling into shared geometry/handle/routing primitives one concern at a time. Keep its layout engine and routing strategy intact.

REFACTOR: Remove only duplicated low-level mechanics. Do not move chapter/slice logic into generic container code merely to reduce line count.

Exit criteria: Pixel and interaction parity for the approved Event Modeling fixtures; width remains 10 * GRID_SIZE; no other notation inherits Event Modeling layout rules.

Phase 10 — Remove legacy branches and simplify wrappers

Only after all registered views have policies:

Change NotationCanvasPolicy from optional to required.

Make the registry contract test fail if a notation omits a policy.

Remove getLegacyInitialGeometry and other compatibility functions.

Remove migrated view.type branches from ReactFlowCanvas and NotationCanvasWrapper.

Split the largest canvas functions by mechanical responsibility, not by notation.

Consider a canvas-wrapper factory only in a .tsx module that depends on both the notation and ReactFlowCanvas; do not place JSX or a circular runtime dependency in types.ts.

Remove dead constants and update architecture documentation.

Run the complete functional, visual, and performance suites.

Exit criteria:

Shared canvas code contains no notation-name checks except a documented transition or telemetry concern.

Every view is supplied entirely through registered policy and renderer composition.

No compatibility fallback remains.

Full build, tests, visual suite, and performance budget pass.

11. Per-notation acceptance matrix

Notation

Geometry gate

Semantic gate

Container/layout gate

Edge gate

High-risk regression

Conceptual

12-grid width; approved height behavior

name/definition/badge

N/A

representative conceptual relation

long-content overflow

Information

12-grid width; property-driven height

class/datatype/enumeration

N/A

subtype relations

property/enumerator list

Logical

explicit policy despite shared renderer

logical identity and constraints

N/A

logical relations

policy leaking from Information

Knowledge Graph

explicit 10-grid profile

generic concept presentation

grouping + large graph

generic relations

1,500-node performance

C4

12-grid leaves

subtype/external styling

nested boundaries

dashed/solid C4 styles

invalid containment

ArchiMate

12-grid leaves

layer/type visual matrix

grouping

allowed relation matrix

semantic colors flattened

DCR

event geometry by policy

simulation states, roles

subprocess

all semantic markers

simulation state or marker loss

Event Modeling

10-grid leaf width

all EM node types/payloads

chapter/slice/swimlane

same-slice and gutter routes

opinionated layout altered

12. Proposed notation-specific test files

Names may follow the repository's existing conventions, but coverage should be equivalent to this structure:

src/notations/knowledge-graph/__tests__/renderer.test.tsx
src/notations/knowledge-graph/__tests__/groupingIntegration.test.tsx

src/notations/core-model/__tests__/conceptualRenderer.test.tsx
src/notations/core-model/__tests__/informationRenderer.test.tsx
src/notations/core-model/__tests__/logicalPresentationContract.test.tsx

src/notations/c4/__tests__/renderer.test.tsx
src/notations/c4/__tests__/boundaryIntegration.test.tsx
src/notations/c4/__tests__/edgePresentation.test.ts

src/notations/archimate/__tests__/renderer.test.tsx
src/notations/archimate/__tests__/visualTokens.test.ts
src/notations/archimate/__tests__/groupingIntegration.test.tsx

src/notations/dcr/__tests__/renderer.test.tsx
src/notations/dcr/__tests__/simulationRendering.test.tsx
src/notations/dcr/__tests__/edgeMarkers.test.ts

src/notations/event-modeling/__tests__/renderer.test.tsx
src/notations/event-modeling/__tests__/geometryContract.test.ts
src/notations/event-modeling/__tests__/gutterRouting.test.ts
src/notations/event-modeling/__tests__/containerIntegration.test.tsx

Keep and extend the valuable existing tests for edgeRouting, GridAlignment, measured layout precedence, relation inclusion, Event Modeling layout/manual positioning/payload expansion/completeness, and the existing validators.

13. CI and quality gates

Add explicit scripts so developers and CI run the same layers:

npm run test:unit
npm run test:components
npm run test:integration
npm run test:visual
npm run test:perf:smoke
npm run test:perf:full

Required pull-request gates:

Lint and type checking.

Unit and component tests.

Canvas integration tests.

Production build.

Visual snapshots for the migrated notation plus shared primitives.

Performance smoke test whenever shared canvas, node, edge, or store selectors change.

Coverage policy:

Add @vitest/coverage-v8 and establish the current baseline first.

Ratchet repository-wide coverage upward; do not impose an arbitrary high threshold on untouched legacy code.

Require approximately 95% line/function and 90% branch coverage for new pure geometry/routing policy modules.

Require approximately 85% line and 80% branch coverage for new renderer interaction modules, supplemented by visual/integration tests.

A changed branch in shared routing or geometry must have a focused test even if aggregate coverage already passes.

14. Pull-request and rollback discipline

Each phase should normally be one pull request; split a phase if its diff becomes difficult to review.

Every pull request must contain:

The notation or shared concern being migrated.

The before-state characterization tests.

The implementation.

The relevant after-state tests and screenshots.

A statement of intended visual changes; “none” is a valid and preferred answer for migration PRs.

Targeted and full test commands run.

Performance result when shared rendering code changed.

A rollback note identifying the opt-in policy entry or commit that can be reverted.

Do not combine a notation migration with a broad redesign, dependency upgrade, or unrelated formatter pass. Approved UX harmonization should follow the mechanical migration in separate changes so reviewers can distinguish refactoring from design decisions.

15. Concrete implementation checklist

Foundation

Urgent PR 0A: supersede ADR 0006 and ADR 0007 with one executable geometry contract.

Correct all active/stale ADR references in source, tests, and documentation.

Confirm the geometry matrix, especially height rules by subtype.

Add deterministic fixture builders.

Add jsdom/Testing Library component infrastructure.

Add Playwright notation gallery and baseline images.

Capture current 100/1,000/1,500-node performance.

Add common policy and geometry contract tests.

Centralize grid arithmetic.

Introduce the optional policy and legacy adapter.

Fix geometry-source disagreement and stale selection padding with approved tests.

One-by-one migrations

Conceptual Model.

Information Model, while guarding shared Logical rendering.

Logical Data Model as an explicit view contract.

Knowledge Graph.

C4.

ArchiMate.

DCR.

Event Modeling last, retaining 10 * GRID_SIZE leaf width and specialized layout.

Final cleanup

Make canvas policy mandatory.

Delete all legacy fallbacks.

Remove notation-specific canvas switches.

Split oversized common modules by mechanical responsibility.

Update documentation and ADR links.

Run full functional, visual, accessibility, build, and performance gates.

16. Definition of done

The refactor is complete when:

Every registered view has an explicit canvas policy and renderer profile.

Shared canvas code no longer encodes notation names or semantic types.

Renderer, layout, and routing geometry agree for every representative node subtype.

Event Modeling leaf width is tested as 10 * GRID_SIZE, and its specialized chapter/slice behavior remains in its own modules.

Every notation has unit, renderer, integration, and visual coverage for its distinctive behavior.

Common geometry, handle, selection, and edge mechanics have focused contract tests.

No unapproved visual or interaction regressions exist.

The 1,500-node performance budget is maintained.

Legacy compatibility branches are removed only after all notation policies are active.

Future notations can be added by registering policy and presentation, without editing the shared canvas for ordinary cases.

17. Immediate next action

Start with urgent PR 0A, not with component extraction. Supersede ADR 0006 and ADR 0007, correct their references, and add executable contract tests for the chosen geometry rule. Then begin Phase 0 characterization, making the current 240/288 sizing disagreement and Event Modeling's 10 * GRID_SIZE width explicit. Once those tests are reviewed, the compatibility policy in Phase 1 creates a safe seam for the one-by-one migrations.