/**
 * Every line of dialogue in the run, as data. Scenes and systems look lines up here by moment;
 * nobody hard-codes text. Rewrite freely — keep the keys (code depends on them).
 *
 * Tone: zones 1–2 are a warm, funny Saturday-morning narrator. He gets hungrier and a little
 * wrong in zone 3 (glitches). After the twist he is a cold, contemptuous author.
 *
 * Glitch markup: "[[wrong|right]]" types the wrong word, flickers it, then corrects it.
 * The Warden, twist and final-boss lines currently live in src/bosses and src/sequences.
 */

export type Speaker = 'narrator' | 'warden' | 'hero';

export interface Line {
  text: string;
  speaker?: Speaker;
  /** Seconds to wait before the next scripted beat (the caption box decides its own hold). */
  sec?: number;
}

/** One fight in a zone: what he says before it starts and after it is cleared. */
export interface FightLines {
  before: Line[];
  after: Line[];
}

export interface ZoneLines {
  intro: Line[];
  fights: FightLines[];
  /** When the last fight is cleared and the exit opens. */
  exit: Line[];
}

export const SCRIPT = {
  title: {
    tagline: 'A hero rises. A narrator guides. What could go wrong?',
  },

  zone1: {
    intro: [
      { text: 'Ah! There you are, hero. Sunny Side Street, a lovely morning — and not a moment too soon!', sec: 3.5 },
      { text: 'Shades are creeping into my pages. Soft, purple, sneaky little things. Let\'s tidy them up.', sec: 3.5 },
    ],
    fights: [
      {
        before: [{ text: 'Here come two now. Don\'t be shy — swing!', sec: 2 }],
        after: [{ text: 'Marvellous! See that little light drift my way? That\'s how I know you\'re doing well.', sec: 3 }],
      },
      {
        before: [{ text: 'Three this time. Chain your swings — the third one hits HARD.', sec: 2.5 }],
        after: [{ text: 'Textbook! Every one you clear makes this story brighter. And me… a little bigger.', sec: 3 }],
      },
      {
        before: [{ text: 'A whole gang! Keep moving, dodge their swipes, and give them the finisher.', sec: 2.5 }],
        after: [{ text: 'Oh, you\'re a natural. Onward — the rooftops need you.', sec: 2.5 }],
      },
    ],
    exit: [{ text: 'Head east to the end of the street, hero. Next panel!', sec: 2 }],
  } satisfies ZoneLines,

  zone2: {
    intro: [
      { text: 'The Rooftop Market! Mind the stalls. Something bigger lives up here.', sec: 3 },
    ],
    energyGrant: [
      { text: 'You\'ve earned a gift. Take my Light — warm, golden, all yours.', sec: 3 },
      { text: 'Q throws a Gold Bolt. E bursts it all around you. Go on, try it!', sec: 3 },
    ],
    fights: [
      {
        before: [{ text: 'Test that Light on these three!', sec: 2 }],
        after: [{ text: 'Doesn\'t that feel wonderful? I certainly feel wonderful.', sec: 2.5 }],
      },
      {
        before: [
          { text: 'A Brute. Armoured. Your Light will just bounce off that shell.', sec: 3 },
          { text: 'Crack it open with your heavy finisher, then hit the glowing core with Light!', sec: 3 },
        ],
        after: [{ text: 'Shell, then core. Melee opens, Light finishes. You\'ve got it!', sec: 2.5 }],
      },
      {
        before: [{ text: 'Brute and friends. Juggle them!', sec: 2 }],
        after: [{ text: 'Ha! The page practically glows. Mostly around me, but still.', sec: 2.5 }],
      },
      {
        before: [{ text: 'Two Brutes. Big finish, hero!', sec: 2 }],
        after: [{ text: 'Brilliant. Brilliant! More of that, please.', sec: 2.5 }],
      },
    ],
    exit: [{ text: 'The square is waiting. Down the far stairs!', sec: 2 }],
  } satisfies ZoneLines & { energyGrant: Line[] },

  zone3: {
    intro: [
      { text: 'The Old Square. Hm. The ink\'s worn thin here. Don\'t look at the cracks.', sec: 3 },
      { text: 'Just keep [[feeding|helping]] me. Keep helping.', sec: 3 },
    ],
    fights: [
      {
        before: [{ text: 'More of them. Yes. Good.', sec: 2 }],
        after: [{ text: 'Yes… more… MORE!', sec: 2.5 }],
      },
      {
        before: [{ text: 'Don\'t let them [[run|hurt you]]. Catch every last one!', sec: 2.5 }],
        after: [{ text: 'Do you feel that? I feel ENORMOUS.', sec: 2.5 }],
      },
      {
        before: [{ text: 'All of them. ALL of them. Bring me their [[light|heads]] — their defeat!', sec: 3 }],
        after: [{ text: 'Ahem. Splendid work. Nearly there now.', sec: 2.5 }],
      },
    ],
    exit: [{ text: 'Through the gate. One last villain stands between you and a happy ending.', sec: 3 }],
  } satisfies ZoneLines,

  /** One-off reactions while the narrator is still "friendly" (zones only). */
  reactions: {
    firstKill: [{ text: 'Got one! Did you see that little light? Lovely.' }],
    firstHeavy: [{ text: 'THAT\'S the finisher. Every third swing.' }],
    firstEnergy: [{ text: 'Ooh, warm. Use it often.' }],
    firstShellBreak: [{ text: 'Cracked! Now — Light on the core, quick!' }],
    hurt: [
      { text: 'Ow. Dodge, hero. SPACE.' },
      { text: 'Careful! I need you in one piece.' },
      { text: 'Tsk. They hesitate, you know. Use that.' },
    ],
    death: [
      { text: 'No, no, that\'s not how the story goes. Again!' },
      { text: 'Let\'s pretend that didn\'t happen. From the top of the page!' },
    ],
  },

  /** Tutorial prompts (shown once each, the first time they're relevant). */
  tutorial: {
    move: 'WASD to move',
    attack: 'LMB to attack: the 3rd hit is a HEAVY finisher',
    dodge: 'SPACE to dodge',
    energy: 'Q to fire Gold Bolt · E for Gold Burst',
    shell: 'Break the shell with a HEAVY hit, then hit the core with energy!',
    core: 'Core exposed! Hit it with energy (Q) before the shell grows back',
    exit: 'Walk to the glowing marker to continue',
  },

  ending: {
    lines: [
      { text: 'They\'re free. Every one of them.', speaker: 'hero', sec: 3 },
      { text: 'The pen is still warm. No narrator now. Just you.', speaker: 'hero', sec: 3 },
    ] as Line[],
    /** Typed by the hero as the last caption of the comic. */
    finalCaption: 'And the light that was stolen came home — not gold, but true.',
    theEnd: 'THE END… OR A TRUE DAWN',
  },
};
