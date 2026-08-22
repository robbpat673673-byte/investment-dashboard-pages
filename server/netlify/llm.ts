type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type NetlifyLLMResult = {
  choices: Array<{ message: { content?: string | null } }>;
};

/** Calls an OpenAI-compatible chat-completions endpoint from a Netlify Function. */
export async function invokeNetlifyLLM(input: { model?: string; messages: ChatMessage[] }): Promise<NetlifyLLMResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY 尚未設定");

  const endpoint = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1/chat/completions";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? input.model ?? "gpt-5-mini", messages: input.messages }),
  });
  if (!response.ok) throw new Error(`外部 LLM 呼叫失敗：${response.status} ${await response.text()}`);
  return (await response.json()) as NetlifyLLMResult;
}

