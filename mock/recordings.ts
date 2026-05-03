import type {
  Recording,
  WeekStats,
  WatchState,
  PatternAlert,
  InsightTrend,
} from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function energyArc(
  shape: 'peak-early' | 'peak-late' | 'consistent' | 'fade' | 'volatile'
): { position: number; level: number }[] {
  const points = 24;
  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    let level: number;
    switch (shape) {
      case 'peak-early':
        level = Math.round(30 + 65 * Math.exp(-3 * (t - 0.2) ** 2) + (Math.random() - 0.5) * 10);
        break;
      case 'peak-late':
        level = Math.round(25 + 70 * Math.exp(-4 * (t - 0.8) ** 2) + (Math.random() - 0.5) * 10);
        break;
      case 'consistent':
        level = Math.round(60 + (Math.random() - 0.5) * 20);
        break;
      case 'fade':
        level = Math.round(80 - 55 * t + (Math.random() - 0.5) * 10);
        break;
      case 'volatile':
        level = Math.round(40 + 50 * Math.sin(t * Math.PI * 3) + (Math.random() - 0.5) * 20);
        break;
    }
    return { position: Math.round(t * 100), level: Math.max(5, Math.min(100, level)) };
  });
}

// ─── Mock Recordings ─────────────────────────────────────────────────────────

