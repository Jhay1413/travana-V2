import { noteRepository } from "../repositories/note.repository";
import { AppError } from "../utils/error-handler";
import type { Note, InsertNote } from "../types/note";

export const noteService = {
  async listByQuoteId(quoteId: string): Promise<Note[]> {
    return await noteRepository.findByQuoteId(quoteId);
  },

  async createNote(data: InsertNote): Promise<Note> {
    const note = await noteRepository.create(data);
    return note;
  },

  async updateNote(id: string, content: string): Promise<Note> {
    const note = await noteRepository.update(id, content);
    if (!note) {
      throw new AppError("Note not found", 404);
    }
    return note;
  },

  async deleteNote(id: string): Promise<void> {
    await noteRepository.remove(id);
  },
};
