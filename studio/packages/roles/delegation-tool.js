// packages/roles/src/delegation-tool.ts
import { defineTool } from "@deepseek-ai/dsh-tools";
import { z } from "zod";
var request = z.discriminatedUnion("action", [
  z.object({ action: z.literal("initial"), role: z.literal("implementer"), prompt: z.string().trim().min(1), context: z.literal("fresh").optional() }).strict(),
  z.object({ action: z.literal("status") }).strict()
]);
var inject = ["tools", "studioDelegation"];
function apply(ctx) {
  ctx.effect(() => ctx.tools.register(defineTool({
    name: "studio_delegate",
    description: "Start a fresh implementer using applied Studio roles, or read this session\u2019s recorded status without waking children. Initial requires role implementer and prompt; status accepts only action. The workspace is shared. No model, effort, tool, ID overrides, or later actions.",
    parameters: {
      action: { type: "string", required: true, enum: ["initial", "status"] },
      role: { type: "string", enum: ["implementer"] },
      prompt: { type: "string" },
      context: { type: "string", enum: ["fresh"] }
    },
    output: { schema: { type: "string" }, render: (_args, value) => [{ type: "text", text: value }] },
    async execute(args, exec) {
      const parsed = request.parse(args);
      if (!exec.agent) throw new Error("studio-agent-required");
      if (parsed.action === "status") return JSON.stringify(ctx.studioDelegation.describe(exec.agent.id));
      return ctx.studioDelegation.initial(exec.agent, parsed.prompt, exec.signal);
    },
    presentCall: () => ({ card: "generic", title: "Studio delegation", kind: "other" })
  })));
}
export {
  apply,
  inject
};
