import { hubPostRepository } from './hub-post.repository';
import { AppError } from '../../utils/error-handler';

export const hubPostService = {
  async findAll(userId?: string) {
    return hubPostRepository.findAll(userId);
  },

  async create(data: any) {
    return hubPostRepository.create(data);
  },

  async remove(id: string, userId: string, userRole: string) {
    const post = await hubPostRepository.findById(id);
    if (!post) throw new AppError('Post not found', 404);
    if (post.authorId !== userId && userRole !== 'admin' && userRole !== 'manager') {
      throw new AppError('Not authorized', 403);
    }
    await hubPostRepository.remove(id);
  },

  async hide(postId: string, userId: string) {
    const post = await hubPostRepository.findById(postId);
    if (!post) throw new AppError('Post not found', 404);
    await hubPostRepository.hide(postId, userId);
  },

  async toggleLike(postId: string, userId: string) {
    return hubPostRepository.toggleLike(postId, userId);
  },

  async addComment(postId: string, authorId: string, authorName: string, text: string) {
    return hubPostRepository.addComment(postId, authorId, authorName, text);
  },
};
