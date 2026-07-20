import { noteRepository } from '../note/note.repository';
import { clientRepository } from '../client/client.repository';
import { AppError } from '../../utils/error-handler';
import { getOpenAI } from '../../utils/ai-model';
import { usageService } from '../usage/usage.service';
import type { Note } from '@shared/schema';
import type { Scope } from '../../utils/scope';

const SYSTEM_PROMPT =
  'You are a travel expert and you have been asked a question which you need to answer with any relevant information. Be concise but thorough. Use UK English, GBP for prices, and focus on practical advice useful to a UK-based travel agency. Use simple markdown (short paragraphs, bullet points where helpful). Do not invent facts you are not confident about.';

export const aiAskService = {
  // `orgId` is server-derived (getScope(req).orgId) and only used for usage
  // metering — it never affects the answer itself.
  async ask(question: string, orgId?: string): Promise<string> {
    const trimmed = (question || '').trim();
    if (!trimmed) throw new AppError('Question is required', 400);
    const model = 'gpt-4o';
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: trimmed }],
      temperature: 0.6,
      max_tokens: 1200,
    });

    if (orgId && response.usage) {
      void usageService.recordAiUsage({
        orgId,
        feature: 'ai_ask',
        model,
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          cachedTokens: response.usage.prompt_tokens_details?.cached_tokens,
        },
      });
    }

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) throw new AppError('Failed to generate answer', 502);
    return content;
  },

  async saveToClient(params: {
    clientId: string;
    question: string;
    answer: string;
    agentId?: string | null;
    scope: Scope;
  }): Promise<Note> {
    const { clientId, question, answer, agentId, scope } = params;
    if (!clientId) throw new AppError('clientId is required', 400);
    if (!question?.trim() || !answer?.trim()) throw new AppError('Question and answer are required', 400);

    // Guard against cross-org writes: the client must resolve within the
    // caller's scope before we attach a note to it.
    const client = await clientRepository.findById(clientId, scope);
    if (!client) throw new AppError('Client not found', 404);

    const description = `Ask AI: ${question.trim().slice(0, 120)}`;
    const content = `Q: ${question.trim()}\n\nA: ${answer.trim()}`;
    return noteRepository.create({ description, content, client_id: clientId, agent_id: agentId || null });
  },
};
