import OpenAI from "openai";

/**
 * AI client — uses the OpenAI-compatible API format so it works with:
 *   - Ollama (local)        → http://localhost:11434/v1
 *   - vLLM (self-hosted)    → http://localhost:8000/v1
 *   - Together AI           → https://api.together.xyz/v1
 *   - OpenRouter             → https://openrouter.ai/api/v1
 *   - OpenAI / Anthropic    → their native endpoints
 */
export const ai = new OpenAI({
  baseURL: process.env.AI_BASE_URL || "http://localhost:11434/v1",
  apiKey: process.env.AI_API_KEY || "not-needed-for-ollama",
});

export const AI_MODEL = process.env.AI_MODEL || "llama3.1:8b";

// ─── Prompt templates ────────────────────────────────────────────────

export const PROMPTS = {
  marketResearch: (title: string, description: string) => `
You are a senior market research analyst. Analyze the following idea and produce a structured market research report.

**Idea:** ${title}
**Description:** ${description}

Return a JSON object with these keys:
{
  "marketSize": "estimated TAM/SAM/SOM",
  "targetAudience": ["audience segment 1", ...],
  "trends": ["relevant trend 1", ...],
  "opportunities": ["opportunity 1", ...],
  "risks": ["risk 1", ...],
  "verdict": "one paragraph summary"
}
Return ONLY valid JSON, no markdown.`,

  competitorAnalysis: (title: string, description: string) => `
You are a competitive intelligence analyst. Identify competitors for the following idea.

**Idea:** ${title}
**Description:** ${description}

Return a JSON object:
{
  "directCompetitors": [{"name": "...", "description": "...", "strengths": [...], "weaknesses": [...]}],
  "indirectCompetitors": [{"name": "...", "description": "...", "overlap": "..."}],
  "differentiators": ["what makes this idea unique"],
  "moatPotential": "assessment of defensibility"
}
Return ONLY valid JSON, no markdown.`,

  technicalRoadmap: (title: string, description: string) => `
You are a senior software architect. Create a technical roadmap for this idea.

**Idea:** ${title}
**Description:** ${description}

Return a JSON object:
{
  "techStack": {"frontend": "...", "backend": "...", "database": "...", "infrastructure": "..."},
  "phases": [
    {"name": "Phase 1 - MVP", "duration": "...", "deliverables": [...], "tasks": [...]},
    {"name": "Phase 2 - Growth", "duration": "...", "deliverables": [...], "tasks": [...]}
  ],
  "estimatedCost": "...",
  "teamSize": "...",
  "repoStructure": {"directories": [{"path": "...", "purpose": "..."}]}
}
Return ONLY valid JSON, no markdown.`,

  generateEmbedding: (text: string) => text,
};

/**
 * Call the AI model and parse JSON response.
 */
export async function aiComplete(prompt: string): Promise<unknown> {
  const response = await ai.chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content ?? "{}";

  // Try to extract JSON from the response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  return JSON.parse(content);
}
