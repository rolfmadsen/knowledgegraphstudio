# Compiler Specifications Reference

This document serves as a reference for the core APIs and schema structures used by the Event Modeling + DCR Compiler Engine to generate compliant specifications.

---

## OpenAPI Specification (v3.1.0)

URL: https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.0.md

### Core OpenAPI Structure
The compiler targets OpenAPI 3.1.0 with JSON Schema 2020-12 support. Key structural elements:
- **`openapi`**: `"3.1.0"`
- **`info`**: Dynamically extracted from View (`name`, `description`) and Domain.
- **`paths`**: Map of endpoints aggregated by path (e.g. `/api/v1/orders`).
  - **`get`** (from ReadModel): Query operations returning response payload schemas.
  - **`post`/`put`** (from IntegrationEvent): Ingress / Webhook operations receiving request payloads.
  - **`post`/`put`** (from Command): Action operations executing user / client intent.
- **`components`**: Reusable schemas and parameters.
- **Path Parameters**: Automatically extracted from path templates (e.g. `{orderId}`).

### Event Modeling & Integration Mapping Rules
- **Read Model Nodes:** Generate a `GET` operation at `endpointPath` (or derived path `/queries/kebab-name`). The response schema is derived from the Read Model's `payload` or `properties` array.
- **Integration Event Nodes:** Generate `POST`/`PUT` operations at `endpointPath` (or derived path `/events/kebab-name`) representing ingress / webhook data ingestion boundaries.
- **Command Nodes:** Generate `POST`/`PUT` operations at `endpointPath` (or derived path `/commands/kebab-name`). The request body is derived from the Command's `payload` or `properties` array.
- **Gherkin Policies:** Added to the endpoint's `description` field formatted cleanly in Markdown:
  ```gherkin
  Scenario: [Scenario Name]
    Given [Given conditions]
    When [When actions]
    Then [Then expected outcomes]
  ```

---

## AsyncAPI Specification (v3.0.0)

URL: https://github.com/asyncapi/spec/blob/master/spec/asyncapi.md

### Core AsyncAPI Structure
AsyncAPI describes event-driven architectures and message channels.
- **`asyncapi`**: `"3.0.0"`
- **`info`**: Metadata describing the event broker ecosystem.
- **`channels`**: Map of topics or channels (e.g., `orders.v1`).
- **`operations`**: Actions that clients can perform on channels.
  - **`send`**: Send message to channel (produced by Command/Event).
  - **`receive`**: Receive message from channel (consumed by ReadModel/Automation).
- **`components`**: Reusable schemas and messages.

### Event Modeling Mapping Rules
- **Event Nodes:** Generate an AsyncAPI channel under `channels` using `properties.topicName` or derived semantic name.
- **Publishers:** If a `Command` triggers a `DomainEvent`, the swimlane/actor owning the command defines a `send` operation.
- **Subscribers:** If a `DomainEvent` feeds a `ReadModel` or triggers an `Automation`, the swimlane/actor owning the target node defines a `receive` operation.
- **Messages:** Message payload is derived from the Event's `properties` array.

---

## Arazzo Specification

URL: https://github.com/OAI/Arazzo-Specification

### Core Arazzo Structure
Arazzo chains OpenAPI/AsyncAPI calls into logical workflows representing user journeys or business processes.
- **`arazzo`**: `"1.0.1"`
- **`info`**: Workflow meta-information.
- **`sourceDescriptions`**: Links to the OpenAPI/AsyncAPI specifications used in the workflow.
- **`workflows`**: Array of workflows.
  - **`id`**: Unique workflow ID.
  - **`steps`**: Array of steps to execute sequentially.
    - **`stepId`**: Unique identifier for the step.
    - **`operationId`**: Ref to an OpenAPI operation.
    - **`parameters`**: Request payload or parameters.
    - **`successCriteria`**: Assertions (e.g., `$statusCode == 200` or JSONPath rules).
    - **`dependsOn`**: Optional list of prerequisite step IDs.

### DCR Mapping Rules
- **DCR Conditions (`has_condition`):** Maps to `dependsOn` or pre-conditions. The target step will list the source step in its `dependsOn` field.
- **DCR Responses (`has_response`):** Chains steps in sequence. If Step A triggers a Response to Step B, Step B is added as a follow-up step in the workflow.
- **Success Criteria:** Assertions derived from Gherkin `Then` clauses or Read Model response definitions.
