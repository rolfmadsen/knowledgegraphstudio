# Specification: Help Modal - Event Modeling Guide Tab

## 1. Overview & Motivation
Knowledge Graph Studio provides visual modeling for Event Modeling (EM) alongside DCR, C4, and ArchiMate. To help users learn and apply Event Modeling patterns and avoid common anti-patterns directly within the studio, we are adding a dedicated "Event Modeling" tab to the `HelpCenter` modal component.

---

## 2. Detailed Technical Requirements

### 2.1 Tab Navigation
- Add `'event-modeling'` (or `'em'`) as a tab in `HelpCenter.tsx`.
- Tab label: `"Event Modeling"`.
- Render a new button next to "Shortcuts", "Git Guide", and "DCR Guide".

### 2.2 Content Sections

#### Section 1: Core Elements
Display cards/badges representing the 6 EM elements:
1. **Screen** (white / light UI trigger)
2. **Command** (blue box / user intent)
3. **Domain Event** (yellow/amber box / state change recorded)
4. **Read Model** (green box / view representation)
5. **Integration Event** (purple/amber box / external boundary event)
6. **Automation** (teal/rose box / reactive trigger)

#### Section 2: 4 Event Model Patterns
Display 4 structured pattern cards with visual step flows (e.g. `Screen → Command → Domain Event(s)`):
1. **State Change Pattern**: `Screen → Command → Domain Event(s)`
   - Description: Describes a state change and its way from the start (trigger) to the end (state change). White box (Screen) -> blue box (Command) -> yellow box(es) (Event).
2. **State View Pattern**: `Domain Event(s) → Read Model`
   - Description: Connects existing events from the board to a green “Read Model (View)” box. Gives quick overview of what information will be used by it.
3. **Automation Pattern**: `Domain Event(s) → Read Model → Automation → Command → Domain Event(s)`
   - Description: Use whenever the system should do something automatically. Combined State Change and State View Pattern with an automated trigger in the middle.
4. **Translation Pattern (System integration)**: `Integration Event → Automation → Command → Integration Event`
   - Description: Used for transferring knowledge between systems. External Integration Event triggers Automation that issues Command to produce outgoing Integration Event. External data can also populate Read Models directly for visualization.

#### Section 3: The 4 Anti-Patterns (Overcomplication)
Display 4 warning/anti-pattern cards:
1. **The Left Chair**: `Screen → Command → Domain Event + Domain Event + Domain Event...`
   - One command triggering too many events. Business logic crammed into one place instead of separate state changes.
2. **The Right Chair**: `Domain Event + Domain Event + Domain Event → Read Model`
   - Many events feeding into a single read model (View). Indicates a 'Summary View' that knows everything, potentially creating high coupling.
3. **The Bed**: `Screen → Command + Command + Command`
   - One UI component firing multiple commands in sequence. Front-end orchestration instead of event flow handling sequence.
4. **The Bookshelf**:
   - One slice contains all business rules/logic (Given-When-Thens), while others are anemic. 'God-Object' in visual form where one slice does everything.

---

## 3. Verification Plan
- Verify unit tests pass (`npm run test`).
- Verify visual UI correctness in HelpCenter.
