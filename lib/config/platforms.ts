export const SOCIAL_PLATFORMS = [
  { id: 'reddit', label: 'Reddit', site: 'reddit.com', weight: 1, urlPattern: /reddit\.com/ },
  { id: 'twitter', label: 'X/Twitter', site: 'x.com', weight: 1, urlPattern: /x\.com|twitter\.com/ },
  { id: 'instagram', label: 'Instagram', site: 'instagram.com', weight: 1, urlPattern: /instagram\.com/ },
  { id: 'youtube', label: 'YouTube', site: 'youtube.com', weight: 1, urlPattern: /youtube\.com|youtu\.be/ },
  { id: 'linkedin', label: 'LinkedIn', site: 'linkedin.com', weight: 1, urlPattern: /linkedin\.com/ },
  { id: 'news', label: 'News/Web', site: '', weight: 1, urlPattern: /.*/ },
] as const;

export type PlatformId = typeof SOCIAL_PLATFORMS[number]['id'];
