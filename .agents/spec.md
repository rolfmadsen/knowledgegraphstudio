# Specification: Inline Class & Attribute Editing in Payload Specification

## Overview
This specification defines inline editing capability inside the Event Modeling Node Payload Specification popover card. Users can edit Class names, Attribute names, and Attribute types directly within the popover card on the canvas without having to navigate to Zone 4 Inspector or the Information Model view.

## Functional Requirements

### 1. Inline Attribute Name Editing
- Clicking on an attribute name in the Payload Specification popover triggers inline editing mode (`editingAttrId === attr.id`).
- An input field replaces the static label.
- On `Enter` or `blur`:
  - For `class_attribute` with `attr.classId` and `attr.propertyId`: Calls `updateProperty(attr.classId, attr.propertyId, { name: newName })` to sync the Information Model Class property, and updates `attr.name` in node payload.
  - For `event_local` attributes: Updates `attr.name` in node payload (`updateConcept(nodeId, { payload: updatedPayload })`).

### 2. Inline Class Name Editing & Rebinding
- Clicking on the bound `Class.` badge/prefix (e.g., `OrgPerson.`):
  - In edit mode: Allows changing the Class name directly (`updateConcept(boundClass.id, { name: newClassName })`), updating the Information Model Class name globally across the model graph.
  - In rebind mode: Provides a dropdown to change class binding or switch to `event_local`.

### 3. Inline Type Editing
- Clicking on the type label (e.g. `string`, `number`, `boolean`) allows toggling or changing attribute data type inline.