export const MOCK_RECORDINGS: Recording[] = [
  {
    id: 'rec_001',
    timestamp: new Date('2026-05-03T14:32:00'),
    duration: 512,
    title: 'Investor Call — Series A Update',
    summary:
      "You dominated the narrative but left their hardest question hanging. They noticed.",
    tags: [
      { emoji: '😤', label: 'Passionate', type: 'emotion' },
      { emoji: '💡', label: 'In Flow', type: 'emotion' },
      { emoji: '📊', label: 'Fundraising', type: 'topic' },
    ],
    talkRatio: 74,
    keyTopics: ['ARR growth', 'Burn rate', 'Team scaling', 'Product roadmap'],
    energyArc: energyArc('fade'),
    wordCount: 2103,
    questionsAsked: 2,
    speakingPace: 187,
    fillerWordCount: 11,
    repeatedThemes: [
      { theme: 'product-market fit', count: 4 },
      { theme: 'team', count: 3 },
      { theme: 'Q3 targets', count: 3 },
    ],
    confidenceIndex: 82,
    confidenceIndexDelta: 12,
    energyArcLabel: 'Strong start, momentum lost after minute 5',
    toneBreakdown: [
      { emoji: '😤', label: 'Passionate', percentage: 45 },
      { emoji: '💡', label: 'In Flow', percentage: 30 },
      { emoji: '🤔', label: 'Uncertain', percentage: 25 },
    ],
    moments: [
      {
        id: 'mom_001_1',
        startTimeSeconds: 222,
        type: 'confidence',
        title: 'Confidence peak',
        description: 'Clean, declarative delivery. No hedging, no fillers.',
        quote: "We hit 40% month-over-month growth for the past two quarters.",
      },
      {
        id: 'mom_001_2',
        startTimeSeconds: 435,
        type: 'hesitation',
        title: 'Hesitation spike',
        description: '4 filler words in 30 seconds — burn rate question landed harder than expected.',
        quote: "Um, yeah, so, the burn... the burn rate is, uh, something we're actively managing.",
      },
      {
        id: 'mom_001_3',
        startTimeSeconds: 487,
        type: 'deflection',
        title: 'Question deflected',
        description: "They asked about runway. You pivoted to growth narrative without answering.",
        quote: "What's more relevant here is the trajectory we're on...",
      },
    ],
    questionsAnalysis: [
      {
        question: "What's your current thinking on the product roadmap?",
        insight: "Framed as curiosity but used to steer away from financial scrutiny. Agenda-setting move.",
      },
      {
        question: "Is team size a concern for you?",
        insight: "Defensive framing — you anticipated this objection and tried to defuse it preemptively.",
      },
    ],
    actionItems: [
      'Send updated burn rate model by Friday',
      'Share cap table with full dilution analysis',
    ],
  },
  {
    id: 'rec_002',
    timestamp: new Date('2026-05-02T10:15:00'),
    duration: 738,
    title: 'Sales Call — Enterprise Prospect (Deel)',
    summary:
      "You asked zero discovery questions in the first 8 minutes. They were waiting to be understood.",
    tags: [
      { emoji: '🤔', label: 'Uncertain', type: 'emotion' },
      { emoji: '💼', label: 'Sales', type: 'topic' },
      { emoji: '⚡', label: 'High Stakes', type: 'behavior' },
    ],
    talkRatio: 68,
    keyTopics: ['Compliance automation', 'Pricing', 'Security review', 'Timeline'],
    energyArc: energyArc('peak-late'),
    wordCount: 2891,
    questionsAsked: 4,
    speakingPace: 162,
    fillerWordCount: 23,
    repeatedThemes: [
      { theme: 'our platform', count: 6 },
      { theme: 'pricing', count: 4 },
      { theme: 'integration', count: 3 },
    ],
    confidenceIndex: 61,
    confidenceIndexDelta: -9,
    energyArcLabel: 'Slow to warm — found your footing in the final third',
    toneBreakdown: [
      { emoji: '🤔', label: 'Uncertain', percentage: 40 },
      { emoji: '💼', label: 'Formal', percentage: 35 },
      { emoji: '💡', label: 'In Flow', percentage: 25 },
    ],
    moments: [
      {
        id: 'mom_002_1',
        startTimeSeconds: 480,
        type: 'rapport',
        title: 'Rapport breakthrough',
        description: 'First genuine laugh from them. You stopped pitching and started listening.',
        quote: "Honestly, we've seen this exact pain point kill two deals this quarter.",
      },
      {
        id: 'mom_002_2',
        startTimeSeconds: 89,
        type: 'hesitation',
        title: 'Pitch mode too early',
        description: 'You listed 5 features before asking a single question. They went quiet.',
      },
    ],
    questionsAnalysis: [
      {
        question: "What does your security review process look like?",
        insight: "Good — showed you did homework. But came 8 minutes too late.",
      },
      {
        question: "Who else is involved in this decision?",
        insight: "Classic qualification move, slightly mechanical. They sensed the script.",
      },
    ],
    actionItems: [
      'Send SOC2 report and security overview deck',
      'Schedule technical deep-dive with their engineering lead',
      'Follow up on Q3 budget timeline',
    ],
  },
  {
    id: 'rec_003',
    timestamp: new Date('2026-05-01T16:45:00'),
    duration: 1024,
    title: '1-on-1 — Head of Engineering',
    summary:
      "You gave feedback that was technically accurate but landed as criticism. Watch the framing.",
    tags: [
      { emoji: '🧊', label: 'Guarded', type: 'emotion' },
      { emoji: '🔧', label: 'Management', type: 'topic' },
      { emoji: '🎯', label: 'Direct', type: 'behavior' },
    ],
    talkRatio: 58,
    keyTopics: ['Sprint velocity', 'Team morale', 'Technical debt', 'Roadmap ownership'],
    energyArc: energyArc('consistent'),
    wordCount: 3210,
    questionsAsked: 9,
    speakingPace: 144,
    fillerWordCount: 7,
    repeatedThemes: [
      { theme: 'ownership', count: 5 },
      { theme: 'velocity', count: 4 },
      { theme: 'trust', count: 3 },
    ],
    confidenceIndex: 74,
    confidenceIndexDelta: 4,
    energyArcLabel: 'Steady and controlled throughout',
    toneBreakdown: [
      { emoji: '🧊', label: 'Guarded', percentage: 50 },
      { emoji: '🎯', label: 'Direct', percentage: 35 },
      { emoji: '🤝', label: 'Collaborative', percentage: 15 },
    ],
    moments: [
      {
        id: 'mom_003_1',
        startTimeSeconds: 310,
        type: 'insight',
        title: 'Unguarded moment',
        description: 'They told you about the morale issue. You moved past it too quickly.',
        quote: "People are a bit... yeah, it's been a long sprint.",
      },
      {
        id: 'mom_003_2',
        startTimeSeconds: 720,
        type: 'confidence',
        title: 'Clear expectations set',
        description: 'Best feedback delivery in the session — specific, non-personal, forward-looking.',
        quote: "The PR review lag isn't a process failure — it's a prioritization signal.",
      },
    ],
    questionsAnalysis: [
      {
        question: "What would make this sprint feel like a win to you?",
        insight: "Strong — anchors their definition of success before you share yours.",
      },
      {
        question: "Is there anything blocking you that I don't know about?",
        insight: "Safe opener. They said 'no' but their pace slowed — there's something there.",
      },
    ],
    actionItems: [
      'Define "done" criteria for Q2 tech debt sprint',
      'Weekly async update replacing Thursday sync meeting',
    ],
  },
  {
    id: 'rec_004',
    timestamp: new Date('2026-04-30T09:00:00'),
    duration: 334,
    title: 'Board Check-in — Weekly Sync',
    summary:
      "Tightest version of yourself this week. Confident, brief, no filler. Do more of this.",
    tags: [
      { emoji: '💪', label: 'Confident', type: 'emotion' },
      { emoji: '📈', label: 'Strategic', type: 'behavior' },
      { emoji: '🏢', label: 'Board', type: 'topic' },
    ],
    talkRatio: 45,
    keyTopics: ['KPIs', 'Hiring pipeline', 'Customer churn', 'Next quarter'],
    energyArc: energyArc('consistent'),
    wordCount: 876,
    questionsAsked: 6,
    speakingPace: 153,
    fillerWordCount: 3,
    repeatedThemes: [
      { theme: 'Q2 targets', count: 4 },
      { theme: 'churn', count: 3 },
    ],
    confidenceIndex: 91,
    confidenceIndexDelta: 21,
    energyArcLabel: 'Calm authority throughout — no volatility',
    toneBreakdown: [
      { emoji: '💪', label: 'Confident', percentage: 65 },
      { emoji: '📈', label: 'Strategic', percentage: 25 },
      { emoji: '🤔', label: 'Thoughtful', percentage: 10 },
    ],
    moments: [
      {
        id: 'mom_004_1',
        startTimeSeconds: 45,
        type: 'confidence',
        title: 'Best opening of the week',
        description: 'Direct, no preamble, number-led. Set the tone in 15 seconds.',
        quote: "Three things: churn is down 18%, pipeline is ahead of plan, and hiring has a problem.",
      },
    ],
    questionsAnalysis: [
      {
        question: "What's your read on the churn driver?",
        insight: "Smart — invites their expertise before sharing your hypothesis.",
      },
    ],
    actionItems: ['Resolve Sr. Engineer hiring bottleneck before next board sync'],
  },
  {
    id: 'rec_005',
    timestamp: new Date('2026-04-29T13:30:00'),
    duration: 891,
    title: 'Coaching Session — Executive Coach',
    summary:
      "You deflected every question about your co-founder relationship. That's where the tension lives.",
    tags: [
      { emoji: '🔍', label: 'Introspective', type: 'emotion' },
      { emoji: '😶', label: 'Deflecting', type: 'behavior' },
      { emoji: '🧠', label: 'Self-Awareness', type: 'topic' },
    ],
    talkRatio: 62,
    keyTopics: ['Leadership identity', 'Co-founder dynamic', 'Anxiety', 'Vision clarity'],
    energyArc: energyArc('volatile'),
    wordCount: 2654,
    questionsAsked: 1,
    speakingPace: 139,
    fillerWordCount: 41,
    repeatedThemes: [
      { theme: "I don't know", count: 7 },
      { theme: 'eventually', count: 5 },
      { theme: 'co-founder', count: 4 },
    ],
    confidenceIndex: 38,
    confidenceIndexDelta: -32,
    energyArcLabel: 'Erratic — genuine emotional processing happening',
    toneBreakdown: [
      { emoji: '😶', label: 'Deflecting', percentage: 45 },
      { emoji: '🔍', label: 'Searching', percentage: 35 },
      { emoji: '😔', label: 'Resigned', percentage: 20 },
    ],
    moments: [
      {
        id: 'mom_005_1',
        startTimeSeconds: 392,
        type: 'deflection',
        title: '3rd co-founder deflection',
        description: "Coach asked directly. You said 'it's fine' and changed the subject in under 4 seconds.",
        quote: "That's... yeah, that's fine. But what I wanted to talk about was the vision thing.",
      },
      {
        id: 'mom_005_2',
        startTimeSeconds: 756,
        type: 'insight',
        title: 'Rare moment of honesty',
        description: 'The only unguarded thing you said. Your coach paused — she caught it too.',
        quote: "I don't actually know if we want the same thing anymore.",
      },
    ],
    questionsAnalysis: [
      {
        question: "Do you think that's a realistic timeline?",
        insight: "The only question you asked — directed at your coach, seeking external validation for your own plan.",
      },
    ],
    actionItems: ['Have the co-founder conversation before next coaching session'],
  },
  {
    id: 'rec_006',
    timestamp: new Date('2026-04-28T15:00:00'),
    duration: 623,
    title: 'Partnership Call — Potential Integration Partner',
    summary:
      "You built genuine rapport in the first 5 minutes — rare for you. Replicate this opener.",
    tags: [
      { emoji: '🤝', label: 'Warm', type: 'emotion' },
      { emoji: '💡', label: 'Curious', type: 'behavior' },
      { emoji: '🔗', label: 'Partnerships', type: 'topic' },
    ],
    talkRatio: 49,
    keyTopics: ['API integration', 'Revenue share', 'Customer overlap', 'Timeline'],
    energyArc: energyArc('peak-early'),
    wordCount: 1987,
    questionsAsked: 11,
    speakingPace: 158,
    fillerWordCount: 9,
    repeatedThemes: [
      { theme: 'mutual value', count: 4 },
      { theme: 'users', count: 5 },
      { theme: 'next steps', count: 3 },
    ],
    confidenceIndex: 79,
    confidenceIndexDelta: 9,
    energyArcLabel: 'Peak early, then comfortable cruise — well-paced',
    toneBreakdown: [
      { emoji: '🤝', label: 'Warm', percentage: 40 },
      { emoji: '💡', label: 'Curious', percentage: 38 },
      { emoji: '📈', label: 'Strategic', percentage: 22 },
    ],
    moments: [
      {
        id: 'mom_006_1',
        startTimeSeconds: 78,
        type: 'rapport',
        title: 'Natural connection',
        description: 'You asked about their background before pitching anything. They opened up immediately.',
        quote: "How did you end up building in this space? I'm genuinely curious.",
      },
      {
        id: 'mom_006_2',
        startTimeSeconds: 510,
        type: 'confidence',
        title: 'Clean close',
        description: 'Specific next steps, shared ownership. No vagueness.',
        quote: "Let's do this: I'll send a one-pager Thursday, you loop in your PM, we reconvene Monday.",
      },
    ],
    questionsAnalysis: [
      {
        question: "How did you end up building in this space?",
        insight: "Opened with genuine curiosity. This is what makes people feel seen — and why this call worked.",
      },
      {
        question: "What would a successful integration look like to you in 90 days?",
        insight: "Outcome-first framing. Got them to define success before you pitched anything.",
      },
    ],
    actionItems: [
      'Send one-pager and integration spec by Thursday',
      'Introduce them to head of partnerships',
    ],
  },
];

