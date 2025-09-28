// OpenAI integration layer with graceful fallback when no API key provided.
// NOTE: In a purely client-side app, exposing an API key is insecure. For production,
// proxy these calls through a backend to protect secrets.

export interface GeneratedQuestion { prompt: string; }
export interface ScoredAnswer { score: number; feedback: string; }
export interface GeneratedSummary { summary: string; }

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const model = 'gpt-4.1-mini'; // adjust as needed

function getKey(): string | undefined {
  return import.meta.env.VITE_OPENAI_API_KEY;
}

async function callOpenAI(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, opts: Partial<{ temperature: number; max_tokens: number }> = {}) {
  const apiKey = getKey();
  if (!apiKey) return null; // signal fallback
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.max_tokens ?? 256
    })
  });
  if (!res.ok) {
    console.warn('OpenAI request failed', await res.text());
    return null;
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  return content || null;
}

export async function generateQuestionAI(difficulty: string, exclude: string[] = []): Promise<GeneratedQuestion> {
  // Try up to 3 times to avoid duplicates (basic guard)
  for (let attempt = 0; attempt < 3; attempt++) {
    const content = await callOpenAI([
      { role: 'system', content: 'You generate concise single interview questions for a React + Node full stack engineer.' },
      { role: 'user', content: `Provide ONE ${difficulty} difficulty question. Avoid these duplicates: ${exclude.join(' | ')}. Just the question text.` }
    ], { temperature: 0.8, max_tokens: 120 });
    const prompt = (content || `[Fallback] Provide an ${difficulty} React/Node question about core concepts (variation ${attempt + 1}).`).replace(/^"|"$/g, '');
    if (!exclude.includes(prompt.trim())) {
      return { prompt };
    }
  }
  // Final fallback with suffix if still duplicate
  return { prompt: `[Fallback] Provide an ${difficulty} React/Node question about core concepts (unique ${Date.now() % 1000}).` };
}

export async function scoreAnswerAI(question: string, answer: string): Promise<ScoredAnswer> {
  const content = await callOpenAI([
    { role: 'system', content: 'You are an interview evaluator. Respond ONLY with JSON: {"score":0-100,"feedback":"short"}' },
    { role: 'user', content: `Question: ${question}\nAnswer: ${answer}\nEvaluate.` }
  ], { temperature: 0.2, max_tokens: 120 });
  if (!content) {
    const heuristic = Math.min(100, Math.round(answer.length / 4));
    return { score: heuristic, feedback: 'Fallback heuristic score (no AI key).' };
  }
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { score: parsed.score ?? 0, feedback: parsed.feedback ?? 'No feedback' };
    }
  } catch (e) {
    console.warn('Failed to parse AI score JSON', e);
  }
  return { score: 0, feedback: 'Unable to parse AI response' };
}

export async function generateSummaryAI(transcript: string, avgScore: number): Promise<GeneratedSummary> {
  const content = await callOpenAI([
    { role: 'system', content: 'You create concise candidate summaries (<=60 words). Output plain text only.' },
    { role: 'user', content: `Average Score: ${avgScore}. Transcript: ${transcript}\nProvide summary.` }
  ], { temperature: 0.5, max_tokens: 120 });
  if (!content) {
    return { summary: `Fallback summary based on score ${avgScore}. Candidate shows ${(avgScore > 70 ? 'strong' : avgScore > 40 ? 'developing' : 'introductory')} knowledge.` };
  }
  return { summary: content.replace(/\n+/g, ' ').trim() };
}
