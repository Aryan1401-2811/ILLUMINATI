/**
 * The character models the Visuals owner ships, exactly as documented in public/models/MODELS.md.
 * Used by the `visuals` sandbox gallery. Other modules should copy the values they need from
 * MODELS.md rather than importing this sandbox file.
 */
export interface CatalogEntry {
  id: string;
  label: string;
  path: string;
  /** Recommended in-game height in metres. */
  height: number;
  /** Recommended tint (multiplies the texture). Omit for the model's own colours. */
  tint?: string;
  /** Role → clip name, in the order the gallery cycles through them. */
  clips: Record<string, string>;
}

export const MODEL_CATALOG: CatalogEntry[] = [
  {
    id: 'grunt',
    label: 'Grunt (Shade)',
    path: 'models/enemies/grunt.glb',
    height: 1.35,
    clips: {
      idle: 'Idle_Combat',
      run: 'Running_A',
      attack: 'Unarmed_Melee_Attack_Punch_A',
      hit: 'Hit_A',
      death: 'Death_A',
      block: 'Blocking',
      spawn: 'Spawn_Ground',
    },
  },
  {
    id: 'brute',
    label: 'Brute (Shade)',
    path: 'models/enemies/brute.glb',
    height: 2.6,
    clips: {
      idle: 'Idle_Combat',
      walk: 'Walking_B',
      slam: '2H_Melee_Attack_Chop',
      hit: 'Hit_B',
      death: 'Death_B',
      block: 'Blocking',
      taunt: 'Taunt',
    },
  },
  {
    id: 'hero',
    label: 'Hero',
    path: 'models/hero/hero.glb',
    height: 1.8,
    clips: {
      idle: 'Idle',
      run: 'Running_A',
      attack: '1H_Melee_Attack_Slice_Diagonal',
      attack2: '1H_Melee_Attack_Slice_Horizontal',
      heavy: '1H_Melee_Attack_Chop',
      dodge: 'Dodge_Forward',
      hit: 'Hit_A',
      death: 'Death_A',
      cast: 'Spellcast_Shoot',
      victory: 'Cheer',
    },
  },
  {
    id: 'warden',
    label: 'The Warden',
    path: 'models/bosses/warden.glb',
    height: 3.2,
    clips: {
      idle: 'Idle',
      walk: 'Walking_B',
      block: 'Blocking',
      bash: 'Block_Attack',
      hit: 'Block_Hit',
      kneel: 'Sit_Floor_Down',
      death: 'Death_B',
      give: 'Spellcast_Raise',
    },
  },
  {
    id: 'narrator',
    label: 'The Narrator',
    path: 'models/bosses/narrator.glb',
    height: 2.9,
    clips: {
      idle: 'Idle',
      float: 'Jump_Idle',
      cast: 'Spellcast_Shoot',
      castBig: 'Spellcast_Long',
      hit: 'Hit_A',
      death: 'Death_A',
      gloat: 'Cheer',
    },
  },
];