// ─── Week Stats ───────────────────────────────────────────────────────────────

export const MOCK_WEEK_STATS: WeekStats = {
  sessionCount: 6,
  totalDurationSeconds: MOCK_RECORDINGS.reduce((sum, r) => sum + r.duration, 0),
  topTopic: 'Leadership',
  moodSummary: "You've been 40% more assertive than last month",
  assertivenessChangePct: 40,
  recordedDays: [true, true, true, true, true, true, false],
  avgTalkRatio: Math.round(
    MOCK_RECORDINGS.reduce((sum, r) => sum + r.talkRatio, 0) / MOCK_RECORDINGS.length
  ),
  avgFillerWordsPerMin:
    Math.round(
      (MOCK_RECORDINGS.reduce((sum, r) => sum + r.fillerWordCount, 0) /
        (MOCK_RECORDINGS.reduce((sum, r) => sum + r.duration, 0) / 60)) *
        10
    ) / 10,
};

// ─── Watch State ──────────────────────────────────────────────────────────────

export const MOCK_WATCH_STATE: WatchState = {
  status: 'connected',
  lastSyncedAt: new Date(Date.now() - 4 * 60 * 1000),
  recordingDurationSeconds: 0,
};

// ─── Pattern Alerts ───────────────────────────────────────────────────────────

