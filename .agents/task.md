# Task: Implement Focus Mode Container Scoping

## TDD Implementation Checklist

- [ ] `[ ]` Write failing unit test in `src/store/__tests__/selectors.focus.test.ts` verifying 1-level child expansion for selected containers (Chapter shows Slices without grandchildren; Slice shows Chapter + Slice + direct inner nodes).
- [ ] `[ ]` Run the test command and verify it fails (**RED** phase).
- [ ] `[ ]` Update `useFocusedGraph` in `src/store/selectors.ts` to perform 1-level child expansion for selected container nodes and preserve parent container ancestry.
- [ ] `[ ]` Run the test command and verify it passes (**GREEN** phase).
- [ ] `[ ]` Refactor and ensure all test suites remain green (**REFACTOR** phase).
