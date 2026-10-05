/**
 * Every line of dialogue in the run, as data. Scenes and systems look lines up here by moment;
 * nobody hard-codes text. Rewrite freely — keep the keys (code depends on them).
 *
 * Tone: zones 1–2 are a warm, noble-sounding narrator who "protects" the pages from the
 * Shades' spoiled light (really he is eating it). He slips in zone 2 and glitches openly in
 * zone 3. After the twist he is a cold, contemptuous author.
 *
 * Glitch markup: "[[wrong|right]]" types the wrong word, flickers it, then corrects it
 * (the voice says the wrong word first, too).
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
      { text: 'Ah! There you are, hero. Sunny Side Street, a lovely morning, and not a moment too soon!' },
      { text: 'Shades are creeping into my pages. Sad, purple, leaky little things. Let\'s tidy them up.' },
    ],
    fights: [
      {
        before: [{ text: 'Here come two now. Don\'t be shy. Swing!' }],
        after: [
          { text: 'Marvellous! See that little light drift up to me?' },
          { text: 'Shade-light. Spoiled stuff. If it soaks into the pages, everything goes grey. Best I hold it.' },
        ],
      },
      {
        before: [{ text: 'Three this time. Chain your swings. The third one hits HARD.' }],
        after: [{ text: 'Textbook! Don\'t mind the box getting bigger. Holding all that gloom takes room.' }],
      },
      {
        before: [{ text: 'A whole gang! Keep moving, dodge their swipes, give them the finisher.' }],
        after: [{ text: 'Oh, you\'re a natural. That last light was delicious. Er. Dangerous. Very dangerous. I\'ll hold it.' }],
      },
    ],
    exit: [{ text: 'Head east to the end of the street, hero. Next panel!' }],
  } satisfies ZoneLines,

  zone2: {
    intro: [{ text: 'The Rooftop Market! Mind the stalls. Something bigger lives up here.' }],
    energyGrant: [
      { text: 'You\'ve earned a gift. A little of my own Light. Warm, golden… I won\'t miss it. Much.' },
      { text: 'Q throws a Gold Bolt. E bursts it all around you. Go on, try it!' },
    ],
    fights: [
      {
        before: [{ text: 'Test that Light on these three!' }],
        after: [{ text: 'Doesn\'t that feel wonderful? I certainly feel wonderful.' }],
      },
      {
        before: [
          { text: 'A Brute. Armoured. Your Light will just bounce off that shell.' },
          { text: 'Crack it open with your heavy finisher, then hit the glowing core with Light!' },
        ],
        after: [{ text: 'Shell, then core. Melee opens, Light finishes. You\'ve got it!' }],
      },
      {
        before: [{ text: 'Brute and friends. Juggle them!' }],
        after: [{ text: 'Ha! The page practically glows. Mostly around me, but someone has to carry it.' }],
      },
      {
        before: [{ text: 'Two Brutes. Big finish, hero!' }],
        after: [{ text: 'Brilliant! [[More|Well done]], hero.' }],
      },
    ],
    exit: [{ text: 'Down the far stairs to the Old Square. Don\'t worry about me. It only aches a little.' }],
  } satisfies ZoneLines & { energyGrant: Line[] },

  zone3: {
    intro: [
      { text: 'The Old Square. Hm. The ink\'s worn thin here. Don\'t look at the cracks.' },
      { text: 'Just keep [[feeding|helping]] me. The pages, I mean. Keep helping the pages.' },
    ],
    fights: [
      {
        before: [{ text: 'More of them. Yes. Good. Quickly now.' }],
        after: [{ text: 'Yes… more… MORE! …For safekeeping.' }],
      },
      {
        before: [{ text: 'Don\'t let them [[escape|hurt you]]. Every last one, hero.' }],
        after: [{ text: 'Do you feel that? I feel ENORMOUS. Noble, I mean. Enormously noble.' }],
      },
      {
        before: [{ text: 'All of them. ALL of them. Bring me their [[light|peace]].' }],
        after: [{ text: 'Ahem. Splendid work. Such a heavy burden. I\'ll carry it. All of it. Forever.' }],
      },
    ],
    exit: [{ text: 'Through the gate. The Warden waits beyond: a jailer, a hoarder of light. End him, and I can finally rest.' }],
  } satisfies ZoneLines,

  /** One-off reactions while the narrator is still "friendly" (zones only). */
  reactions: {
    firstKill: [{ text: 'Got one! See the little light? Up it comes. I\'ll keep it out of harm\'s way.' }],
    firstHeavy: [{ text: 'THAT\'s the finisher. Every third swing.' }],
    firstEnergy: [{ text: 'Ooh, warm. Use it often. There\'s always more where that came from.' }],
    firstShellBreak: [{ text: 'Cracked! Now, Light on the core, quick!' }],
    hurt: [
      { text: 'Ow. Dodge, hero. SPACE.' },
      { text: 'Careful! I need you in one piece.' },
      { text: 'Tsk. Don\'t you dare stop now. Not when we\'re so close.' },
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
    dodge: 'SPACE to dodge · hold RIGHT MOUSE to guard',
    heal: 'F to heal: spend your Light to mend',
    energy: 'Q to fire Gold Bolt · E for Gold Burst',
    shell: 'Break the shell with a HEAVY hit, then hit the core with energy!',
    core: 'Core exposed! Finish it with energy (Q)',
    exit: 'Walk to the glowing marker to continue',
  },

  warden: {
    /** Said now and then while he defends (a clue). */
    clue: '…you don\'t know what you\'re feeding.',
    /** The Narrator, when the Warden kneels. */
    kneel: 'Finish it! Break his chains! Set me— set the light free!',
    shieldUp: 'SHIELD UP!',
  },

  /** The twist (src/sequences/twist.ts). Cold and contemptuous from here on. */
  twist: {
    /** Still in the box, the moment the Warden falls. */
    reveal: [
      { text: 'At last. Thank you, hero. You\'ve been… so very generous.' },
      { text: 'Every shade you struck down. Every little light. Do you know what they were?' },
      { text: 'Not pollution. Souls. And you fed every one of them to me.' },
    ],
    /** After the box shatters and he steps out. */
    freed: [
      { text: 'That cosy little box was a cage. The Warden built it. You broke it.' },
      { text: 'I didn\'t carry their light. I drank it. And every drop made me harder to hold.' },
      { text: 'Sacrifice. Ha. The only thing I ever gave up was pretending.' },
      { text: 'Now the story ends the way I write it: without you.' },
    ],
    powersStripped: 'Your gold was always mine. I take it back. Fade, little character.',
    collapse: 'Let the page tear. I\'ll write a better one.',
    runPrompt: 'Run to the Warden!',
    wardenDying: [
      { text: 'His ink… never bound you. Only the gold did.', speaker: 'warden' },
      { text: 'Take the true light. Give the souls back their names… and end him.', speaker: 'warden' },
    ] as Line[],
  },

  /** The final boss fight (src/bosses/Narrator.ts, Final.scene.ts). */
  final: {
    taunts: ['Dance, puppet.', 'You\'re a footnote.', 'I wrote you. I can cut you.', 'Every wound is a word I write.'],
    bigAttack: ['I AM THE AUTHOR!', 'KNEEL TO THE INK!', 'THIS IS MY PAGE!', 'YOU ARE A MARGIN NOTE!'],
    phase2: 'You\'re spending their light against me? Mine! I earned every soul!',
    /** Big comic text when he dies. */
    deathCry: 'NO— MY PAGES— MY LIGHT—!',
    heroLastWord: 'The final period is mine.',
  },

  ending: {
    lines: [
      { text: 'They\'re free. Every one of them.', speaker: 'hero', sec: 3 },
      { text: 'The pen is still warm. No narrator now. Just us.', speaker: 'hero', sec: 3 },
    ] as Line[],
    /** Typed by the hero as the last caption of the comic. */
    finalCaption: 'And the light he stole went home. Not gold. True.',
    theEnd: 'THE END… OR A TRUE DAWN',
  },
};
