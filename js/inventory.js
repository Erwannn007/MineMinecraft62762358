// Inventaire (36 cases : 0-8 barre rapide, 9-35 sac) et recettes.
import { B, I, itemDef } from './blocks.js';

export const maxStack = (id) => itemDef(id)?.maxStack ?? 64;

export class Inventory {
  constructor(size = 36, slots) {
    this.size = size;
    this.slots = slots ? slots.map((s) => (s ? { ...s } : null)) : new Array(size).fill(null);
  }

  // Ajoute des objets ; renvoie ce qui n'a pas pu rentrer.
  add(id, count, dmg = 0) {
    const ms = maxStack(id);
    for (let i = 0; i < this.size && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < ms && ms > 1) {
        const n = Math.min(count, ms - s.count);
        s.count += n; count -= n;
      }
    }
    for (let i = 0; i < this.size && count > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(count, ms);
        this.slots[i] = { id, count: n, dmg };
        count -= n;
      }
    }
    return count;
  }

  count(ids) {
    const set = Array.isArray(ids) ? ids : [ids];
    let n = 0;
    for (const s of this.slots) if (s && set.includes(s.id)) n += s.count;
    return n;
  }

  remove(ids, count) {
    const set = Array.isArray(ids) ? ids : [ids];
    for (let i = this.size - 1; i >= 0 && count > 0; i--) {
      const s = this.slots[i];
      if (s && set.includes(s.id)) {
        const n = Math.min(count, s.count);
        s.count -= n; count -= n;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    return count === 0;
  }

  toJSON() { return this.slots; }
}

// ---- Recettes ----
const PLANKS = [B.OAK_PLANKS, B.BIRCH_PLANKS, B.SPRUCE_PLANKS];
const LOGS = [B.OAK_LOG, B.BIRCH_LOG, B.SPRUCE_LOG];
const COALS = [I.COAL, I.CHARCOAL];

// station : null (inventaire), 'table' (établi), 'furnace' (four)
export const RECIPES = [];
const r = (out, count, inputs, station = null, cat = 'blocs') => RECIPES.push({ out, count, inputs, station, cat });

r(B.OAK_PLANKS, 4, [[B.OAK_LOG, 1]], null, 'base');
r(B.BIRCH_PLANKS, 4, [[B.BIRCH_LOG, 1]], null, 'base');
r(B.SPRUCE_PLANKS, 4, [[B.SPRUCE_LOG, 1]], null, 'base');
r(I.STICK, 4, [[PLANKS, 2]], null, 'base');
r(B.CRAFTING_TABLE, 1, [[PLANKS, 4]], null, 'base');
r(B.TORCH, 4, [[COALS, 1], [I.STICK, 1]], null, 'base');

const TOOL_MATS = [[PLANKS, 0], [B.COBBLE, 1], [I.IRON_INGOT, 2], [I.DIAMOND, 3]];
for (const [mat, i] of TOOL_MATS) {
  r(I.WOOD_PICKAXE + i, 1, [[mat, 3], [I.STICK, 2]], 'table', 'outils');
  r(I.WOOD_AXE + i, 1, [[mat, 3], [I.STICK, 2]], 'table', 'outils');
  r(I.WOOD_SHOVEL + i, 1, [[mat, 1], [I.STICK, 2]], 'table', 'outils');
  r(I.WOOD_SWORD + i, 1, [[mat, 2], [I.STICK, 1]], 'table', 'outils');
}

r(B.CHEST, 1, [[PLANKS, 8]], 'table');
r(B.FURNACE, 1, [[B.COBBLE, 8]], 'table');
r(B.STONE_BRICKS, 4, [[B.STONE, 4]]);
r(B.SANDSTONE, 1, [[B.SAND, 4]]);
r(B.LAMP, 1, [[B.GLASS, 1], [B.TORCH, 4]], 'table');
r(B.BOOKSHELF, 1, [[PLANKS, 6], [I.STICK, 3]], 'table');
r(B.MOSSY_COBBLE, 1, [[B.COBBLE, 1], [B.TALL_GRASS, 1]]);
r(B.WOOL_RED, 1, [[B.WOOL_WHITE, 1], [B.FLOWER_RED, 1]]);
r(B.WOOL_YELLOW, 1, [[B.WOOL_WHITE, 1], [B.FLOWER_YELLOW, 1]]);
r(B.WOOL_ORANGE, 2, [[B.WOOL_WHITE, 2], [B.FLOWER_RED, 1], [B.FLOWER_YELLOW, 1]]);
r(B.WOOL_PINK, 2, [[B.WOOL_WHITE, 2], [B.FLOWER_RED, 1]]);
r(B.WOOL_BLACK, 1, [[B.WOOL_WHITE, 1], [COALS, 1]]);
r(B.WOOL_GRAY, 2, [[B.WOOL_WHITE, 2], [COALS, 1]]);
r(I.BREAD, 1, [[B.TALL_GRASS, 6]], 'table', 'nourriture');

// Four
const f = (out, input, cat = 'four') => r(out, 1, [[input, 1]], 'furnace', cat);
f(B.GLASS, B.SAND);
f(B.STONE, B.COBBLE);
f(B.SMOOTH_STONE, B.STONE);
f(I.IRON_INGOT, B.IRON_ORE);
f(I.GOLD_INGOT, B.GOLD_ORE);
f(B.BRICKS, B.CLAY);
f(I.CHARCOAL, LOGS);
f(I.PORK_COOKED, I.PORK_RAW);
f(I.MUTTON_COOKED, I.MUTTON_RAW);

export function canCraft(inv, rec) {
  return rec.inputs.every(([ids, n]) => inv.count(ids) >= n);
}

export function craft(inv, rec) {
  if (!canCraft(inv, rec)) return false;
  for (const [ids, n] of rec.inputs) inv.remove(ids, n);
  return true;
}
