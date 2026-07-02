/**
 * Agent CLIs log injected context (IDE state, system reminders, environment
 * descriptions, user-instructions blocks) as user-role entries whose text is
 * wrapped in a tag. Those are not the human speaking (ADR 0001 §5).
 */
export function isInjectedContent(text: string): boolean {
  return /^\s*<[a-z][\w-]*[\s>]/i.test(text)
}
