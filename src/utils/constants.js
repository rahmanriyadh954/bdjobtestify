// ═══ BD JobTestify — Application Constants ═══

export const SITE_NAME = 'BD JobTestify';
export const SITE_TAGLINE = 'Bangladesh Government Job Exam Preparation';
export const SITE_DESCRIPTION =
    'Practise for BCS, Bank, NTRCA, Primary and other Bangladesh government job exams with daily and weekly model tests, instant results and AI-assessed written answers.';

export const SYSTEM_ROLES = { ADMIN: 'admin', STUDENT: 'student' };

export const SUBJECT_CATEGORIES = [
    'Bangla',
    'English',
    'Mathematics',
    'General Knowledge (Bangladesh)',
    'General Knowledge (International)',
    'General Science',
    'ICT / Computer',
    'Mental Ability',
    'Geography & Environment',
    'History',
    'Constitution & Civics',
    'Current Affairs',
];

export const DIFFICULTY_LEVELS = [
    { value: 'easy',   label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard',   label: 'Hard' },
];

export const QUESTION_TYPES = [
    { value: 'mcq',     label: 'Multiple Choice (MCQ)' },
    { value: 'written', label: 'Written / Descriptive' },
];

// Used only by the AI Generate panel, where asking for a mix of both types
// in one batch is meaningful. The single-question editor keeps QUESTION_TYPES
// above, since one question can't be "both".
export const AI_QUESTION_TYPES = [
    { value: 'mcq',     label: 'Multiple Choice (MCQ)' },
    { value: 'written', label: 'Written / Descriptive' },
    { value: 'mixed',   label: 'Both MCQ & Written' },
];

// Used only by the AI Generate panel's subject dropdown, so a teacher can
// generate a mixed-subject batch without picking one subject first.
export const ALL_SUBJECTS_OPTION = 'All Subjects';

export const AI_LANGUAGES = [
    { value: 'auto',    label: 'Match the subject' },
    { value: 'bangla',  label: 'Bangla' },
    { value: 'english', label: 'English' },
];

export const EXAM_TYPES = [
    { value: 'regular', label: 'Regular Model Test' },
    { value: 'daily',   label: 'Daily Exam' },
    { value: 'weekly',  label: 'Weekly Exam' },
];

export const TOPIC_SUGGESTIONS = {
    'Bangla': ['ব্যাকরণ', 'সাহিত্য', 'সন্ধি বিচ্ছেদ', 'সমাস', 'বাগধারা', 'কারক ও বিভক্তি', 'প্রকৃতি ও প্রত্যয়'],
    'English': ['Grammar', 'Vocabulary', 'Prepositions', 'Tense', 'Voice & Narration', 'Synonyms & Antonyms', 'Idioms & Phrases'],
    'Mathematics': ['Arithmetic', 'Algebra', 'Geometry', 'Percentage', 'Profit & Loss', 'Average', 'Time & Work'],
    'General Knowledge (Bangladesh)': ['Liberation War 1971', 'Language Movement', 'Rivers of Bangladesh', 'Economy', 'Constitution', 'Culture & Heritage'],
    'General Knowledge (International)': ['United Nations', 'World Capitals', 'International Organizations', 'Sports', 'Awards & Prizes'],
    'General Science': ['Physics', 'Chemistry', 'Biology', 'Human Body', 'Environment', 'Space Science'],
    'ICT / Computer': ['Computer Fundamentals', 'Internet & Networking', 'MS Office', 'Programming Basics', 'Cyber Security', 'Databases'],
    'Mental Ability': ['Number Series', 'Analogy', 'Coding-Decoding', 'Logical Reasoning', 'Puzzles', 'Direction Sense'],
    'Geography & Environment': ['Climate', 'Natural Disasters', 'Maps', 'Continents & Oceans', 'Natural Resources'],
    'History': ['Ancient Bengal', 'British Period', 'Pakistan Period', 'World History', 'Mughal Empire'],
    'Constitution & Civics': ['Constitution of Bangladesh', 'Fundamental Rights', 'Government Structure', 'Local Government'],
    'Current Affairs': ['National News', 'International News', 'Sports', 'Economy', 'Science & Technology'],
};

export const DEFAULT_EXAM_SETTINGS = {
    timeLimit: 30, passMarks: 40,
    negativeMarking: false, negativeValue: 0.25,
};
