# Coding Standards: TypeScript & React

This repository follows the **Google TypeScript Style Guide** and modern **Functional React & Clean Architecture** principles.

---

## 1. Type Safety & TypeScript Disciplines
- **Strict Mode:** Code must compile with `strict: true` and zero compiler warnings.
- **No `any`:** `any` is strictly prohibited. Use `unknown` combined with type narrowing, type predicates (`is`), or validation libraries (`zod`) at runtime I/O boundaries.
- **Interfaces vs Types:** Use `interface` for public API object shapes and extensible contracts; use `type` for unions, intersections, tuple types, and utility types.
- **Discriminated Unions:** Model state machines and mutually exclusive states using discriminated unions (e.g. `{ status: 'success'; data: T } | { status: 'error'; error: Error }`) rather than parallel optional boolean flags.

## 2. React & Component Architecture
- **Functional Components:** All components must be pure functional components with explicit props interfaces (`interface ButtonProps { ... }`).
- **Custom Hooks for Logic:** JSX templates must remain declarative presentation layers. Extract non-trivial business logic, asynchronous state, and side-effects into custom hooks (`use[Feature]`).
- **Component File Budget:** Components should stay focused and ideally under 150 lines. Decompose complex UIs into smaller, single-responsibility sub-components.
- **Pure Render & Side-Effects:** Avoid side-effects during render. All side-effects belong in `useEffect` or event handlers.

## 3. Immutability & State Management
- **Immutability First:** Prefer `const` over `let`. Never mutate props or state objects directly; use shallow copies or immutable updates.
- **Explicit Exports:** Use explicit named exports for components, functions, and types. Avoid `export default` except where required by file-system routing.
- **Readonly Parameters:** Mark parameters as `readonly` when they are not intended to be mutated.

## 4. Error Handling & Async
- **Predictable Async:** Always handle Promise rejections. Avoid unhandled floating promises (`void asyncFn()`).
- **Error Boundaries:** Wrap component sub-trees in Error Boundaries to gracefully catch rendering crashes without bringing down the entire application.

## 5. Documentation & TSDoc Standards
- **TSDoc Documentation Standard:** All exported functions, hooks, interfaces, and component props MUST be documented with TSDoc tags (`@param`, `@returns`, `@throws`, `@example`).
- **Self-Documenting Types:** Do not write comments that merely rephrase type signatures. Document semantic invariants and edge-case behavior.

## 6. Concrete DO / DON'T Examples

### ❌ DON'T (Anti-pattern: `any`, bloated component with inline async side-effects)
```tsx
// ❌ any type, mutable let, unhandled async in render
export default function UserCard(props: any) {
  let [data, setData] = React.useState<any>(null);
  React.useEffect(() => {
    fetch('/api/user/' + props.id).then(r => r.json()).then(d => setData(d));
  }, [props.id]);
  return <div>{data?.name}</div>;
}
```

### ✅ DO (Idiomatic: Typed props interface, custom hook, TSDoc, discriminated union)
```tsx
import React from 'react';

/** State model for asynchronous user profile loading. */
export type UserState =
  | { status: 'idle' | 'loading' }
  | { status: 'success'; profile: UserProfile }
  | { status: 'error'; error: Error };

export interface UserProfile {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export interface UserCardProps {
  /** The unique user identifier to display. */
  readonly userId: string;
  /** Optional callback fired when the profile card is clicked. */
  readonly onSelect?: (userId: string) => void;
}

/**
 * Custom hook to manage user profile fetching and lifecycle state.
 *
 * @param userId - Unique identifier for the user.
 * @returns Discriminated union state representing loading, success, or error.
 */
export function useUserProfile(userId: string): UserState {
  const [state, setState] = React.useState<UserState>({ status: 'idle' });

  React.useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });

    fetch(`/api/users/${encodeURIComponent(userId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load user: ${res.statusText}`);
        return res.json();
      })
      .then((profile: UserProfile) => {
        if (isMounted) setState({ status: 'success', profile });
      })
      .catch((error: Error) => {
        if (isMounted) setState({ status: 'error', error });
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return state;
}

/**
 * Presentational component rendering user profile details.
 */
export const UserCard: React.FC<UserCardProps> = ({ userId, onSelect }) => {
  const state = useUserProfile(userId);

  if (state.status === 'loading') return <div>Loading profile...</div>;
  if (state.status === 'error') return <div role="alert">{state.error.message}</div>;
  if (state.status !== 'success') return null;

  return (
    <article onClick={() => onSelect?.(userId)} className="user-card">
      <h3>{state.profile.name}</h3>
      <p>{state.profile.email}</p>
    </article>
  );
};
```
