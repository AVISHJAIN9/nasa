// Spaceflight Standard Nutrition & Hydration Menu (F026)
// Targets: 2800 kcal, 100 g protein, 2300 mg sodium, 2.5 L (2500 mL) fluids

export interface FoodItem {
  id: string;
  name: string;
  category: 'meal' | 'snack' | 'drink' | 'rehydration';
  portion: string;
  kcal: number;
  protein: number; // grams
  sodium: number; // mg
  fluid: number; // mL
  icon: string;
}

export const SPACE_FOOD_DATABASE: FoodItem[] = [
  {
    id: 'food-1',
    name: 'Rehydrated Beef Fajita with Tortilla',
    category: 'meal',
    portion: '1 pouch (240g)',
    kcal: 480,
    protein: 34,
    sodium: 520,
    fluid: 180,
    icon: '🥩',
  },
  {
    id: 'food-2',
    name: 'Thermo-stabilized Chicken Teriyaki',
    category: 'meal',
    portion: '1 pouch (210g)',
    kcal: 410,
    protein: 32,
    sodium: 460,
    fluid: 150,
    icon: '🍗',
  },
  {
    id: 'food-3',
    name: 'Freeze-Dried Scrambled Eggs & Bacon',
    category: 'meal',
    portion: '1 sachet (150g)',
    kcal: 320,
    protein: 22,
    sodium: 380,
    fluid: 120,
    icon: '🍳',
  },
  {
    id: 'food-4',
    name: 'Irradiated Smoked Salmon Fillet',
    category: 'meal',
    portion: '1 pouch (160g)',
    kcal: 290,
    protein: 28,
    sodium: 410,
    fluid: 90,
    icon: '🐟',
  },
  {
    id: 'food-5',
    name: 'Spinach & Sweet Corn Puree',
    category: 'meal',
    portion: '1 pack (180g)',
    kcal: 180,
    protein: 6,
    sodium: 210,
    fluid: 160,
    icon: '🥬',
  },
  {
    id: 'food-6',
    name: 'Cinnamon Granola with Blueberries',
    category: 'snack',
    portion: '1 packet (100g)',
    kcal: 360,
    protein: 10,
    sodium: 140,
    fluid: 60,
    icon: '🥣',
  },
  {
    id: 'food-7',
    name: 'Almond & Dried Cranberry Trail Mix',
    category: 'snack',
    portion: '1 pouch (85g)',
    kcal: 380,
    protein: 11,
    sodium: 95,
    fluid: 20,
    icon: '🥜',
  },
  {
    id: 'food-8',
    name: 'Space Station Tortillas (3-pack)',
    category: 'snack',
    portion: '3 small wraps',
    kcal: 260,
    protein: 7,
    sodium: 280,
    fluid: 30,
    icon: '🫓',
  },
  {
    id: 'food-9',
    name: 'Mango-Peach Fruit Puree',
    category: 'snack',
    portion: '1 pouch (120g)',
    kcal: 140,
    protein: 2,
    sodium: 25,
    fluid: 110,
    icon: '🥭',
  },
  {
    id: 'food-10',
    name: 'Electrolyte Mineral Hydration Drink',
    category: 'rehydration',
    portion: '500 mL pouch',
    kcal: 60,
    protein: 0,
    sodium: 320,
    fluid: 500,
    icon: '⚡',
  },
  {
    id: 'food-11',
    name: 'Potable Drinking Water (Chilled)',
    category: 'drink',
    portion: '500 mL pouch',
    kcal: 0,
    protein: 0,
    sodium: 15,
    fluid: 500,
    icon: '💧',
  },
  {
    id: 'food-12',
    name: 'Space Blend Black Coffee / Green Tea',
    category: 'drink',
    portion: '350 mL pouch',
    kcal: 15,
    protein: 1,
    sodium: 10,
    fluid: 350,
    icon: '☕',
  },
];

export const NUTRITION_TARGETS = {
  kcal: 2800,
  protein: 100, // g
  sodium: 2300, // mg
  fluid: 2500, // mL (2.5 L)
} as const;
