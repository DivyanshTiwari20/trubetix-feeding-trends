import type { SocialPost, SocialComment } from '../types';

export interface SocialDataProvider {
  discoverPosts(entity: string, opts: { platforms: string[]; range: string; limit?: number }): Promise<SocialPost[]>;
  getPost?(platform: string, postId: string): Promise<SocialPost | null>;
  getComments?(platform: string, postId: string, limit?: number): Promise<SocialComment[]>;
}
