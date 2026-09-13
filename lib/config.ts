import { Clock, Lightbulb, Files } from 'lucide-react';

export const SOCIAL_PLATFORMS = [
  { id: 'reddit', label: 'Reddit', site: 'reddit.com' },
  { id: 'twitter', label: 'X/Twitter', site: 'x.com' },
  { id: 'instagram', label: 'Instagram', site: 'instagram.com' },
  { id: 'youtube', label: 'YouTube', site: 'youtube.com' },
  { id: 'linkedin', label: 'LinkedIn', site: 'linkedin.com' },
] as const;

export const PROMPT_CARDS = [
  {
    icon: Clock,
    title: 'Synthesize Data',
    desc: 'Turn my meeting notes into 5 key bullet points for the team.',
  },
  {
    icon: Lightbulb,
    title: 'Creative Brainstorm',
    desc: 'Generate 3 taglines for a new sustainable fashion brand.',
  },
  {
    icon: Files,
    title: 'Check Facts',
    desc: 'Compare key differences between GDPR and CCPA.',
  },
] as const;
