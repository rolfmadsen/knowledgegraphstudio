# Event Modeling Spatial Relationships & Keyboard Navigation

This document explains the structural layout, semantic relationships, and spatial keyboard controls configured for the **Event Modeling (EM)** notation in Knowledge Graph Studio.

---

## 1. Swimlane Layout & Rows

In Event Modeling, views are arranged chronologically from **left to right** using Slices, and elements are categorized into horizontal swimlanes based on their row indexes:

| Row Index | Element Type | Description |
| :---: | :--- | :--- |
| **0** | `screen` | UI Wireframe / Frontend Presentation |
| **1** | `command` | User Intent / Action |
| **2** | `event` | Domain Event / Historical Fact |
| **3** | `read_model` | View projection for querying |
| **4** | `integration_event` | External system input/output |
| **5** | `automation` | Sagas / Process Managers |

---

## 2. Toolbar Spatial Quick Actions & Sibling Slices

When an element is selected, context-aware toolbar buttons appear at different sides (`Top`, `Right`, `Bottom`, `Left`) depending on what semantic connections are valid in `validator.ts`. 

If a transition crosses the boundary of the current slice (e.g. write-side to read-side), a new sibling slice is created automatically either to the left or right, and the new element is positioned inside it.

Here is the exhaustive mapping of quick actions for each element type:

### Screen (Row 0)
* **Bottom**: `command` (direction: `source-to-target`, parent: `same-parent`) — User triggers command from screen.
* **Left**: `read_model` (direction: `target-to-source`, parent: `sibling-slice-left`) — Screen displays query projections from previous step.

### Command (Row 1)
* **Top**: `screen` (direction: `target-to-source`, parent: `same-parent`) — Screen that invokes the command.
* **Top**: `automation` (direction: `target-to-source`, parent: `sibling-slice-left`) — Parent automation that triggers command chronologically.
* **Bottom**: `event` (direction: `source-to-target`, parent: `same-parent`) — Command triggers domain event.
* **Right**: `integration_event` (direction: `source-to-target`, parent: `same-parent`) — Command emits integration event.

### Event (Row 2)
* **Top**: `command` (direction: `target-to-source`, parent: `same-parent`) — Command that triggered this event.
* **Bottom**: `automation` (direction: `source-to-target`, parent: `sibling-slice`) — Event triggers automation in a new slice.
* **Left**: `read_model` (direction: `source-to-target`, parent: `sibling-slice-left`) — Event feeds read model to the left.
* **Right**: `read_model` (direction: `source-to-target`, parent: `sibling-slice`) — Event feeds read model to the right (view projection).
* **Right**: `integration_event` (direction: `source-to-target`, parent: `same-parent`) — Event emits integration event to the right.
* **Left**: `event` (direction: `target-to-source`, parent: `sibling-slice-left`) — Chronologically previous event in storyline.
* **Right**: `event` (direction: `source-to-target`, parent: `sibling-slice`) — Chronologically next event in storyline.

### Read Model (Row 3)
* **Right**: `screen` (direction: `source-to-target`, parent: `sibling-slice`) — Read model displays data on next screen.
* **Right**: `automation` (direction: `source-to-target`, parent: `sibling-slice`) — Read model triggers automation.
* **Right**: `integration_event` (direction: `source-to-target`, parent: `sibling-slice`) — Read model emits integration event to the right.
* **Left**: `event` (direction: `target-to-source`, parent: `sibling-slice-left`) — Event that feeds this projection.
* **Left**: `integration_event` (direction: `target-to-source`, parent: `sibling-slice-left`) — Integration event that feeds this projection.

### Integration Event (Row 4)
* **Left**: `command` (direction: `target-to-source`, parent: `same-parent`) — Command that triggered it.
* **Left**: `event` (direction: `target-to-source`, parent: `sibling-slice-left`) — Event that triggered it.
* **Left**: `read_model` (direction: `target-to-source`, parent: `sibling-slice-left`) — Read model that triggered it.
* **Right**: `read_model` (direction: `source-to-target`, parent: `sibling-slice`) — Feeds read model in next step.
* **Bottom**: `automation` (direction: `source-to-target`, parent: `sibling-slice`) — Triggers automation.

### Automation (Row 5)
* **Left**: `event` (direction: `target-to-source`, parent: `sibling-slice-left`) — Triggering domain event.
* **Left**: `read_model` (direction: `target-to-source`, parent: `sibling-slice-left`) — Triggering read model.
* **Left**: `integration_event` (direction: `target-to-source`, parent: `sibling-slice-left`) — Triggering integration event.
* **Right**: `command` (direction: `source-to-target`, parent: `sibling-slice`) — Emits command in next step.

---

## 3. Keyboard Navigation Controls

Knowledge Graph Studio includes spatial keyboard control overlays for quick actions:

1. **Focus Node**: Navigate between canvas nodes using standard `Arrow Keys`.
2. **Focus Toolbar**: Press `CTRL + Arrow Keys` to jump focus from the selected node into its active directional toolbars.
   * `CTRL + ArrowUp/Down/Left/Right` shifts focus ring outline to the next closest quick action button.
   * Press `CTRL + ArrowLeft/Right` inside the bottom toolbar to navigate between Delete, Link, and Plus buttons.
3. **Execute**: Press `Enter` when a toolbar button is focused to run the action (e.g. creating the node in a sibling slice and selecting it).
4. **Dismiss**: Press `Escape` to unfocus the toolbar and return focus to the selected node.
