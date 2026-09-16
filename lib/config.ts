import { Clock, Lightbulb, Files } from 'lucide-react';
export { SOCIAL_PLATFORMS } from './config/platforms';

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
