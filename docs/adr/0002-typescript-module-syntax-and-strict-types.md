# 0002: Strict Type-Safe Module Resolution (verbatimModuleSyntax)

## Status
accepted

## Context
For fast, predictable TypeScript compilation and runtime safety, we must avoid circular dependency issues and prevent type definitions from leaking into the compiled JavaScript runtime bundles.

## Decision
We enforce the following TypeScript coding standards across all production and test source files:

1. **TypeScript 6.0 and `verbatimModuleSyntax`:**
   * When importing or exporting types, the `type` keyword must be used explicitly (e.g. `import type { ConceptNode } from '../types'`). This ensures that the compiler completely omits type-only imports from the runtime output, avoiding side-effects.

2. **Strict Type Safety:**
   * The use of the `any` type is strictly forbidden in both production and test files.
   * If a type cannot be determined before runtime, use the `unknown` type and apply proper type-guards or schema validations.
   * Do not use unsafe typecast bypasses (such as `as any`) in tests or production code. Use proper type-narrowing (e.g., `if (cmd.action === 'addConcept')`) or mock objects conforming to the defined TypeScript interfaces.

## Consequences
* Improves compiler performance and keeps output JavaScript bundles clean of redundant declarations.
* Prevents type-coercion bugs and ensures code changes are type-checked at compile-time.
* Requires slightly more verbose import syntax and strict type definitions during test mock setups.
