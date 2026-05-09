import OpenAI from 'openai';
import { noteRepository } from '../note/note.repository';

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI API key is not configured');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const SYSTEM_PROMPT =
  'You are a travel expert and you have been asked a question which you need to answer with any relevant information. Be concise but thorough. Use UK English, GBP for prices, and focus on practical advice useful to a UK-based travel agency. Use simple markdown (short paragraphs, bullet points where helpful). Do not invent facts you are not confident about.';

export const aiAskService = {
  async ask(question: string): Promise<string> {
    const trimmed = (question || '').trim();
    if (!trimmed) throw new Error('Question is required');
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: trimmed }],
      temperature: 0.6,
      max_tokens: 1200,
    });
    const content = response.choices[0]?.message?.content?.trim();
    if (!content) throw new Error('Failed to generate answer');
    return content;
  },

  async saveToClient(params: { clientId: string; question: string; answer: string; agentId?: string | null }) {
    const { clientId, question, answer, agentId } = params;
    if (!clientId) throw new Error('clientId is required');
    if (!question?.trim() || !answer?.trim()) throw new Error('Question and answer are required');
    const description = `Ask AI: ${question.trim().slice(0, 120)}`;
    const content = `Q: ${question.trim()}\n\nA: ${answer.trim()}`;
    return noteRepository.create({ description, content, client_id: clientId, agent_id: agentId || null } as any);
  },
};
