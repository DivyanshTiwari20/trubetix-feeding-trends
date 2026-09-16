export type EntityType = 'celebrity' | 'actor' | 'musician' | 'influencer' | 'politician' | 'brand' | 'company' | 'public_figure' | 'organization' | 'general';

export interface EntityProfile {
  type: EntityType;
  label: string;
  weights: Record<string, number>;
}

const DEFAULT_WEIGHTS = { instagram: 1, youtube: 1, twitter: 1, reddit: 1, linkedin: 1, news: 1 };

export const ENTITY_PROFILES: Record<EntityType, EntityProfile> = {
  general: { type: 'general', label: 'General', weights: DEFAULT_WEIGHTS },
  celebrity: { type: 'celebrity', label: 'Celebrity', weights: { instagram: 1.5, youtube: 1.3, twitter: 1.1, news: 1, reddit: 1, linkedin: 0.7 } },
  actor: { type: 'actor', label: 'Actor', weights: { instagram: 1.5, youtube: 1.3, twitter: 1.1, news: 1, reddit: 1, linkedin: 0.7 } },
  musician: { type: 'musician', label: 'Musician', weights: { instagram: 1.4, youtube: 1.4, twitter: 1.1, news: 1, reddit: 1, linkedin: 0.7 } },
  influencer: { type: 'influencer', label: 'Influencer', weights: { instagram: 1.5, youtube: 1.3, twitter: 1, news: 0.8, reddit: 1, linkedin: 0.8 } },
  politician: { type: 'politician', label: 'Politician', weights: { twitter: 1.5, news: 1.4, youtube: 1, reddit: 1.2, instagram: 0.8, linkedin: 1 } },
  brand: { type: 'brand', label: 'Brand', weights: { news: 1.3, instagram: 1.2, twitter: 1.2, reddit: 1.2, youtube: 1, linkedin: 1.1 } },
  company: { type: 'company', label: 'Company', weights: { news: 1.3, linkedin: 1.3, twitter: 1.1, reddit: 1.1, instagram: 0.9, youtube: 0.9 } },
  public_figure: { type: 'public_figure', label: 'Public Figure', weights: DEFAULT_WEIGHTS },
  organization: { type: 'organization', label: 'Organization', weights: { news: 1.3, linkedin: 1.2, twitter: 1.1, reddit: 1, instagram: 0.9, youtube: 0.9 } },
};

export function getEntityProfile(type?: string): EntityProfile {
  const key = (type?.toLowerCase().replace(/[\s-]/g, '_') ?? 'general') as EntityType;
  return ENTITY_PROFILES[key] ?? ENTITY_PROFILES.general;
}

export function getPlatformWeight(entityType: string | undefined, platformId: string): number {
  const profile = getEntityProfile(entityType);
  return profile.weights[platformId] ?? 1;
}