export const MOCK_PATTERN_ALERTS: PatternAlert[] = [
  {
    id: 'pat_001',
    title: 'You talk 70%+ of the time in high-stakes calls',
    description:
      'In 4 of 6 sessions this week, you spoke over 68% of the time. The calls you rated as "successful" averaged 49% talk ratio.',
    occurrences: 4,
    totalSessions: 6,
    severity: 'notable',
  },
];

// ─── Insight Trends (for InsightsOverview) ────────────────────────────────────

export const MOCK_TRENDS: InsightTrend[] = [
  {
    metric: 'CONFIDENCE INDEX',
    unit: '/100',
    points: [
      { label: 'Mar W3', value: 58 },
      { label: 'Mar W4', value: 62 },
      { label: 'Apr W1', value: 67 },
      { label: 'Apr W2', value: 64 },
      { label: 'Apr W3', value: 71 },
      { label: 'Apr W4', value: 74 },
      { label: 'May W1', value: 82 },
    ],
    changeDirection: 'up',
    changeLabel: '+24 over 7 weeks',
    higherIsBetter: true,
  },
  {
    metric: 'TALK RATIO',
    unit: '%',
    points: [
      { label: 'Mar W3', value: 78 },
      { label: 'Mar W4', value: 75 },
      { label: 'Apr W1', value: 72 },
      { label: 'Apr W2', value: 73 },
      { label: 'Apr W3', value: 69 },
      { label: 'Apr W4', value: 66 },
      { label: 'May W1', value: 60 },
    ],
    changeDirection: 'down',
    changeLabel: '−18% over 7 weeks',
    higherIsBetter: false,
  },
  {
    metric: 'FILLER WORDS / MIN',
    unit: '/min',
    points: [
      { label: 'Mar W3', value: 4.2 },
      { label: 'Mar W4', value: 3.9 },
      { label: 'Apr W1', value: 4.1 },
      { label: 'Apr W2', value: 3.6 },
      { label: 'Apr W3', value: 3.2 },
      { label: 'Apr W4', value: 2.8 },
      { label: 'May W1', value: 2.4 },
    ],
    changeDirection: 'down',
    changeLabel: '−43% over 7 weeks',
    higherIsBetter: false,
  },
  {
    metric: 'QUESTIONS ASKED',
    unit: '/session',
    points: [
      { label: 'Mar W3', value: 2.1 },
      { label: 'Mar W4', value: 2.4 },
      { label: 'Apr W1', value: 3.0 },
      { label: 'Apr W2', value: 3.5 },
      { label: 'Apr W3', value: 4.2 },
      { label: 'Apr W4', value: 4.8 },
      { label: 'May W1', value: 5.7 },
    ],
    changeDirection: 'up',
    changeLabel: '+3.6 over 7 weeks',
    higherIsBetter: true,
  },
];
