// Layer 1 of "expense title -> sticker": an instant, offline keyword map
// (English + Hindi/Hinglish). Pure; no DOM.

export const SCENES = ['beach', 'city', 'mountain', 'food', 'transport', 'stay', 'fun', 'misc'];

// Order matters: earlier rows win, so "Airport cab" is a cab, not a flight.
export const STICKER_RULES = [
  { kind: 'rickshaw', scene: 'transport', words: ['auto', 'autowala', 'autowale', 'autorickshaw', 'rickshaw', 'tuk tuk', 'tuktuk', 'cab', 'uber', 'ola', 'taxi', 'rapido', 'toto'] },
  { kind: 'bike', scene: 'transport', words: ['bike', 'scooty', 'scooter', 'activa', 'bullet', 'moped', 'cycle'] },
  { kind: 'fuel', scene: 'transport', words: ['petrol', 'diesel', 'fuel', 'pump', 'cng', 'toll', 'parking', 'tanki'] },
  { kind: 'plane', scene: 'transport', words: ['flight', 'airport', 'plane', 'indigo', 'vistara', 'airline', 'boarding'] },
  { kind: 'train', scene: 'transport', words: ['train', 'rail', 'railway', 'irctc', 'metro', 'tatkal', 'sleeper'] },
  { kind: 'bus', scene: 'transport', words: ['bus', 'volvo', 'redbus', 'shuttle'] },
  { kind: 'hotel', scene: 'stay', words: ['hotel', 'stay', 'room', 'hostel', 'airbnb', 'oyo', 'resort', 'homestay', 'lodge', 'villa', 'checkin', 'check-in'] },
  { kind: 'diver', scene: 'beach', words: ['scuba', 'diving', 'dive', 'snorkel', 'snorkeling', 'snorkelling'] },
  { kind: 'waves', scene: 'beach', words: ['swimming', 'swim', 'pool', 'beach', 'sea', 'samundar', 'surf', 'surfing', 'kayak', 'parasailing', 'jet ski', 'boat', 'cruise', 'ferry'] },
  { kind: 'mountain', scene: 'mountain', words: ['trek', 'trekking', 'hike', 'hiking', 'pahad', 'summit', 'peak', 'climb'] },
  { kind: 'tent', scene: 'mountain', words: ['camping', 'camp', 'tent', 'bonfire', 'campfire'] },
  { kind: 'chai', scene: 'food', words: ['chai', 'coffee', 'tea', 'cafe', 'kulhad', 'cappuccino', 'latte', 'starbucks'] },
  { kind: 'beer', scene: 'food', words: ['beer', 'drinks', 'drink', 'daaru', 'daru', 'bar', 'pub', 'peg', 'whisky', 'whiskey', 'wine', 'vodka', 'rum', 'cocktail', 'hookah'] },
  { kind: 'pizza', scene: 'food', words: ['pizza', 'burger', 'momo', 'momos', 'maggi', 'fries', 'sandwich', 'vada pav', 'pav bhaji', 'dominos', 'kfc', 'mcd', 'mcdonalds'] },
  { kind: 'plate', scene: 'food', words: ['food', 'lunch', 'dinner', 'breakfast', 'brunch', 'khana', 'nashta', 'thali', 'dhaba', 'restaurant', 'meal', 'biryani', 'dosa', 'paratha', 'snack', 'snacks', 'swiggy', 'zomato'] },
  { kind: 'cart', scene: 'food', words: ['groceries', 'grocery', 'kirana', 'sabzi', 'ration', 'mart', 'dmart', 'blinkit', 'zepto', 'instamart', 'supermarket'] },
  { kind: 'clapper', scene: 'fun', words: ['movie', 'film', 'cinema', 'entertainment', 'pvr', 'inox', 'netflix'] },
  { kind: 'ticket', scene: 'fun', words: ['ticket', 'tickets', 'entry', 'museum', 'fort', 'zoo', 'darshan'] },
  { kind: 'party', scene: 'fun', words: ['party', 'club', 'dj', 'birthday', 'celebration', 'cake'] },
  { kind: 'gift', scene: 'fun', words: ['gift', 'tohfa', 'present', 'souvenir', 'souvenirs'] },
  { kind: 'bag', scene: 'city', words: ['shopping', 'shop', 'mall', 'kapde', 'clothes', 'bag', 'market', 'bazaar', 'shoes'] },
  { kind: 'medicine', scene: 'city', words: ['medicine', 'medicines', 'dawai', 'dawa', 'pharmacy', 'chemist', 'doctor', 'hospital'] },
  { kind: 'wifi', scene: 'city', words: ['wifi', 'wi-fi', 'recharge', 'sim', 'data', 'internet', 'jio', 'airtel', 'hotspot'] },
  { kind: 'tips', scene: 'misc', words: ['tip', 'tips', 'baksheesh', 'guide', 'donation'] },
];

/** Every kind that has a hand-drawn SVG sticker. */
export const STICKER_KINDS = new Set([...STICKER_RULES.map((r) => r.kind), 'pin']);

export const DEFAULT_STICKER = Object.freeze({ kind: 'pin', scene: 'misc', emoji: null, caption: null, source: 'default' });

const escape = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Whole-word match with an optional plural ("bikes", "taxis").
const compiled = STICKER_RULES.map((r) => ({
  ...r,
  re: new RegExp(`(^|[^a-z])(${r.words.map(escape).join('|')})(s|es)?(?=[^a-z]|$)`),
}));

/**
 * @param {string} title
 * @returns {{ kind: string, scene: string } | null}
 */
export function keywordSticker(title) {
  const text = String(title || '').toLowerCase();
  if (!text.trim()) return null;
  const hit = compiled.find((r) => r.re.test(text));
  return hit ? { kind: hit.kind, scene: hit.scene } : null;
}
