# Specification: Information Completeness Check & Class/Attribute Binding in Event Modeling

## 1. Overview & Business Value
This feature introduces **Information Completeness Checking** (Information Flow Completeness) to Event Modeling views, bridging static **Information Model Views** (Classes & Attributes) with dynamic **Event Model Views** (Screens, Commands, Events, Read Models).

It enables users to:
1. Bind fields in Event Model nodes (Command, Event, ReadModel, Screen) to Information Model `Class` attributes or define Event-Local attributes.
2. Automatically validate that all data displayed on Screens or projected by Read Models originates from a preceding Domain Event on the timeline.
3. Rapidly create new Classes and Attributes directly within the Event Model view without context switching.

---

## 2. Architecture & Data Schema Changes

### 2.1 Schema Extensions (`src/schema/graphSchema.ts`)

```typescript
/**
 * Scope of a payload attribute in an Event Modeling node
 */
export const PayloadAttributeScope = z.enum(['class_attribute', 'event_local']);
export type PayloadAttributeScope = z.infer<typeof PayloadAttributeScope>;

/**
 * PayloadAttribute — Property entry attached to a Command, Event, ReadModel, or Screen payload
 */
export const PayloadAttributeSchema = z.object({
  id: z.string(),                             // Unique ID within node payload
  name: z.string().min(1),                    // Attribute name, e.g., "totalBeløb"
  type: DataType,                             // Data type, e.g., "number", "string", or ElementId
  isRequired: z.boolean().optional(),         // Is attribute required in payload?
  scope: PayloadAttributeScope,               // 'class_attribute' | 'event_local'
  classId: ElementId.optional(),              // Bound Information Model Class ElementId
  propertyId: ElementId.optional(),           // Bound ConceptProperty ElementId (if class_attribute)
});
export type PayloadAttribute = z.infer<typeof PayloadAttributeSchema>;
```

---

## 3. Completeness Engine & Rules (`src/notations/event-modeling/completeness.ts`)

### 3.1 Timeline Flow Analysis
Given an Event Modeling View $V$ with ordered slices $S_1, S_2, \dots, S_n$:

1. **State Accumulator $\mathcal{S}(t)$**:
   - For each slice $S_k$ in chronological story order:
   - For each `DomainEvent` or `IntegrationEvent` in $S_k$, add all payload attributes $(Class, PropertyName)$ to $\mathcal{S}(t_k)$.

2. **Validation Rule 1: Read-Side Lineage (ReadModel / Screen)**
   - For every attribute $A$ on a `ReadModel` or `Screen` at slice $S_m$:
   - Check if $A \in \mathcal{S}(t_{m-1})$.
   - If missing $\rightarrow$ Flag **`MISSING_EVENT_SOURCE`** (Error).

3. **Validation Rule 2: Write-Side Ingestion (Screen $\rightarrow$ Command $\rightarrow$ Event)**
   - For every attribute $A$ in a `DomainEvent` at slice $S_k$:
   - Verify that the invoking `Command` (and preceding `Screen`) supplies attribute $A$.
   - If missing $\rightarrow$ Flag **`UNSUPPLIED_COMMAND_FIELD`** (Warning).

4. **Validation Rule 3: Information Model Class Coverage**
   - Compare attributes of defined Information Model `Classes` with attributes used in the Event Model.
   - Unreferenced attributes $\rightarrow$ Flag **`CLASS_COVERAGE_GAP`** (Info).

---

## 4. UI/UX Component Requirements

### 4.1 Zone 4 Inspector Panel (`src/features/properties/Inspector.tsx`)
- Add **Payload Editor** section for Event Modeling nodes.
- Class Combobox to bind/create target Class.
- Attribute Checklist to toggle existing Class properties.
- Inline "+ Add Attribute" with "Promote to Class" vs "Event-Local" toggle.

### 4.2 Zone 2 ReactFlow Canvas Node Cards (`src/notations/event-modeling/index.tsx`)
- Display payload fields directly inside node card headers.
- Visual badge indicators for node completeness:
  - 🟢 **Complete**
  - 🔴 **Missing Upstream Source**
  - 🟡 **Unused Emitted Attribute**

### 4.3 Zone 3 Command Hub Integration (`src/features/commands/`)
- Add shortcut command `/payload <Class>.<Property>` to bind or create payload attributes quickly.

---

## 5. Verification Plan

### Automated Tests
- Unit tests for `PayloadAttributeSchema` parsing and validation.
- Engine tests for `completeness.ts` verifying timeline accumulation, missing source errors, and unsupplied command warnings.
- Layout and component tests for Inspector Payload Editor rendering.

### Manual Verification
- Create an Event Model diagram with a Screen, Command, Domain Event, and Read Model.
- Verify missing attribute errors appear when Read Model includes fields not emitted by prior events.
- Test inline Class and Attribute creation from Zone 4 Inspector.
