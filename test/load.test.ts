import { expect, it } from "bun:test"

// Load smoke test: the opencode plugin loader requires a default export with an id and an
// effect (or setup) function. A missing default export fails the load silently at runtime.
it("the package default export has an id and an effect function", async () => {
  const m = await import("../src/index.ts")
  expect(m.default).toBeDefined()
  expect(m.default.id).toBe("opencode.doom.loop")
  expect(typeof m.default.effect).toBe("function")
})
