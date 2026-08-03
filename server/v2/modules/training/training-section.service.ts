import { trainingSectionRepository } from './training-section.repository';
import { trainingService } from './training.service';
import type { ScopeOrTrusted } from './training.repository';
import { AppError } from '../../utils/error-handler';
import type { TrainingSection, InsertTrainingSection } from '@shared/schema';
import type { CreateSectionInput, UpdateSectionInput, SectionReorderEntry } from './training.types';

export async function getSectionOrThrow(sectionId: string): Promise<TrainingSection> {
  const section = await trainingSectionRepository.findSectionById(sectionId);
  if (!section) throw new AppError('Section not found', 404);
  return section;
}

export const trainingSectionService = {
  async createSection(courseId: string, input: CreateSectionInput, scope: ScopeOrTrusted): Promise<TrainingSection> {
    await trainingService.assertCourseEditable(courseId, scope);

    const position = input.position ?? (await trainingSectionRepository.getNextSectionPosition(courseId));

    const data: InsertTrainingSection = {
      course_id: courseId,
      title: input.title,
      description: input.description ?? null,
      position,
    };

    return trainingSectionRepository.createSection(data);
  },

  async updateSection(sectionId: string, input: UpdateSectionInput, scope: ScopeOrTrusted): Promise<TrainingSection> {
    const section = await getSectionOrThrow(sectionId);
    await trainingService.assertCourseEditable(section.course_id, scope);

    const patch: Partial<InsertTrainingSection> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description ?? null;
    if (input.position !== undefined) patch.position = input.position;

    const updated = await trainingSectionRepository.updateSection(sectionId, patch);
    if (!updated) throw new AppError('Section not found', 404);
    return updated;
  },

  /**
   * Deleting a section cascades to its lessons (and their assets, progress and
   * quizzes) plus the section's own quiz — same irreversible cascade shape as
   * deleting a course.
   */
  async deleteSection(sectionId: string, scope: ScopeOrTrusted): Promise<void> {
    const section = await getSectionOrThrow(sectionId);
    await trainingService.assertCourseEditable(section.course_id, scope);
    await trainingSectionRepository.deleteSection(sectionId);
  },

  /** Persist a new position for every section in `order`; all ids must belong to `courseId`. */
  async reorderSections(courseId: string, order: SectionReorderEntry[], scope: ScopeOrTrusted): Promise<TrainingSection[]> {
    await trainingService.assertCourseEditable(courseId, scope);

    const sections = await trainingSectionRepository.listSectionsByCourseId(courseId);
    const validIds = new Set(sections.map((s) => s.id));
    for (const entry of order) {
      if (!validIds.has(entry.id)) {
        throw new AppError(`Section ${entry.id} does not belong to this course`, 400);
      }
    }

    await trainingSectionRepository.reorderSections(order);
    return trainingSectionRepository.listSectionsByCourseId(courseId);
  },
};
