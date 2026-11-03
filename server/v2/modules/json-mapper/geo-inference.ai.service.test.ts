import { beforeEach, describe, expect, it, vi } from 'vitest';

const { create, recordAiUsage } = vi.hoisted(() => ({ create: vi.fn(), recordAiUsage: vi.fn() }));

vi.mock('../../utils/ai-model', () => ({
  CHAT_MODEL: 'test-chat-model',
  getOpenAI: () => ({ chat: { completions: { create } } }),
}));
vi.mock('../usage/usage.service', () => ({ usageService: { recordAiUsage } }));

import { geoInferenceAiService } from './geo-inference.ai.service';

const reply = (content: string) => ({
  choices: [{ message: { content } }],
  usage: { prompt_tokens: 100, completion_tokens: 20 },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('geoInferenceAiService.inferHierarchy', () => {
  it('returns the validated hierarchy, sends only the context facts, and records usage', async () => {
    create.mockResolvedValue(reply('{"country":"Canada","destination":"Toronto","resort":"Toronto"}'));

    const result = await geoInferenceAiService.inferHierarchy(
      { accommodation: 'Chelsea Hotel, Toronto', arrivalAirportName: 'Toronto Pearson', quoteTitle: 'City break' },
      'org-1',
    );

    expect(result).toEqual({ country: 'Canada', destination: 'Toronto', resort: 'Toronto' });
    const body = create.mock.calls[0][0];
    expect(JSON.parse(body.messages[1].content)).toEqual({
      accommodation: 'Chelsea Hotel, Toronto',
      arrival_airport: 'Toronto Pearson',
      title: 'City break',
    });
    expect(recordAiUsage).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-1', feature: 'scraper_geo' }));
  });

  it('treats an all-null answer as no inference', async () => {
    create.mockResolvedValue(reply('{"country":null,"destination":null,"resort":null}'));
    expect(await geoInferenceAiService.inferHierarchy({ accommodation: 'Grand Hotel' })).toBeNull();
  });

  it('normalises blank and over-long names to null', async () => {
    create.mockResolvedValue(reply(JSON.stringify({ country: 'Canada', destination: '  ', resort: 'x'.repeat(200) })));
    expect(await geoInferenceAiService.inferHierarchy({ accommodation: 'Chelsea Hotel' })).toEqual({
      country: 'Canada',
      destination: null,
      resort: null,
    });
  });

  it('returns null for invalid JSON and API errors without throwing', async () => {
    create.mockResolvedValueOnce(reply('not json'));
    expect(await geoInferenceAiService.inferHierarchy({ accommodation: 'A' })).toBeNull();
    create.mockRejectedValueOnce(new Error('timeout'));
    expect(await geoInferenceAiService.inferHierarchy({ accommodation: 'A' })).toBeNull();
  });
});
