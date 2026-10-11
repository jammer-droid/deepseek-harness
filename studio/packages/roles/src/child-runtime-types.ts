/** Studio child request and accepted-message ownership. */
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { MessageId } from '@deepseek-ai/dsh-llm';
import type { SubagentStartRequest, SubagentResult } from '@deepseek-ai/dsh-subagent';

/** Studio's reserved child and creation-time request. */
export interface ChildStart {
  provider: string;
  label: string;
  childId: SessionId;
  signal: AbortSignal;
  request: Omit<SubagentStartRequest, 'label' | 'signal'>;
}
/** Accepted message with optional caller-owned terminal observation. */
export interface ChildReceipt {
  messageId: MessageId;
  completion?: { result: Promise<SubagentResult>; dispose(): Promise<void> };
}
