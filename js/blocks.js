// Définitions des blocs et des objets.
// Les blocs ont un id < 256, les objets (outils, nourriture...) un id >= 256.

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, GRAVEL: 6, WATER: 7,
  OAK_LOG: 8, OAK_LEAVES: 9, OAK_PLANKS: 10, GLASS: 11, BEDROCK: 12,
  COAL_ORE: 13, IRON_ORE: 14, GOLD_ORE: 15, DIAMOND_ORE: 16,
  SNOW_GRASS: 17, SNOW: 18, ICE: 19, CACTUS: 20, SANDSTONE: 21,
  BIRCH_LOG: 22, BIRCH_LEAVES: 23, SPRUCE_LOG: 24, SPRUCE_LEAVES: 25,
  TALL_GRASS: 26, FLOWER_RED: 27, FLOWER_YELLOW: 28, DEAD_BUSH: 29, TORCH: 30,
  CRAFTING_TABLE: 31, FURNACE: 32, CHEST: 33, BRICKS: 34, STONE_BRICKS: 35,
  MOSSY_COBBLE: 36, BOOKSHELF: 37, LAMP: 38,
  WOOL_WHITE: 39, WOOL_RED: 40, WOOL_ORANGE: 41, WOOL_YELLOW: 42, WOOL_LIME: 43,
  WOOL_GREEN: 44, WOOL_CYAN: 45, WOOL_BLUE: 46, WOOL_PURPLE: 47, WOOL_PINK: 48,
  WOOL_GRAY: 49, WOOL_BLACK: 50, WOOL_BROWN: 51,
  BIRCH_PLANKS: 52, SPRUCE_PLANKS: 53, SMOOTH_STONE: 54, OBSIDIAN: 55, CLAY: 56,
};

export const I = {
  STICK: 256, COAL: 257, CHARCOAL: 258, IRON_INGOT: 259, GOLD_INGOT: 260, DIAMOND: 261,
  APPLE: 262, PORK_RAW: 263, PORK_COOKED: 264, MUTTON_RAW: 265, MUTTON_COOKED: 266,
  ROTTEN_FLESH: 267, BREAD: 268,
  WOOD_PICKAXE: 270, STONE_PICKAXE: 271, IRON_PICKAXE: 272, DIAMOND_PICKAXE: 273,
  WOOD_AXE: 274, STONE_AXE: 275, IRON_AXE: 276, DIAMOND_AXE: 277,
  WOOD_SHOVEL: 278, STONE_SHOVEL: 279, IRON_SHOVEL: 280, DIAMOND_SHOVEL: 281,
  WOOD_SWORD: 282, STONE_SWORD: 283, IRON_SWORD: 284, DIAMOND_SWORD: 285,
};

// Propriétés par défaut d'un bloc.
const DEFAULT_BLOCK = {
  solid: true, opaque: true, cross: false, liquid: false, falls: false,
  replaceable: false, hardness: 1, tool: null, minTier: 0, light: 0, sound: 'stone',
};

export const BLOCKS = [];
function blk(id, key, name, props) {
  const def = Object.assign({}, DEFAULT_BLOCK, props, { id, key, name, isBlock: true });
  if (def.drop === undefined) def.drop = id;
  if (typeof def.tex === 'string') def.tex = { top: def.tex, side: def.tex, bottom: def.tex };
  else if (def.tex) {
    def.tex.side = def.tex.side || def.tex.top;
    def.tex.bottom = def.tex.bottom || def.tex.top;
  }
  BLOCKS[id] = def;
}

