// Content map for the InsightDeepDive screen.
// Each entry is the full educational + historical context for one insight type.

export interface InsightContent {
  title: string;
  tagline: string;
  description: string;
  // What the numbers mean
  scale?: Array<{ range: string; label: string; isIdeal?: boolean }>;
  // What a high or low number means for the user
  implications: Array<{ condition: string; meaning: string }>;
  // Specific, actionable improvement techniques
  improvements: string[];
  // Related metrics to look at alongside this one
  relatedMetrics: string[];
}

export const INSIGHT_CONTENT: Record<string, InsightContent> = {
  'confidence-index': {
    title: 'CONFIDENCE INDEX',
    tagline: 'How you come across when it matters.',
    description:
      "Your Confidence Index is a composite of four signals: speaking pace consistency, filler word frequency, declarative vs. hedged phrasing, and recovery speed after interruption or tough questions. A score above 70 means you sound like you believe what you're saying. Above 85, you sound like someone others want to follow.",
    scale: [
      { range: '85–100', label: 'Exceptional' },
      { range: '70–84', label: 'Strong', isIdeal: true },
      { range: '55–69', label: 'Moderate' },
      { range: '40–54', label: 'Developing' },
      { range: '0–39', label: 'Needs work' },
    ],
    implications: [
      {
        condition: 'Score drops after minute 7',
        meaning: "You start strong but lose conviction once the other person pushes back. This is one of the most common patterns — it reads as rehearsed confidence rather than real confidence.",
      },
      {
        condition: 'Score is 15+ points higher with senior counterparts',
        meaning: 'You perform for authority. Your confidence is externally calibrated. Work on being the same person in every room.',
      },
      {
        condition: 'Fillers spike but score stays high',
        meaning: 'Your delivery compensates — pace and tone carry the message even when the words are rough. You can take fillers more seriously now.',
      },
    ],
    improvements: [
      "Replace hedges with declaratives. 'I think we should...' → 'We should...' The thought is the same. The reception is completely different.",
      "Practise the pause. When you don't know what to say, most people fill with 'um' or repeat themselves. Silence is more confident than any filler.",
      "Prep 3 bridging phrases for the moments you get blindsided: 'The most important thing here is...', 'What the data shows...', 'Here's how I'd frame it...' These buy you a half-second to collect your answer.",
      "Review your hesitation moments. They tend to cluster around the same topics — usually the ones you're less certain about or more emotionally attached to. Those clusters tell you where to do the real prep work.",
    ],
    relatedMetrics: ['FILLER WORDS', 'SPEAKING PACE', 'TALK RATIO'],
  },

  'talk-ratio': {
    title: 'TALK RATIO',
    tagline: 'The most underrated variable in any negotiation.',
    description:
      'Talk ratio measures what percentage of the conversation you spoke. This number alone predicts outcomes in sales, negotiations, and high-stakes relationships better than almost any other signal. The research is clear: in almost every professional context, the person who talks less wins more.',
    scale: [
      { range: '75–100%', label: 'Dominating' },
      { range: '60–74%', label: 'Heavy' },
      { range: '45–59%', label: 'Balanced', isIdeal: true },
      { range: '30–44%', label: 'Listening' },
      { range: '0–29%', label: 'Reserved' },
    ],
    implications: [
      {
        condition: 'Above 68% in a sales call',
        meaning: "You're pitching, not selling. The other person isn't talking because you haven't created space. They're waiting to be asked what they actually care about.",
      },
      {
        condition: 'Above 70% with your own team',
        meaning: 'Your team may be performing agreement rather than offering genuine perspective. Ask fewer questions that have obvious answers.',
      },
      {
        condition: 'Below 40%',
        meaning: 'You may be over-deferring or genuinely listening well — context matters. Check how many questions you asked. If low, it might be passivity rather than strategy.',
      },
    ],
    improvements: [
      "Run a '2 questions before speaking' rule. Before sharing your view, ask two genuine questions. You'll learn something almost every time, and the ratio corrects itself naturally.",
      "Identify your trigger for over-talking. Most people fill silence when they're anxious, when they think the other person isn't getting it, or when the conversation moves toward something they're avoiding.",
      "End your answer, then stop. Most people answer a question, then explain their answer, then rephrase it. Answer and stop. If they need more, they'll ask.",
      "In your next high-stakes call, set a private target: 50%. Before you open the call, say to yourself 'I want to hear from them as much as I speak.' It works as an intention-setter.",
    ],
    relatedMetrics: ['CONFIDENCE INDEX', 'QUESTIONS ASKED', 'ENERGY ARC'],
  },

  'energy-arc': {
    title: 'ENERGY ARC',
    tagline: 'How your momentum moves through a conversation.',
    description:
      "Your energy arc shows how your conversational intensity shifted over the session. It's derived from your speaking pace, volume variation, sentence length, and response latency at each point in the conversation. The shape of the arc often reveals more than any single metric — it's where you see anxiety, boredom, pressure, or flow in real time.",
    implications: [
      {
        condition: "Arc fades in the second half ('fade' shape)",
        meaning: "You burned out early. This often happens when you front-load with your agenda and lose interest once you've made your case. The other person notices the drop.",
      },
      {
        condition: "Arc peaks late ('peak-late' shape)",
        meaning: "You warm up slowly but your best moments come at the end. This is a common pattern for introverts. The problem: by the time you're in flow, the decision has often already been made.",
      },
      {
        condition: "Arc is volatile ('volatile' shape)",
        meaning: "You were emotionally engaged — this isn't necessarily bad. But volatility without recovery can read as reactive or unstable. Check if the peaks and troughs align with external triggers or your own internal state.",
      },
    ],
    improvements: [
      "Treat your opening as your highest-leverage moment. You rarely get the arc back once it drops. Prepare your first 90 seconds of any important conversation the same way you'd prepare a keynote opening.",
      "If you know you peak late, move your prep earlier. Arrive at the meeting room 5 minutes early and have a high-energy primer — a few fast sentences out loud about what you want to achieve.",
      "If your arc is volatile, identify the specific moments that triggered drops. They're usually the same patterns across sessions: certain question types, certain emotional topics, or certain interpersonal dynamics.",
    ],
    relatedMetrics: ['CONFIDENCE INDEX', 'TALK RATIO', 'TONE PROFILE'],
  },

  'questions-asked': {
    title: 'QUESTIONS ASKED',
    tagline: 'The fastest measure of your curiosity and control.',
    description:
      "The number of questions you asked in a session is one of the highest-signal metrics in the app. Questions reveal your thinking style, your power dynamic orientation, and your genuine curiosity. More importantly: in almost every professional context, the person who asks better questions is the person who controls the conversation without appearing to.",
    scale: [
      { range: '10+', label: 'Deeply curious', isIdeal: true },
      { range: '6–9', label: 'Engaged' },
      { range: '3–5', label: 'Moderate' },
      { range: '1–2', label: 'Passive' },
      { range: '0', label: 'Monologuing' },
    ],
    implications: [
      {
        condition: '0–2 questions in a sales call',
        meaning: "You're presenting, not selling. The prospect's needs are unheard. Your pitch is calibrated to what you assume they want, not what they told you.",
      },
      {
        condition: 'Questions cluster at the end of the call',
        meaning: "You used questions to close rather than to understand. Late-stage questions are often validation-seeking ('Does that make sense?') rather than discovery.",
      },
      {
        condition: 'Questions all start with How or What',
        meaning: "You're asking good structural questions. Now add 'What would have to be true for...' and 'What are you most worried about?' — these unlock different levels.",
      },
    ],
    improvements: [
      "The opener that works almost everywhere: 'What's most important to you about this?' Asked in the first 3 minutes, it saves you 20 minutes of misaligned pitch.",
      "Outcome questions over feature questions. 'What would a win look like for you in 90 days?' > 'What features do you need?' The first question gets you a vision. The second gets you a checklist.",
      "After asking a question, stop talking. The silence is the question doing its work. Breaking it early means you answered it for them.",
      "Track the ratio of discovery to validation questions in your sessions. Discovery: learning something new. Validation: confirming what you already think. Your best sessions will be discovery-heavy.",
    ],
    relatedMetrics: ['TALK RATIO', 'CONFIDENCE INDEX', 'TONE PROFILE'],
  },

  'tone-profile': {
    title: 'TONE PROFILE',
    tagline: 'The emotional texture of how you show up.',
    description:
      "Your tone profile captures the dominant emotional registers you spent time in during the conversation. These aren't about what you said — they're about the underlying emotional coloring of how you said it. This is what the other person actually experiences. The feeling outlasts the content.",
    implications: [
      {
        condition: 'Deflecting is a dominant tone',
        meaning: "You spent significant energy steering away from something. The other person likely felt it. Avoidance is high-cost — it signals that the topic matters more to you than you're admitting.",
      },
      {
        condition: 'Guarded is dominant in 1-on-1s with your team',
        meaning: "You're managing rather than connecting. Your team learns over time that certain topics get a guarded response, so they stop bringing them.",
      },
      {
        condition: 'Passionate and Confident together',
        meaning: "This is your best combination. It reads as leadership. Find what conditions produce this state and engineer more of them.",
      },
    ],
    improvements: [
      "After each session, identify the trigger for your lowest-energy tone. It's usually a moment, a topic, or a dynamic — not a person. Naming it makes it manageable.",
      "If Guarded is appearing in sessions where you want to be open, try a physical reset before the call — a 2-minute walk, a deliberate statement of your intent, or a physical cue that signals 'I'm on your side.'",
      "Your tone profile across sessions shows your emotional narrative arc. If Deflecting is appearing more frequently over time, that's not a conversation problem — it's a life problem wearing a conversation mask.",
    ],
    relatedMetrics: ['ENERGY ARC', 'CONFIDENCE INDEX', 'TALK RATIO'],
  },
};
