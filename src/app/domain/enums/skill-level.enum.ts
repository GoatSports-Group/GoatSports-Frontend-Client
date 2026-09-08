export enum SkillLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  PRO = 'PRO'
}

export const SKILL_LEVEL_OPTIONS = [
  { value: SkillLevel.BEGINNER, label: 'Mới bắt đầu' },
  { value: SkillLevel.INTERMEDIATE, label: 'Trung bình' },
  { value: SkillLevel.ADVANCED, label: 'Nâng cao' },
  { value: SkillLevel.PRO, label: 'Chuyên nghiệp' }
] as const;
