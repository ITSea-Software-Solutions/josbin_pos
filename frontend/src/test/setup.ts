// Vitest global setup.
//
// `@testing-library/jest-dom` is referenced here for DOM matchers
// (e.g. `.toBeInTheDocument()`) used by component tests. It's not in
// package.json yet, so import it lazily via a dynamic expression — pure
// store / library tests don't need it and shouldn't fail to bootstrap
// because of a missing optional dep. Component tests that need these
// matchers should install it with:
//   npm i -D @testing-library/jest-dom
const jestDomModule = '@testing-library/jest-dom'
try {
  // Indirect specifier prevents Vite's static import-analysis from
  // resolving the path at config time.
  await import(/* @vite-ignore */ jestDomModule)
} catch {
  // jest-dom not installed — skip silently.
}
