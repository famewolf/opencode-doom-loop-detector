# Manual end-to-end verification

This recipe runs the plugin inside a real opencode process against a stub model that always emits the same tool call. It is intentionally manual: it needs a local opencode install and writes to its npm cache, so it is not part of CI.

## 1. Stub model

Save this as `stub.ts`. It is an OpenAI-compatible SSE endpoint that always returns the same `read` call.

```ts
Bun.serve({
  port: 8787,
  fetch(req) {
    if (req.method !== "POST") return new Response("ok")
    const chunk = (delta: object, finish: string | null = null) =>
      `data: ${JSON.stringify({ id: "stub", object: "chat.completion.chunk", created: 0, model: "stub-model", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
    const body =
      chunk({ role: "assistant" }) +
      chunk({ tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "read", arguments: '{"path":"README.md"}' } }] }) +
      chunk({}, "tool_calls") +
      "data: [DONE]\n\n"
    return new Response(body, { headers: { "content-type": "text/event-stream" } })
  },
})
console.log("stub on 8787")
```

Start it with `bun stub.ts`.

## 2. Project setup

In a scratch project, create `opencode.jsonc`:

```jsonc
{
  "plugin": ["opencode-doom-loop-detector"],
  "provider": {
    "stub": {
      "npm": "@ai-sdk/openai-compatible",
      "options": { "baseURL": "http://127.0.0.1:8787/v1" },
      "models": { "stub-model": {} }
    }
  },
  "model": "stub/stub-model"
}
```

Create a `README.md` in that project so the `read` calls succeed.

## 3. Run

```bash
opencode run "read the file"
```

The model will repeat the same `read` call forever. Expected:

- **Signal A**: after six identical outputs, the next emission raises a `doom_loop` permission ask (in headless mode the ask is auto-resolved; the loop is still detected and the permission is evaluated).
- **Signal C**: if the file does not exist, the fourth identical failure appends the warning "The read tool has failed 4 times in a row with the same error. Stop retrying it unchanged. Inspect the target or ask the user before trying again."
- The plugin loads without any `failed to load plugin` entry in the opencode log (`~/.local/share/opencode/log/opencode.log`).

## Notes

- The npm cache can hold an older build after an update. If the plugin fails to load with "Missing key at default", remove `~/.cache/opencode/npm/opencode-doom-loop-detector@*` and reinstall with `opencode plugin add opencode-doom-loop-detector`.
- Argument-validation failures (for example a missing `path` argument) are deliberately not counted into signal C.