blk(B.AIR, 'air', 'Air', { solid: false, opaque: false, hardness: -1, drop: null });
blk(B.GRASS, 'grass', 'Bloc d\'herbe', { tex: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' }, hardness: 0.6, tool: 'shovel', drop: B.DIRT, sound: 'grass' });
blk(B.DIRT, 'dirt', 'Terre', { tex: 'dirt', hardness: 0.5, tool: 'shovel', sound: 'gravel' });
blk(B.STONE, 'stone', 'Roche', { tex: 'stone', hardness: 1.5, tool: 'pickaxe', minTier: 1, drop: B.COBBLE });
blk(B.COBBLE, 'cobble', 'Pierre taillée', { tex: 'cobble', hardness: 2, tool: 'pickaxe', minTier: 1 });
blk(B.SAND, 'sand', 'Sable', { tex: 'sand', hardness: 0.5, tool: 'shovel', falls: true, sound: 'sand' });
blk(B.GRAVEL, 'gravel', 'Gravier', { tex: 'gravel', hardness: 0.6, tool: 'shovel', falls: true, sound: 'gravel' });
blk(B.WATER, 'water', 'Eau', { tex: 'water', solid: false, opaque: false, liquid: true, hardness: -1, drop: null, replaceable: true });
blk(B.OAK_LOG, 'oak_log', 'Bûche de chêne', { tex: { top: 'oak_log_top', side: 'oak_log' }, hardness: 2, tool: 'axe', sound: 'wood' });
blk(B.OAK_LEAVES, 'oak_leaves', 'Feuilles de chêne', { tex: 'oak_leaves', hardness: 0.2, drop: 'leaves', sound: 'grass', leaves: true });
blk(B.OAK_PLANKS, 'oak_planks', 'Planches de chêne', { tex: 'oak_planks', hardness: 2, tool: 'axe', sound: 'wood' });
blk(B.GLASS, 'glass', 'Verre', { tex: 'glass', opaque: false, hardness: 0.3, drop: null, sound: 'glass' });
blk(B.BEDROCK, 'bedrock', 'Bedrock', { tex: 'bedrock', hardness: -1, drop: null });
blk(B.COAL_ORE, 'coal_ore', 'Minerai de charbon', { tex: 'coal_ore', hardness: 3, tool: 'pickaxe', minTier: 1, drop: I.COAL });
blk(B.IRON_ORE, 'iron_ore', 'Minerai de fer', { tex: 'iron_ore', hardness: 3, tool: 'pickaxe', minTier: 2 });
blk(B.GOLD_ORE, 'gold_ore', 'Minerai d\'or', { tex: 'gold_ore', hardness: 3, tool: 'pickaxe', minTier: 3 });
blk(B.DIAMOND_ORE, 'diamond_ore', 'Minerai de diamant', { tex: 'diamond_ore', hardness: 3, tool: 'pickaxe', minTier: 3, drop: I.DIAMOND });
blk(B.SNOW_GRASS, 'snow_grass', 'Herbe enneigée', { tex: { top: 'snow', side: 'snow_grass_side', bottom: 'dirt' }, hardness: 0.6, tool: 'shovel', drop: B.DIRT, sound: 'snow' });
blk(B.SNOW, 'snow', 'Bloc de neige', { tex: 'snow', hardness: 0.3, tool: 'shovel', sound: 'snow' });
blk(B.ICE, 'ice', 'Glace', { tex: 'ice', opaque: false, hardness: 0.5, tool: 'pickaxe', drop: null, sound: 'glass' });
blk(B.CACTUS, 'cactus', 'Cactus', { tex: { top: 'cactus_top', side: 'cactus_side' }, hardness: 0.4, sound: 'wool', opaque: false });
blk(B.SANDSTONE, 'sandstone', 'Grès', { tex: { top: 'sandstone_top', side: 'sandstone' }, hardness: 0.8, tool: 'pickaxe', minTier: 1 });
blk(B.BIRCH_LOG, 'birch_log', 'Bûche de bouleau', { tex: { top: 'birch_log_top', side: 'birch_log' }, hardness: 2, tool: 'axe', sound: 'wood' });
blk(B.BIRCH_LEAVES, 'birch_leaves', 'Feuilles de bouleau', { tex: 'birch_leaves', hardness: 0.2, drop: 'leaves', sound: 'grass', leaves: true });
blk(B.SPRUCE_LOG, 'spruce_log', 'Bûche de sapin', { tex: { top: 'spruce_log_top', side: 'spruce_log' }, hardness: 2, tool: 'axe', sound: 'wood' });
blk(B.SPRUCE_LEAVES, 'spruce_leaves', 'Feuilles de sapin', { tex: 'spruce_leaves', hardness: 0.2, drop: 'leaves', sound: 'grass', leaves: true });
blk(B.TALL_GRASS, 'tall_grass', 'Hautes herbes', { tex: 'tall_grass', cross: true, solid: false, opaque: false, replaceable: true, hardness: 0, drop: null, sound: 'grass' });
blk(B.FLOWER_RED, 'flower_red', 'Coquelicot', { tex: 'flower_red', cross: true, solid: false, opaque: false, hardness: 0, sound: 'grass' });
blk(B.FLOWER_YELLOW, 'flower_yellow', 'Pissenlit', { tex: 'flower_yellow', cross: true, solid: false, opaque: false, hardness: 0, sound: 'grass' });
blk(B.DEAD_BUSH, 'dead_bush', 'Buisson mort', { tex: 'dead_bush', cross: true, solid: false, opaque: false, replaceable: true, hardness: 0, drop: I.STICK, sound: 'grass' });
blk(B.TORCH, 'torch', 'Torche', { tex: 'torch', cross: true, solid: false, opaque: false, hardness: 0, light: 7, sound: 'wood' });
blk(B.CRAFTING_TABLE, 'crafting_table', 'Établi', { tex: { top: 'crafting_top', side: 'crafting_side', front: 'crafting_front', bottom: 'oak_planks' }, hardness: 2.5, tool: 'axe', sound: 'wood', usable: true });
blk(B.FURNACE, 'furnace', 'Four', { tex: { top: 'furnace_top', side: 'furnace_side', front: 'furnace_front' }, hardness: 3.5, tool: 'pickaxe', minTier: 1, usable: true });
blk(B.CHEST, 'chest', 'Coffre', { tex: { top: 'chest_top', side: 'chest_side', front: 'chest_front' }, hardness: 2.5, tool: 'axe', sound: 'wood', usable: true });
blk(B.BRICKS, 'bricks', 'Briques', { tex: 'bricks', hardness: 2, tool: 'pickaxe', minTier: 1 });
blk(B.STONE_BRICKS, 'stone_bricks', 'Pierres taillées', { tex: 'stone_bricks', hardness: 1.5, tool: 'pickaxe', minTier: 1 });
blk(B.MOSSY_COBBLE, 'mossy_cobble', 'Pierre moussue', { tex: 'mossy_cobble', hardness: 2, tool: 'pickaxe', minTier: 1 });
blk(B.BOOKSHELF, 'bookshelf', 'Bibliothèque', { tex: { top: 'oak_planks', side: 'bookshelf' }, hardness: 1.5, tool: 'axe', sound: 'wood', drop: B.OAK_PLANKS });
blk(B.LAMP, 'lamp', 'Lampe', { tex: 'lamp', hardness: 0.3, light: 9, sound: 'glass' });
const WOOLS = [
  ['white', 'blanche'], ['red', 'rouge'], ['orange', 'orange'], ['yellow', 'jaune'], ['lime', 'vert clair'],
  ['green', 'verte'], ['cyan', 'cyan'], ['blue', 'bleue'], ['purple', 'violette'], ['pink', 'rose'],
  ['gray', 'grise'], ['black', 'noire'], ['brown', 'marron'],
];
WOOLS.forEach(([k, fr], i) => {
  blk(B.WOOL_WHITE + i, 'wool_' + k, 'Laine ' + fr, { tex: 'wool_' + k, hardness: 0.8, sound: 'wool' });
});
blk(B.BIRCH_PLANKS, 'birch_planks', 'Planches de bouleau', { tex: 'birch_planks', hardness: 2, tool: 'axe', sound: 'wood' });
blk(B.SPRUCE_PLANKS, 'spruce_planks', 'Planches de sapin', { tex: 'spruce_planks', hardness: 2, tool: 'axe', sound: 'wood' });
blk(B.SMOOTH_STONE, 'smooth_stone', 'Pierre lisse', { tex: 'smooth_stone', hardness: 2, tool: 'pickaxe', minTier: 1 });
blk(B.OBSIDIAN, 'obsidian', 'Obsidienne', { tex: 'obsidian', hardness: 25, tool: 'pickaxe', minTier: 4 });
blk(B.CLAY, 'clay', 'Argile', { tex: 'clay', hardness: 0.6, tool: 'shovel', sound: 'gravel' });

export const BLOCK_COUNT = BLOCKS.length;

// ---- Objets ----
export const ITEMS = [];
function item(id, key, name, props = {}) {
  ITEMS[id] = Object.assign({ id, key, name, maxStack: 64, isBlock: false }, props);
}
item(I.STICK, 'stick', 'Bâton');
item(I.COAL, 'coal', 'Charbon', { fuel: 8 });
item(I.CHARCOAL, 'charcoal', 'Charbon de bois', { fuel: 8 });
item(I.IRON_INGOT, 'iron_ingot', 'Lingot de fer');
item(I.GOLD_INGOT, 'gold_ingot', 'Lingot d\'or');
item(I.DIAMOND, 'diamond', 'Diamant');
item(I.APPLE, 'apple', 'Pomme', { food: 4 });
item(I.PORK_RAW, 'pork_raw', 'Côtelette crue', { food: 3 });
item(I.PORK_COOKED, 'pork_cooked', 'Côtelette cuite', { food: 8 });
item(I.MUTTON_RAW, 'mutton_raw', 'Mouton cru', { food: 2 });
item(I.MUTTON_COOKED, 'mutton_cooked', 'Mouton cuit', { food: 6 });
item(I.ROTTEN_FLESH, 'rotten_flesh', 'Chair putréfiée', { food: 4 });
item(I.BREAD, 'bread', 'Pain', { food: 5 });

const MATS = [
  ['wood', 'en bois', 1, 2, 60],
  ['stone', 'en pierre', 2, 4, 132],
  ['iron', 'en fer', 3, 6, 251],
  ['diamond', 'en diamant', 4, 8, 1562],
];
const TOOLS = [
  ['pickaxe', 'Pioche', I.WOOD_PICKAXE, 2],
  ['axe', 'Hache', I.WOOD_AXE, 3],
  ['shovel', 'Pelle', I.WOOD_SHOVEL, 1.5],
  ['sword', 'Épée', I.WOOD_SWORD, 4],
];
for (const [tool, toolName, baseId, dmg] of TOOLS) {
  MATS.forEach(([mat, matName, tier, speed, dur], i) => {
    item(baseId + i, mat + '_' + tool, toolName + ' ' + matName, {
      maxStack: 1,
      tool: { type: tool, tier, speed, durability: dur, material: mat },
      damage: dmg + i + (tool === 'sword' ? 0 : 0),
    });
  });
}

// Blocs comme objets.
for (const b of BLOCKS) {
  if (!b || b.id === B.AIR) continue;
  ITEMS[b.id] = { id: b.id, key: b.key, name: b.name, maxStack: 64, isBlock: true, block: b };
}
ITEMS[B.OAK_LOG].fuel = 2; ITEMS[B.BIRCH_LOG].fuel = 2; ITEMS[B.SPRUCE_LOG].fuel = 2;
ITEMS[B.OAK_PLANKS].fuel = 1; ITEMS[B.BIRCH_PLANKS].fuel = 1; ITEMS[B.SPRUCE_PLANKS].fuel = 1;
ITEMS[I.STICK].fuel = 0.5;

export function itemDef(id) { return ITEMS[id]; }
export function blockDef(id) { return BLOCKS[id] || BLOCKS[0]; }

// Tables rapides pour le moteur.
export const IS_SOLID = new Uint8Array(256);
export const IS_OPAQUE = new Uint8Array(256);
export const IS_CROSS = new Uint8Array(256);
export const LIGHT = new Uint8Array(256);
for (const b of BLOCKS) {
  if (!b) continue;
  IS_SOLID[b.id] = b.solid ? 1 : 0;
  IS_OPAQUE[b.id] = b.opaque ? 1 : 0;
  IS_CROSS[b.id] = b.cross ? 1 : 0;
  LIGHT[b.id] = b.light;
}
// 255 = chunk non chargé : solide pour la physique, invisible au rendu.
IS_SOLID[255] = 1;

// Ce qu'un bloc laisse tomber quand on le casse.
export function dropsFor(id, toolDef, rng) {
  const b = BLOCKS[id];
  if (!b || b.drop == null) return [];
  if (b.minTier > 0) {
    const t = toolDef && toolDef.tool;
    if (!t || t.type !== b.tool || t.tier < b.minTier) return [];
  }
  if (b.drop === 'leaves') {
    if (id === B.OAK_LEAVES && rng() < 0.06) return [[I.APPLE, 1]];
    if (rng() < 0.05) return [[I.STICK, 1]];
    return [];
  }
  if (id === B.GRAVEL) return [[B.GRAVEL, 1]];
  return [[b.drop, 1]];
}

// Temps (s) pour casser un bloc avec l'objet tenu.
export function breakTime(id, toolDef) {
  const b = BLOCKS[id];
  if (!b || b.hardness < 0) return Infinity;
  if (b.hardness === 0) return 0.05;
  const t = toolDef && toolDef.tool;
  const rightTool = t && b.tool && t.type === b.tool;
  const canHarvest = b.minTier === 0 || (rightTool && t.tier >= b.minTier);
  let speed = rightTool ? t.speed : 1;
  if (b.leaves && t && t.type === 'sword') speed = 2;
  return (b.hardness * (canHarvest ? 1.5 : 5)) / speed;
}
