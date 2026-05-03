import type { Transcript } from '../types';

// Full mock transcripts for 3 recordings.
// fillerRanges mark exact character offsets of filler words in the text
// so the UI can render them with subtle de-emphasis.

export const MOCK_TRANSCRIPTS: Transcript[] = [
  {
    recordingId: 'rec_001',
    lines: [
      {
        id: 't1_01',
        speaker: 'YOU',
        startTimeSeconds: 0,
        text: "So I wanted to walk you through where we are on the Series A and get your read on a few things.",
      },
      {
        id: 't1_02',
        speaker: 'THEM',
        startTimeSeconds: 8,
        text: "Sure, I've been looking at the deck. I'd actually like to start with the burn rate — can you walk me through the current runway?",
      },
      {
        id: 't1_03',
        speaker: 'YOU',
        startTimeSeconds: 20,
        text: "Absolutely. So we're currently at about $280K monthly — that gives us 14 months at current burn.",
        momentId: undefined,
      },
      {
        id: 't1_04',
        speaker: 'THEM',
        startTimeSeconds: 30,
        text: "Okay. And that's before or after the raise closes?",
      },
      {
        id: 't1_05',
        speaker: 'YOU',
        startTimeSeconds: 35,
        text: "That's the current state. What's more relevant here is the trajectory — we hit 40% month-over-month growth for the past two quarters.",
        momentId: 'mom_001_1',
      },
      {
        id: 't1_06',
        speaker: 'THEM',
        startTimeSeconds: 48,
        text: "I hear that, but I'm asking about runway specifically. If this raise doesn't close in 90 days, what happens?",
      },
      {
        id: 't1_07',
        speaker: 'YOU',
        startTimeSeconds: 58,
        text: "Um, yeah, so, the burn... the burn rate is, uh, something we're actively managing.",
        fillerRanges: [
          { start: 0, end: 2 },   // "Um"
          { start: 12, end: 15 }, // "so,"
          { start: 33, end: 36 }, // "uh,"
        ],
        momentId: 'mom_001_2',
      },
      {
        id: 't1_08',
        speaker: 'THEM',
        startTimeSeconds: 68,
        text: "What does 'actively managing' mean in practice?",
      },
      {
        id: 't1_09',
        speaker: 'YOU',
        startTimeSeconds: 73,
        text: "It means we have levers we haven't pulled yet. We could cut to $180K overnight if we had to. But we don't expect to need to.",
      },
      {
        id: 't1_10',
        speaker: 'THEM',
        startTimeSeconds: 86,
        text: "Okay. That's the first clear answer I've gotten on that. Let's move on — tell me about product-market fit. Where are you on that?",
      },
      {
        id: 't1_11',
        speaker: 'YOU',
        startTimeSeconds: 97,
        text: "This is actually where I get most excited. Our NPS is 71, retention is 94% month-over-month, and our best customers are telling us this is replacing tools they've had for years.",
      },
      {
        id: 't1_12',
        speaker: 'THEM',
        startTimeSeconds: 115,
        text: "What does your ICP look like? Who's your best customer?",
      },
      {
        id: 't1_13',
        speaker: 'YOU',
        startTimeSeconds: 121,
        text: "Series A to B founders and their direct reports. People running high-volume important conversations — sales leaders, coaches, operators.",
      },
      {
        id: 't1_14',
        speaker: 'THEM',
        startTimeSeconds: 131,
        text: "Interesting. And the team — you mentioned scaling. What does the org look like in 18 months?",
      },
      {
        id: 't1_15',
        speaker: 'YOU',
        startTimeSeconds: 139,
        text: "We go from 8 to 22. The big hires are a VP of Engineering and a Head of GTM.",
      },
      {
        id: 't1_16',
        speaker: 'THEM',
        startTimeSeconds: 148,
        text: "And are those in process?",
      },
      {
        id: 't1_17',
        speaker: 'YOU',
        startTimeSeconds: 152,
        text: "VP Eng we're actively interviewing. GTM is a post-raise hire.",
      },
      {
        id: 't1_18',
        speaker: 'THEM',
        startTimeSeconds: 159,
        text: "One more thing — you said runway was 14 months, but your projections show 22 months post-raise. That gap worries me a bit. What am I missing?",
      },
      {
        id: 't1_19',
        speaker: 'YOU',
        startTimeSeconds: 170,
        text: "What's more relevant here is the trajectory we're on — the unit economics tell the real story.",
        momentId: 'mom_001_3',
      },
      {
        id: 't1_20',
        speaker: 'THEM',
        startTimeSeconds: 181,
        text: "Right. I'd like you to send me the updated model — specifically the bridge between those two runway numbers.",
      },
      {
        id: 't1_21',
        speaker: 'YOU',
        startTimeSeconds: 189,
        text: "Absolutely — I'll have that to you by Friday.",
      },
    ],
  },
  {
    recordingId: 'rec_005',
    lines: [
      {
        id: 't5_01',
        speaker: 'THEM',
        startTimeSeconds: 0,
        text: "So last week you mentioned the co-founder dynamic had been weighing on you. I want to make sure we actually go there today.",
      },
      {
        id: 't5_02',
        speaker: 'YOU',
        startTimeSeconds: 11,
        text: "Yeah, I mean... I think the bigger thing right now is actually the vision question. Like, where we're going product-wise.",
        fillerRanges: [{ start: 11, end: 15 }],
      },
      {
        id: 't5_03',
        speaker: 'THEM',
        startTimeSeconds: 23,
        text: "Mm. I hear that. And is the vision question separate from the co-founder dynamic, or connected to it?",
      },
      {
        id: 't5_04',
        speaker: 'YOU',
        startTimeSeconds: 32,
        text: "They're separate. Totally separate things.",
      },
      {
        id: 't5_05',
        speaker: 'THEM',
        startTimeSeconds: 38,
        text: "Okay. Tell me about the vision question then.",
      },
      {
        id: 't5_06',
        speaker: 'YOU',
        startTimeSeconds: 42,
        text: "I just feel like we've been reactive for a while. Like, um, the roadmap exists but I don't know if it's actually pointed at something real yet.",
        fillerRanges: [{ start: 42, end: 44 }],
      },
      {
        id: 't5_07',
        speaker: 'THEM',
        startTimeSeconds: 56,
        text: "When you say 'pointed at something real' — what would real look like?",
      },
      {
        id: 't5_08',
        speaker: 'YOU',
        startTimeSeconds: 63,
        text: "I don't know. I keep going back and forth. Some days it feels obvious, other days I'm like, eventually we'll figure it out, I guess.",
        fillerRanges: [{ start: 89, end: 98 }],
      },
      {
        id: 't5_09',
        speaker: 'THEM',
        startTimeSeconds: 80,
        text: "What about your co-founder — how does he see the vision?",
      },
      {
        id: 't5_10',
        speaker: 'YOU',
        startTimeSeconds: 87,
        text: "That's... yeah, that's fine. But what I wanted to talk about was the vision thing I was describing.",
        momentId: 'mom_005_1',
      },
      {
        id: 't5_11',
        speaker: 'THEM',
        startTimeSeconds: 98,
        text: "I noticed you moved away from the question. I'm curious what 'fine' means.",
      },
      {
        id: 't5_12',
        speaker: 'YOU',
        startTimeSeconds: 105,
        text: "It means... it's a work in progress. We don't always agree but that's normal for co-founders, right?",
        fillerRanges: [{ start: 10, end: 12 }],
      },
      {
        id: 't5_13',
        speaker: 'THEM',
        startTimeSeconds: 116,
        text: "What don't you agree on?",
      },
      {
        id: 't5_14',
        speaker: 'YOU',
        startTimeSeconds: 120,
        text: "Just... execution stuff. Like how fast to move, when to hire, the usual things.",
        fillerRanges: [{ start: 4, end: 7 }],
      },
      {
        id: 't5_15',
        speaker: 'THEM',
        startTimeSeconds: 130,
        text: "And beneath the execution disagreements — is there a deeper thing?",
      },
      {
        id: 't5_16',
        speaker: 'YOU',
        startTimeSeconds: 137,
        text: "I don't actually know if we want the same thing anymore.",
        momentId: 'mom_005_2',
      },
      {
        id: 't5_17',
        speaker: 'THEM',
        startTimeSeconds: 149,
        text: "That's an important thing to say. Can you stay with that for a second?",
      },
      {
        id: 't5_18',
        speaker: 'YOU',
        startTimeSeconds: 156,
        text: "Yeah. I mean... I think so. It's just complicated. I don't want to blow things up.",
        fillerRanges: [{ start: 5, end: 8 }],
      },
    ],
  },
  {
    recordingId: 'rec_006',
    lines: [
      {
        id: 't6_01',
        speaker: 'YOU',
        startTimeSeconds: 0,
        text: "Thanks for making time — I know your schedule's been insane lately.",
      },
      {
        id: 't6_02',
        speaker: 'THEM',
        startTimeSeconds: 6,
        text: "Ha, yeah, Q2 is something else. But this sounds interesting.",
      },
      {
        id: 't6_03',
        speaker: 'YOU',
        startTimeSeconds: 12,
        text: "Before we get into it — how did you end up building in this space? I'm genuinely curious.",
        momentId: 'mom_006_1',
      },
      {
        id: 't6_04',
        speaker: 'THEM',
        startTimeSeconds: 19,
        text: "Honestly? Frustration. We kept losing deals and I could never tell if it was product or pitch or timing. Wanted data on that.",
      },
      {
        id: 't6_05',
        speaker: 'YOU',
        startTimeSeconds: 32,
        text: "That's exactly the same origin story as us. Did you come from a sales background or more product?",
      },
      {
        id: 't6_06',
        speaker: 'THEM',
        startTimeSeconds: 40,
        text: "Mostly product, but I've led two enterprise GTM buildouts. So both, sort of.",
      },
      {
        id: 't6_07',
        speaker: 'YOU',
        startTimeSeconds: 50,
        text: "Perfect overlap for what I'm thinking about. Let me share the opportunity and you tell me if it resonates.",
      },
      {
        id: 't6_08',
        speaker: 'THEM',
        startTimeSeconds: 57,
        text: "Go for it.",
      },
      {
        id: 't6_09',
        speaker: 'YOU',
        startTimeSeconds: 60,
        text: "Our users keep telling us they want one place that captures context from conversations AND their tools. You're solving the tools side, we're solving the conversation side. The integration writes itself.",
      },
      {
        id: 't6_10',
        speaker: 'THEM',
        startTimeSeconds: 77,
        text: "Interesting framing. What does a successful integration look like to you in 90 days?",
      },
      {
        id: 't6_11',
        speaker: 'YOU',
        startTimeSeconds: 84,
        text: "For us — 200 mutual customers using both surfaces within a session. For you — a data enrichment layer you don't have to build.",
      },
      {
        id: 't6_12',
        speaker: 'THEM',
        startTimeSeconds: 96,
        text: "I like that it's specific. Revenue share — how are you thinking about that?",
      },
      {
        id: 't6_13',
        speaker: 'YOU',
        startTimeSeconds: 103,
        text: "I'd suggest we table that until after the technical feasibility call — don't want us to negotiate against a whiteboard when we don't know what it actually costs to build.",
      },
      {
        id: 't6_14',
        speaker: 'THEM',
        startTimeSeconds: 115,
        text: "Smart. Okay — what are next steps?",
      },
      {
        id: 't6_15',
        speaker: 'YOU',
        startTimeSeconds: 120,
        text: "Let's do this: I'll send a one-pager Thursday, you loop in your PM, we reconvene Monday.",
        momentId: 'mom_006_2',
      },
      {
        id: 't6_16',
        speaker: 'THEM',
        startTimeSeconds: 130,
        text: "Works for me. I'll block Monday afternoon.",
      },
    ],
  },
];

export function getTranscript(recordingId: string): Transcript | undefined {
  return MOCK_TRANSCRIPTS.find((t) => t.recordingId === recordingId);
}
