// packages/roles/src/delegation-tool.ts
import { defineTool } from "@deepseek-ai/dsh-tools";
import { z as z2 } from "zod";

// packages/roles/src/review.ts
import { z } from "zod";
var reviewEvidence = z.object({ requirements: z.string().trim().min(1), summary: z.string().trim().min(1), changedFiles: z.array(z.string()), validations: z.array(z.object({ command: z.string(), result: z.string() }).strict()), failures: z.array(z.string()), unrun: z.array(z.string()) }).strict();
var reviewJudgment = z.object({ judgment: z.enum(["pass", "needs-changes", "unable-to-judge"]), explanation: z.string().trim().min(1), evidence: z.array(z.string().trim().min(1)).min(1), additionalVerification: z.array(z.string().trim().min(1)) }).strict();

// packages/roles/src/delegation-tool.ts
import { brandString } from "@deepseek-ai/dsh-brand";
var request = z2.discriminatedUnion("action", [
  z2.object({ action: z2.literal("initial"), role: z2.literal("implementer"), prompt: z2.string().trim().min(1), context: z2.enum(["fresh", "fork"]).optional() }).strict(),
  z2.object({ action: z2.literal("status") }).strict(),
  z2.object({ action: z2.literal("stop"), cycleId: z2.string().uuid().transform((value) => brandString(value)) }).strict(),
  z2.object({ action: z2.literal("rework"), cycleId: z2.string().uuid().transform((value) => brandString(value)), prompt: z2.string().trim().min(1) }).strict(),
  z2.object({ action: z2.literal("review"), cycleId: z2.string().uuid().transform((value) => brandString(value)), evidence: reviewEvidence, context: z2.enum(["fresh", "fork"]).optional() }).strict(),
  z2.object({ action: z2.literal("complete"), cycleId: z2.string().uuid().transform((value) => brandString(value)) }).strict()
]);
var inject = ["tools", "studioDelegation"];
function apply(ctx) {
  ctx.effect(() => ctx.tools.register(defineTool({
    name: "studio_delegate",
    description: "Coordinate Studio cycles in the shared workspace. initial requires role implementer and prompt and creates a cycle. initial and the first review accept context fresh (default) or fork; fork inherits only completed parent turns and logs current-turn evidence separately. No cache reuse is guaranteed. status accepts only action and reads durable facts without waking children. review requires an owned settled cycleId and evidence: requirements, summary, changedFiles, validations with command/result, failures, and unrun checks; it creates one read/search-only reviewer using currently applied reviewer settings. Read the validated judgment and additionalVerification through status. Implementation completion or review pass does not complete the cycle. complete requires cycleId, a validated pass, and no pending additional verification. rework requires cycleId and prompt and wakes the existing implementer with its creation settings; every wake including verification-only uses one frozen cycle allowance (default two). After rework, review wakes the same reviewer with fresh evidence and a new judgment. Existing children never change context or settings. Cap exhaustion, active operations, or unknown acceptance stop the cycle: report the reason, do not retry blindly or create a replacement cycle. stop requires cycleId, freezes new admissions, and waits for current child work to drain. A stop request is not confirmed until durable execution evidence agrees; completed work is never described as rolled back. Model/effort/tool/identity/cap overrides are unsupported.",
    parameters: {
      action: { type: "string", required: true, enum: ["initial", "status", "review", "complete", "rework", "stop"] },
      role: { type: "string", enum: ["implementer"] },
      prompt: { type: "string" },
      context: { type: "string", enum: ["fresh", "fork"] },
      cycleId: { type: "string" },
      evidence: { type: "object", additionalProperties: false, properties: { requirements: { type: "string", required: true }, summary: { type: "string", required: true }, changedFiles: { type: "array", required: true, items: { type: "string" } }, validations: { type: "array", required: true, items: { type: "object", properties: { command: { type: "string", required: true }, result: { type: "string", required: true } }, additionalProperties: false } }, failures: { type: "array", required: true, items: { type: "string" } }, unrun: { type: "array", required: true, items: { type: "string" } } } }
    },
    output: { schema: { type: "string" }, render: (_args, value) => [{ type: "text", text: value }] },
    async execute(args, exec) {
      const parsed = request.parse(args);
      if (!exec.agent) throw new Error("studio-agent-required");
      if (parsed.action === "status") return JSON.stringify(ctx.studioDelegation.describe(exec.agent.id));
      if (parsed.action === "stop") return ctx.studioDelegation.stop(exec.agent, parsed.cycleId);
      if (parsed.action === "rework") return ctx.studioDelegation.rework(exec.agent, parsed.cycleId, parsed.prompt, exec.signal);
      if (parsed.action === "review" || parsed.action === "complete") {
        return ctx.studioDelegation.reviewCycle(exec.agent, parsed.cycleId, parsed.action === "review" ? parsed.evidence : void 0, exec.signal, parsed.action === "review" ? parsed.context : void 0);
      }
      return ctx.studioDelegation.initial(exec.agent, parsed.prompt, exec.signal, parsed.context);
    },
    presentCall: () => ({ card: "generic", title: "Studio delegation", kind: "other" })
  })));
}
export {
  apply,
  inject
};
