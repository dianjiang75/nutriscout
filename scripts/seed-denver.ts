/**
 * Seed script for FoodClaw — Denver, Colorado restaurant data.
 * Populates the database with real Denver restaurants and dishes across
 * LoDo, RiNo, Capitol Hill, Cherry Creek, Highlands, and South Broadway.
 *
 * Sources: Google Maps, Yelp, Tripadvisor, restaurant websites (March 2026)
 *
 * Usage: npx tsx scripts/seed-denver.ts
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Denver metro center coordinates
const BASE_LAT = 39.7392;
const BASE_LNG = -104.9903;

// Neighborhood center coords for realistic placement
const NEIGHBORHOODS: Record<string, { lat: number; lng: number }> = {
  LoDo:           { lat: 39.7533, lng: -104.9997 },
  RiNo:           { lat: 39.7650, lng: -104.9803 },
  "Capitol Hill": { lat: 39.7312, lng: -104.9784 },
  "Cherry Creek": { lat: 39.7170, lng: -104.9530 },
  Highlands:      { lat: 39.7620, lng: -105.0100 },
  "South Broadway":{ lat: 39.7190, lng: -104.9875 },
};

function jitter(base: number, range = 0.003): number {
  return base + (Math.random() - 0.5) * range;
}

// ─── Real Denver Restaurants ──────────────────────────────────────────────────

interface RestaurantDef {
  name: string;
  address: string;
  neighborhood: string;
  cuisine: string[];
  price: number;     // 1-4
  rating: number;    // Google rating
  yelp: number;
  phone: string;
  website: string;
}

const RESTAURANTS: RestaurantDef[] = [
  // ── Thai ──
  {
    name: "Aloy Modern Thai",
    address: "2134 Larimer St, Denver, CO 80205",
    neighborhood: "LoDo",
    cuisine: ["Thai"],
    price: 2,
    rating: 4.5,
    yelp: 4.0,
    phone: "303-379-9759",
    website: "https://www.aloythai.com/modern-thai/",
  },
  {
    name: "Daughter Thai Kitchen",
    address: "1700 Platte St, Denver, CO 80202",
    neighborhood: "Highlands",
    cuisine: ["Thai"],
    price: 3,
    rating: 4.6,
    yelp: 4.5,
    phone: "720-485-5820",
    website: "https://www.daughterthai.com/",
  },

  // ── Japanese ──
  {
    name: "Uchi Denver",
    address: "2500 Lawrence St, Denver, CO 80205",
    neighborhood: "RiNo",
    cuisine: ["Japanese"],
    price: 4,
    rating: 4.6,
    yelp: 4.5,
    phone: "303-801-1622",
    website: "https://uchi.uchirestaurants.com/location/sushi-denver/",
  },
  {
    name: "Sushi-Rama RiNo",
    address: "2933 Brighton Blvd, Denver, CO 80216",
    neighborhood: "RiNo",
    cuisine: ["Japanese"],
    price: 2,
    rating: 4.3,
    yelp: 4.0,
    phone: "720-582-4852",
    website: "https://sushi-rama.com/sushi-restaurants/sushi-rino/",
  },
  {
    name: "Uncle",
    address: "2215 W 32nd Ave, Denver, CO 80211",
    neighborhood: "Highlands",
    cuisine: ["Japanese"],
    price: 2,
    rating: 4.5,
    yelp: 4.5,
    phone: "303-433-3263",
    website: "https://www.uncleramen.com/",
  },

  // ── Italian ──
  {
    name: "Barolo Grill",
    address: "3030 E 6th Ave, Denver, CO 80206",
    neighborhood: "Cherry Creek",
    cuisine: ["Italian"],
    price: 4,
    rating: 4.6,
    yelp: 4.5,
    phone: "303-393-1040",
    website: "https://www.barologrilldenver.com/",
  },
  {
    name: "North Italia",
    address: "190 Clayton Ln, Denver, CO 80206",
    neighborhood: "Cherry Creek",
    cuisine: ["Italian"],
    price: 3,
    rating: 4.4,
    yelp: 4.0,
    phone: "303-309-4500",
    website: "https://www.northitalia.com/locations/denver-co-cherry-creek-shopping-center/",
  },

  // ── Mexican ──
  {
    name: "Alma Fonda Fina",
    address: "2556 15th St, Denver, CO 80211",
    neighborhood: "Highlands",
    cuisine: ["Mexican"],
    price: 4,
    rating: 4.8,
    yelp: 4.5,
    phone: "720-904-8586",
    website: "https://www.almalohidenver.com/",
  },
  {
    name: "Chili Verde",
    address: "2311 Federal Blvd, Denver, CO 80211",
    neighborhood: "Highlands",
    cuisine: ["Mexican"],
    price: 2,
    rating: 4.4,
    yelp: 4.0,
    phone: "303-936-9035",
    website: "https://www.chiliverdedenver.com/",
  },

  // ── Indian ──
  {
    name: "Spice Room",
    address: "3100 E Colfax Ave, Denver, CO 80206",
    neighborhood: "Capitol Hill",
    cuisine: ["Indian"],
    price: 2,
    rating: 4.9,
    yelp: 4.5,
    phone: "303-309-4740",
    website: "https://denverspiceroom.com/",
  },
  {
    name: "Little India",
    address: "330 E 6th Ave, Denver, CO 80203",
    neighborhood: "Capitol Hill",
    cuisine: ["Indian"],
    price: 2,
    rating: 4.4,
    yelp: 4.0,
    phone: "303-871-9777",
    website: "https://littleindiaofdenver.com/",
  },

  // ── Chinese ──
  {
    name: "Hop Alley",
    address: "3500 Larimer St, Denver, CO 80205",
    neighborhood: "RiNo",
    cuisine: ["Chinese"],
    price: 3,
    rating: 4.4,
    yelp: 4.0,
    phone: "720-379-8340",
    website: "https://hopalleydenver.com/",
  },
  {
    name: "Imperial Chinese",
    address: "431 S Broadway, Denver, CO 80209",
    neighborhood: "South Broadway",
    cuisine: ["Chinese"],
    price: 2,
    rating: 4.3,
    yelp: 4.0,
    phone: "303-698-2800",
    website: "https://imperialchinese.com/",
  },

  // ── Korean ──
  {
    name: "Dae Gee Korean BBQ",
    address: "460 Broadway, Denver, CO 80203",
    neighborhood: "South Broadway",
    cuisine: ["Korean"],
    price: 2,
    rating: 4.2,
    yelp: 4.0,
    phone: "303-722-8282",
    website: "https://daegee.com/",
  },

  // ── Mediterranean ──
  {
    name: "Safta",
    address: "3330 Brighton Blvd, Denver, CO 80216",
    neighborhood: "RiNo",
    cuisine: ["Mediterranean", "Israeli"],
    price: 3,
    rating: 4.6,
    yelp: 4.5,
    phone: "303-543-5414",
    website: "https://www.eatwithsafta.com/",
  },
  {
    name: "Rioja",
    address: "1431 Larimer St, Denver, CO 80202",
    neighborhood: "LoDo",
    cuisine: ["Mediterranean"],
    price: 3,
    rating: 4.5,
    yelp: 4.5,
    phone: "303-820-2282",
    website: "https://www.riojadenver.com/",
  },
  {
    name: "Ash'Kara",
    address: "2005 W 33rd Ave, Denver, CO 80211",
    neighborhood: "Highlands",
    cuisine: ["Mediterranean"],
    price: 3,
    rating: 4.7,
    yelp: 4.5,
    phone: "303-862-4493",
    website: "https://www.ashkaradenver.com/",
  },

  // ── American ──
  {
    name: "Guard and Grace",
    address: "1801 California St, Denver, CO 80202",
    neighborhood: "LoDo",
    cuisine: ["American"],
    price: 4,
    rating: 4.7,
    yelp: 4.5,
    phone: "303-293-8500",
    website: "https://www.guardandgrace.com/",
  },
  {
    name: "Work & Class",
    address: "2500 Larimer St, Ste 101, Denver, CO 80205",
    neighborhood: "RiNo",
    cuisine: ["American", "Latin American"],
    price: 2,
    rating: 4.6,
    yelp: 4.5,
    phone: "303-292-0700",
    website: "https://www.workandclassdenver.com/",
  },

  // ── Vietnamese ──
  {
    name: "Pho 95",
    address: "1401 S Federal Blvd, Denver, CO 80219",
    neighborhood: "South Broadway",
    cuisine: ["Vietnamese"],
    price: 1,
    rating: 4.4,
    yelp: 4.0,
    phone: "303-936-3322",
    website: "https://pho95noodlehouse.com/",
  },
  {
    name: "Pho-natic",
    address: "2020 Lawrence St, Denver, CO 80205",
    neighborhood: "LoDo",
    cuisine: ["Vietnamese"],
    price: 2,
    rating: 4.3,
    yelp: 4.0,
    phone: "720-485-6795",
    website: "https://phodenver.com/",
  },
];

// ─── Dishes per cuisine (real menu items, estimated nutrition) ─────────────

interface DishDef {
  name: string;
  desc: string;
  price: number;
  category: string;
  cal: [number, number];
  protein: [number, number];
  carbs: [number, number];
  fat: [number, number];
  flags: Record<string, boolean>;
  confidence: number;
  source: "vision_ai" | "usda_match" | "restaurant_published";
  photos: number;
  ingredients: string;
}

const DISH_TEMPLATES: Record<string, DishDef[]> = {
  Thai: [
    { name: "Pad Thai", desc: "Stir-fried rice noodles with shrimp, peanuts, bean sprouts, and tamarind", price: 16.00, category: "Mains", cal: [480, 560], protein: [18, 24], carbs: [55, 65], fat: [18, 24], flags: { gluten_free: true }, confidence: 0.85, source: "vision_ai", photos: 8, ingredients: "rice noodles, shrimp, eggs, peanuts, bean sprouts, lime, tamarind" },
    { name: "Panang Curry", desc: "Rich coconut curry with slow-roasted duck breast and Thai basil", price: 22.00, category: "Mains", cal: [520, 620], protein: [28, 36], carbs: [18, 28], fat: [34, 42], flags: { gluten_free: true, dairy_free: true }, confidence: 0.82, source: "vision_ai", photos: 6, ingredients: "coconut milk, panang curry paste, duck breast, Thai basil, kaffir lime" },
    { name: "Drunken Noodles", desc: "Wide rice noodles with chili, Thai basil, and vegetables", price: 15.00, category: "Mains", cal: [510, 600], protein: [20, 28], carbs: [58, 68], fat: [20, 28], flags: { dairy_free: true }, confidence: 0.80, source: "vision_ai", photos: 5, ingredients: "wide rice noodles, Thai basil, chili, garlic, bell peppers, soy sauce" },
    { name: "Tom Kha Gai", desc: "Coconut chicken soup with galangal, lemongrass, and mushrooms", price: 12.00, category: "Soups", cal: [280, 350], protein: [20, 26], carbs: [12, 18], fat: [18, 24], flags: { gluten_free: true, dairy_free: true }, confidence: 0.78, source: "vision_ai", photos: 4, ingredients: "coconut milk, chicken, galangal, lemongrass, mushrooms, lime leaves" },
    { name: "Mango Sticky Rice", desc: "Sweet sticky rice with fresh mango and coconut cream", price: 10.00, category: "Desserts", cal: [350, 420], protein: [4, 6], carbs: [65, 78], fat: [10, 14], flags: { vegan: true, gluten_free: true, nut_free: true }, confidence: 0.90, source: "usda_match", photos: 5, ingredients: "sticky rice, mango, coconut cream, sugar" },
  ],
  Japanese: [
    { name: "Hamachi Crudo", desc: "Yellowtail with yuzu, jalapeno, and ponzu", price: 19.00, category: "Appetizers", cal: [180, 240], protein: [18, 24], carbs: [5, 10], fat: [10, 16], flags: { gluten_free: true, dairy_free: true }, confidence: 0.84, source: "vision_ai", photos: 6, ingredients: "hamachi, yuzu, jalapeno, ponzu, micro greens" },
    { name: "Wagyu Tartare Nigiri", desc: "Seared wagyu beef on seasoned rice with truffle soy", price: 24.00, category: "Sushi", cal: [220, 280], protein: [14, 20], carbs: [20, 28], fat: [12, 18], flags: { dairy_free: true }, confidence: 0.80, source: "vision_ai", photos: 7, ingredients: "wagyu beef, sushi rice, truffle soy, scallion, sesame" },
    { name: "Spicy Tuna Roll", desc: "Spicy tuna with cucumber and sriracha aioli", price: 16.00, category: "Sushi", cal: [320, 400], protein: [20, 26], carbs: [38, 48], fat: [10, 16], flags: { dairy_free: true }, confidence: 0.86, source: "vision_ai", photos: 8, ingredients: "tuna, sushi rice, nori, cucumber, sriracha, mayo" },
    { name: "Chicken Karaage", desc: "Japanese fried chicken with yuzu aioli", price: 13.00, category: "Appetizers", cal: [380, 460], protein: [24, 32], carbs: [22, 30], fat: [20, 28], flags: { nut_free: true }, confidence: 0.82, source: "vision_ai", photos: 5, ingredients: "chicken thigh, potato starch, ginger, garlic, soy sauce, yuzu" },
    { name: "Tonkotsu Ramen", desc: "Rich pork bone broth with chashu, ajitama egg, and noodles", price: 16.00, category: "Mains", cal: [620, 740], protein: [32, 42], carbs: [55, 68], fat: [28, 38], flags: { dairy_free: true }, confidence: 0.82, source: "vision_ai", photos: 7, ingredients: "pork bone broth, chashu pork, ramen noodles, soft egg, nori, scallion" },
    { name: "Pork Gyoza (6pc)", desc: "Pan-fried pork dumplings with ponzu dipping sauce", price: 10.00, category: "Appetizers", cal: [280, 350], protein: [14, 18], carbs: [28, 36], fat: [12, 18], flags: { dairy_free: true, nut_free: true }, confidence: 0.84, source: "vision_ai", photos: 4, ingredients: "pork, cabbage, ginger, garlic, gyoza wrapper, ponzu" },
  ],
  Italian: [
    { name: "Tagliatelle ai Funghi", desc: "Housemade pasta with wild mushrooms and truffle butter", price: 35.00, category: "Mains", cal: [580, 680], protein: [18, 24], carbs: [62, 74], fat: [28, 36], flags: { vegetarian: true, nut_free: true }, confidence: 0.82, source: "vision_ai", photos: 5, ingredients: "egg pasta, porcini, chanterelles, truffle butter, Parmigiano" },
    { name: "Agnolotti di Zucca", desc: "Handmade pasta stuffed with butternut squash and cheese", price: 36.00, category: "Mains", cal: [520, 620], protein: [16, 22], carbs: [58, 70], fat: [24, 32], flags: { vegetarian: true, nut_free: true }, confidence: 0.80, source: "vision_ai", photos: 4, ingredients: "pasta, butternut squash, ricotta, sage, brown butter, Parmigiano" },
    { name: "Margherita Pizza", desc: "Wood-fired pizza with San Marzano tomatoes, fresh mozzarella, basil", price: 18.00, category: "Mains", cal: [680, 820], protein: [28, 36], carbs: [72, 88], fat: [28, 36], flags: { vegetarian: true, nut_free: true }, confidence: 0.88, source: "vision_ai", photos: 7, ingredients: "pizza dough, San Marzano tomatoes, mozzarella, basil, olive oil" },
    { name: "Vitello Tonnato", desc: "Thinly sliced veal tenderloin with tuna caper sauce", price: 23.00, category: "Appetizers", cal: [320, 400], protein: [30, 38], carbs: [5, 10], fat: [18, 26], flags: { gluten_free: true, nut_free: true }, confidence: 0.78, source: "vision_ai", photos: 4, ingredients: "veal tenderloin, tuna, capers, lemon, anchovy, olive oil" },
    { name: "Tiramisu", desc: "Classic espresso-soaked ladyfingers with mascarpone cream", price: 14.00, category: "Desserts", cal: [380, 460], protein: [8, 12], carbs: [38, 48], fat: [22, 30], flags: { vegetarian: true, nut_free: true }, confidence: 0.86, source: "vision_ai", photos: 5, ingredients: "mascarpone, espresso, ladyfingers, cocoa, eggs, sugar" },
  ],
  Mexican: [
    { name: "Camote Asado", desc: "Agave-roasted sweet potato with mole and crema", price: 16.00, category: "Appetizers", cal: [320, 400], protein: [5, 8], carbs: [48, 58], fat: [14, 20], flags: { vegetarian: true, gluten_free: true, nut_free: true }, confidence: 0.82, source: "vision_ai", photos: 5, ingredients: "sweet potato, agave, mole, crema, cilantro" },
    { name: "Enmoladas de Pollo", desc: "Chicken enchiladas in house-made mole negro", price: 28.00, category: "Mains", cal: [580, 700], protein: [32, 40], carbs: [42, 52], fat: [28, 36], flags: { nut_free: false }, confidence: 0.80, source: "vision_ai", photos: 6, ingredients: "corn tortillas, chicken, mole negro, sesame, queso fresco" },
    { name: "Birria Tacos (3pc)", desc: "Slow-braised beef birria tacos with consomme for dipping", price: 15.00, category: "Mains", cal: [520, 640], protein: [30, 38], carbs: [35, 45], fat: [24, 32], flags: { gluten_free: true, nut_free: true }, confidence: 0.84, source: "vision_ai", photos: 7, ingredients: "corn tortillas, beef birria, onion, cilantro, lime, consomme" },
    { name: "Guacamole Tableside", desc: "Made-to-order guacamole with house tortilla chips", price: 14.00, category: "Appetizers", cal: [320, 400], protein: [5, 8], carbs: [30, 40], fat: [22, 28], flags: { vegan: true, gluten_free: true, nut_free: true }, confidence: 0.90, source: "usda_match", photos: 6, ingredients: "avocado, tomato, onion, cilantro, lime, jalapeño, corn chips" },
    { name: "Callo de Hacha", desc: "Pan-seared scallops with chili oil and citrus", price: 22.00, category: "Mains", cal: [280, 360], protein: [24, 32], carbs: [12, 18], fat: [16, 22], flags: { gluten_free: true, dairy_free: true }, confidence: 0.78, source: "vision_ai", photos: 4, ingredients: "scallops, chili oil, orange, lime, micro herbs" },
    { name: "Mole Poblano", desc: "Chicken in rich chocolate-chili mole with rice", price: 18.00, category: "Mains", cal: [520, 640], protein: [28, 36], carbs: [45, 55], fat: [22, 30], flags: { gluten_free: true }, confidence: 0.82, source: "vision_ai", photos: 5, ingredients: "chicken, chocolate, ancho chili, sesame, rice, tortillas" },
  ],
  Indian: [
    { name: "Butter Chicken", desc: "Tandoori chicken in a rich tomato-cream sauce with basmati rice", price: 17.00, category: "Mains", cal: [520, 640], protein: [32, 40], carbs: [35, 45], fat: [24, 32], flags: { gluten_free: true, nut_free: true }, confidence: 0.86, source: "vision_ai", photos: 8, ingredients: "chicken, tomato, cream, butter, garam masala, fenugreek, basmati rice" },
    { name: "Chicken Tikka Masala", desc: "Grilled chicken pieces in a spiced creamy tomato sauce", price: 16.50, category: "Mains", cal: [480, 580], protein: [30, 38], carbs: [28, 38], fat: [22, 30], flags: { gluten_free: true, nut_free: true }, confidence: 0.84, source: "vision_ai", photos: 7, ingredients: "chicken, yogurt, tomato, cream, tikka spices, onion, garlic" },
    { name: "Lamb Biryani", desc: "Fragrant basmati rice layered with spiced lamb and saffron", price: 19.00, category: "Mains", cal: [580, 700], protein: [28, 36], carbs: [62, 74], fat: [22, 30], flags: { gluten_free: true, nut_free: false }, confidence: 0.82, source: "vision_ai", photos: 6, ingredients: "lamb, basmati rice, saffron, fried onions, cashews, raisins, spices" },
    { name: "Palak Paneer", desc: "Creamy spinach with cubes of fresh paneer cheese", price: 15.00, category: "Mains", cal: [380, 460], protein: [18, 24], carbs: [15, 22], fat: [26, 34], flags: { vegetarian: true, gluten_free: true, nut_free: true }, confidence: 0.86, source: "vision_ai", photos: 5, ingredients: "spinach, paneer, onion, garlic, ginger, cream, cumin" },
    { name: "Garlic Naan", desc: "Tandoor-baked bread brushed with garlic butter", price: 4.50, category: "Sides", cal: [260, 320], protein: [7, 10], carbs: [38, 46], fat: [8, 14], flags: { vegetarian: true, nut_free: true }, confidence: 0.90, source: "usda_match", photos: 4, ingredients: "flour, yogurt, garlic, butter, cilantro" },
    { name: "Tandoori Chicken", desc: "Bone-in chicken marinated in yogurt and tandoori spices, char-grilled", price: 17.50, category: "Mains", cal: [380, 460], protein: [36, 44], carbs: [8, 14], fat: [18, 26], flags: { gluten_free: true, dairy_free: false, nut_free: true }, confidence: 0.88, source: "vision_ai", photos: 6, ingredients: "chicken, yogurt, tandoori masala, lemon, onion, mint chutney" },
  ],
  Chinese: [
    { name: "Dan Dan Noodles", desc: "Wheat noodles in spicy Sichuan peppercorn broth with minced pork", price: 16.00, category: "Mains", cal: [520, 640], protein: [22, 28], carbs: [55, 68], fat: [22, 30], flags: { dairy_free: true }, confidence: 0.82, source: "vision_ai", photos: 5, ingredients: "wheat noodles, sesame paste, chili oil, ground pork, Sichuan pepper, peanuts" },
    { name: "Peking Duck Roll", desc: "Crispy duck with scallion pancake, hoisin, and pickled vegetables", price: 18.00, category: "Appetizers", cal: [420, 520], protein: [22, 28], carbs: [32, 42], fat: [24, 32], flags: { dairy_free: true, nut_free: true }, confidence: 0.80, source: "vision_ai", photos: 6, ingredients: "duck, scallion pancake, hoisin sauce, cucumber, scallion" },
    { name: "Bone Marrow Fried Rice", desc: "Wok-fried rice with roasted bone marrow and scallions", price: 22.00, category: "Mains", cal: [580, 700], protein: [20, 28], carbs: [65, 78], fat: [26, 34], flags: { dairy_free: true, nut_free: true }, confidence: 0.78, source: "vision_ai", photos: 4, ingredients: "jasmine rice, bone marrow, eggs, scallions, soy sauce, sesame oil" },
    { name: "Sesame Chicken", desc: "Crispy chicken pieces with sweet sesame glaze and broccoli", price: 15.00, category: "Mains", cal: [580, 700], protein: [28, 36], carbs: [48, 60], fat: [28, 38], flags: { dairy_free: true, nut_free: true }, confidence: 0.84, source: "vision_ai", photos: 6, ingredients: "chicken, cornstarch, sesame, soy sauce, sugar, ginger, broccoli" },
    { name: "Mapo Tofu", desc: "Silky tofu in a fiery Sichuan peppercorn and chili sauce", price: 14.00, category: "Mains", cal: [320, 400], protein: [18, 24], carbs: [12, 18], fat: [22, 30], flags: { dairy_free: true, nut_free: true, vegetarian: false }, confidence: 0.82, source: "vision_ai", photos: 5, ingredients: "silken tofu, ground pork, doubanjiang, Sichuan pepper, garlic, green onion" },
  ],
  Korean: [
    { name: "Unlimited BBQ (Bulgogi & Galbi)", desc: "All-you-can-eat marinated beef bulgogi and short ribs grilled tableside", price: 27.00, category: "Mains", cal: [680, 840], protein: [42, 54], carbs: [35, 48], fat: [32, 42], flags: { gluten_free: false, dairy_free: true, nut_free: true }, confidence: 0.80, source: "vision_ai", photos: 8, ingredients: "beef bulgogi, galbi short ribs, lettuce wraps, rice, kimchi, banchan" },
    { name: "Bibimbap", desc: "Mixed rice bowl with vegetables, egg, gochujang, and choice of protein", price: 16.00, category: "Mains", cal: [520, 640], protein: [24, 32], carbs: [62, 74], fat: [16, 24], flags: { nut_free: true }, confidence: 0.84, source: "vision_ai", photos: 7, ingredients: "rice, beef, spinach, carrots, zucchini, bean sprouts, egg, gochujang" },
    { name: "Kimchi Jjigae", desc: "Fermented kimchi stew with tofu and pork belly", price: 15.00, category: "Soups", cal: [380, 460], protein: [22, 28], carbs: [18, 26], fat: [22, 30], flags: { dairy_free: true, nut_free: true }, confidence: 0.82, source: "vision_ai", photos: 5, ingredients: "kimchi, pork belly, tofu, gochugaru, garlic, green onion" },
    { name: "Tteokbokki", desc: "Chewy rice cakes in a sweet and spicy gochujang sauce", price: 12.00, category: "Appetizers", cal: [380, 460], protein: [8, 12], carbs: [68, 80], fat: [6, 12], flags: { vegan: true, dairy_free: true, nut_free: true }, confidence: 0.86, source: "vision_ai", photos: 5, ingredients: "rice cakes, gochujang, sugar, scallion, sesame" },
    { name: "Seafood Pancake (Haemul Pajeon)", desc: "Crispy Korean pancake with shrimp, squid, and scallions", price: 16.00, category: "Appetizers", cal: [420, 520], protein: [20, 28], carbs: [38, 48], fat: [20, 28], flags: { dairy_free: true, nut_free: true }, confidence: 0.82, source: "vision_ai", photos: 4, ingredients: "flour, shrimp, squid, scallions, egg, soy dipping sauce" },
  ],
  Mediterranean: [
    { name: "Hummus with Wood-Fired Pita", desc: "Creamy house-made hummus served with fresh-baked pita bread", price: 12.00, category: "Appetizers", cal: [350, 430], protein: [12, 16], carbs: [42, 52], fat: [14, 20], flags: { vegan: true, nut_free: true }, confidence: 0.88, source: "vision_ai", photos: 7, ingredients: "chickpeas, tahini, lemon, garlic, olive oil, pita" },
    { name: "Harissa Chicken", desc: "Half chicken roasted with harissa and served with seasonal vegetables", price: 28.00, category: "Mains", cal: [520, 640], protein: [42, 52], carbs: [15, 25], fat: [28, 36], flags: { gluten_free: true, dairy_free: true, nut_free: true }, confidence: 0.82, source: "vision_ai", photos: 6, ingredients: "chicken, harissa, olive oil, lemon, seasonal vegetables" },
    { name: "Lamb Kebab Plate", desc: "Grilled lamb skewers with Persian rice, yogurt, and sumac onions", price: 26.00, category: "Mains", cal: [580, 700], protein: [36, 44], carbs: [45, 55], fat: [24, 32], flags: { nut_free: true }, confidence: 0.80, source: "vision_ai", photos: 5, ingredients: "lamb, Persian rice, yogurt, sumac, onion, tomato, herbs" },
    { name: "Artichoke Tortelloni", desc: "Handmade pasta in white truffle broth", price: 24.00, category: "Mains", cal: [480, 580], protein: [16, 22], carbs: [52, 64], fat: [22, 30], flags: { vegetarian: true }, confidence: 0.80, source: "vision_ai", photos: 4, ingredients: "pasta, artichoke, white truffle, Parmigiano, cream" },
    { name: "Baba Ghanoush", desc: "Smoky eggplant dip with tahini, lemon, and olive oil", price: 11.00, category: "Appetizers", cal: [220, 280], protein: [5, 8], carbs: [18, 24], fat: [14, 20], flags: { vegan: true, gluten_free: true, nut_free: true }, confidence: 0.88, source: "usda_match", photos: 4, ingredients: "eggplant, tahini, lemon, garlic, olive oil, parsley" },
    { name: "Shakshuka", desc: "Baked eggs in spiced tomato sauce with feta and herbs", price: 16.00, category: "Mains", cal: [380, 460], protein: [18, 24], carbs: [22, 30], fat: [22, 30], flags: { vegetarian: true, gluten_free: true, nut_free: true }, confidence: 0.84, source: "vision_ai", photos: 6, ingredients: "eggs, tomato, bell pepper, onion, cumin, feta, cilantro" },
  ],
  American: [
    { name: "Prime Filet Mignon (8oz)", desc: "Center-cut filet with smashed potatoes and chili butter", price: 58.00, category: "Mains", cal: [620, 760], protein: [48, 58], carbs: [22, 32], fat: [36, 46], flags: { gluten_free: true, nut_free: true }, confidence: 0.82, source: "vision_ai", photos: 6, ingredients: "beef filet, potatoes, butter, chili, herbs" },
    { name: "Stout-Braised Short Ribs", desc: "Slow-braised beef short ribs with root vegetables", price: 32.00, category: "Mains", cal: [680, 820], protein: [42, 52], carbs: [28, 38], fat: [38, 48], flags: { nut_free: true }, confidence: 0.80, source: "vision_ai", photos: 5, ingredients: "beef short ribs, stout beer, carrots, potatoes, onion, thyme" },
    { name: "Blue Corn Empanadas", desc: "Crispy empanadas filled with braised pork and green chili", price: 14.00, category: "Appetizers", cal: [380, 460], protein: [16, 22], carbs: [32, 42], fat: [20, 28], flags: { nut_free: true }, confidence: 0.82, source: "vision_ai", photos: 5, ingredients: "blue corn masa, braised pork, green chili, queso fresco" },
    { name: "Wood-Grilled Salmon", desc: "Atlantic salmon with seasonal vegetables and herb vinaigrette", price: 36.00, category: "Mains", cal: [480, 580], protein: [38, 46], carbs: [12, 20], fat: [28, 36], flags: { gluten_free: true, dairy_free: true, nut_free: true }, confidence: 0.84, source: "vision_ai", photos: 5, ingredients: "Atlantic salmon, seasonal vegetables, olive oil, lemon, herbs" },
    { name: "Butterscotch Pudding", desc: "House-made butterscotch pudding with whipped cream", price: 10.00, category: "Desserts", cal: [380, 460], protein: [5, 8], carbs: [48, 58], fat: [20, 28], flags: { vegetarian: true, nut_free: true }, confidence: 0.86, source: "vision_ai", photos: 3, ingredients: "cream, brown sugar, butter, eggs, vanilla, salt" },
  ],
  Vietnamese: [
    { name: "Pho Tai (Rare Steak Pho)", desc: "Slow-simmered beef bone broth with rare steak, rice noodles, and herbs", price: 14.00, category: "Mains", cal: [420, 520], protein: [28, 36], carbs: [48, 58], fat: [10, 18], flags: { gluten_free: true, dairy_free: true, nut_free: true }, confidence: 0.86, source: "vision_ai", photos: 8, ingredients: "beef broth, rare steak, rice noodles, bean sprouts, basil, lime, jalapeño" },
    { name: "Bun Bo Hue", desc: "Spicy lemongrass beef noodle soup with pork knuckle", price: 15.00, category: "Mains", cal: [480, 580], protein: [30, 38], carbs: [42, 52], fat: [18, 26], flags: { dairy_free: true, nut_free: true }, confidence: 0.82, source: "vision_ai", photos: 5, ingredients: "beef broth, lemongrass, pork, rice noodles, chili oil, herbs" },
    { name: "Banh Mi Thit Nuong", desc: "Grilled pork banh mi with pickled daikon, cilantro, and jalapeño", price: 11.00, category: "Mains", cal: [480, 560], protein: [22, 28], carbs: [48, 58], fat: [18, 26], flags: { dairy_free: true, nut_free: true }, confidence: 0.84, source: "vision_ai", photos: 6, ingredients: "baguette, grilled pork, daikon, carrot, cilantro, jalapeño, pate" },
    { name: "Cha Gio (Egg Rolls)", desc: "Crispy fried pork and shrimp egg rolls with nuoc cham", price: 9.00, category: "Appetizers", cal: [320, 400], protein: [14, 18], carbs: [28, 36], fat: [16, 24], flags: { dairy_free: true, nut_free: true }, confidence: 0.84, source: "vision_ai", photos: 5, ingredients: "pork, shrimp, taro, glass noodles, rice paper, nuoc cham" },
    { name: "Com Tam (Broken Rice Plate)", desc: "Broken rice with grilled pork chop, egg cake, and fish sauce", price: 14.00, category: "Mains", cal: [580, 700], protein: [32, 40], carbs: [62, 74], fat: [20, 28], flags: { dairy_free: true, nut_free: true, gluten_free: true }, confidence: 0.82, source: "vision_ai", photos: 4, ingredients: "broken rice, grilled pork, egg cake, fish sauce, pickled vegetables" },
  ],
  "Latin American": [
    { name: "Stout-Braised Short Ribs", desc: "Slow-braised beef short ribs with root vegetables", price: 32.00, category: "Mains", cal: [680, 820], protein: [42, 52], carbs: [28, 38], fat: [38, 48], flags: { nut_free: true }, confidence: 0.80, source: "vision_ai", photos: 5, ingredients: "beef short ribs, stout beer, carrots, potatoes, onion, thyme" },
    { name: "Blue Corn Empanadas", desc: "Crispy empanadas filled with braised pork and green chili", price: 14.00, category: "Appetizers", cal: [380, 460], protein: [16, 22], carbs: [32, 42], fat: [20, 28], flags: { nut_free: true }, confidence: 0.82, source: "vision_ai", photos: 5, ingredients: "blue corn masa, braised pork, green chili, queso fresco" },
    { name: "Fried Sweet Plantains", desc: "Caramelized plantains with crema and cotija", price: 10.00, category: "Sides", cal: [280, 350], protein: [3, 5], carbs: [48, 58], fat: [10, 16], flags: { vegetarian: true, gluten_free: true, nut_free: true }, confidence: 0.86, source: "usda_match", photos: 4, ingredients: "plantains, oil, crema, cotija cheese" },
    { name: "Coriander Roasted Lamb", desc: "Slow-roasted lamb shoulder with coriander crust and chimichurri", price: 34.00, category: "Mains", cal: [580, 720], protein: [38, 48], carbs: [12, 20], fat: [36, 46], flags: { gluten_free: true, dairy_free: true, nut_free: true }, confidence: 0.78, source: "vision_ai", photos: 4, ingredients: "lamb shoulder, coriander, garlic, chimichurri, seasonal vegetables" },
    { name: "Butterscotch Pudding", desc: "House-made butterscotch pudding with whipped cream", price: 10.00, category: "Desserts", cal: [380, 460], protein: [5, 8], carbs: [48, 58], fat: [20, 28], flags: { vegetarian: true, nut_free: true }, confidence: 0.86, source: "vision_ai", photos: 3, ingredients: "cream, brown sugar, butter, eggs, vanilla, salt" },
  ],
  Israeli: [
    { name: "Hummus with Wood-Fired Pita", desc: "Creamy house-made hummus served with fresh-baked pita bread", price: 12.00, category: "Appetizers", cal: [350, 430], protein: [12, 16], carbs: [42, 52], fat: [14, 20], flags: { vegan: true, nut_free: true }, confidence: 0.88, source: "vision_ai", photos: 7, ingredients: "chickpeas, tahini, lemon, garlic, olive oil, pita" },
    { name: "Shakshuka", desc: "Baked eggs in spiced tomato sauce with feta and herbs", price: 16.00, category: "Mains", cal: [380, 460], protein: [18, 24], carbs: [22, 30], fat: [22, 30], flags: { vegetarian: true, gluten_free: true, nut_free: true }, confidence: 0.84, source: "vision_ai", photos: 6, ingredients: "eggs, tomato, bell pepper, onion, cumin, feta, cilantro" },
    { name: "Lamb Kebab Plate", desc: "Grilled lamb skewers with Persian rice, yogurt, and sumac onions", price: 26.00, category: "Mains", cal: [580, 700], protein: [36, 44], carbs: [45, 55], fat: [24, 32], flags: { nut_free: true }, confidence: 0.80, source: "vision_ai", photos: 5, ingredients: "lamb, Persian rice, yogurt, sumac, onion, tomato, herbs" },
    { name: "Harissa Chicken", desc: "Half chicken roasted with harissa and served with seasonal vegetables", price: 28.00, category: "Mains", cal: [520, 640], protein: [42, 52], carbs: [15, 25], fat: [28, 36], flags: { gluten_free: true, dairy_free: true, nut_free: true }, confidence: 0.82, source: "vision_ai", photos: 6, ingredients: "chicken, harissa, olive oil, lemon, seasonal vegetables" },
    { name: "Baba Ghanoush", desc: "Smoky eggplant dip with tahini, lemon, and olive oil", price: 11.00, category: "Appetizers", cal: [220, 280], protein: [5, 8], carbs: [18, 24], fat: [14, 20], flags: { vegan: true, gluten_free: true, nut_free: true }, confidence: 0.88, source: "usda_match", photos: 4, ingredients: "eggplant, tahini, lemon, garlic, olive oil, parsley" },
  ],
};

const REVIEW_PRAISES = [
  "generous portions",
  "fresh ingredients",
  "great flavor",
  "good value",
  "authentic taste",
  "perfectly seasoned",
  "beautiful presentation",
  "excellent service",
  "warm atmosphere",
  "creative plating",
];
const REVIEW_COMPLAINTS = [
  "can be spicy",
  "small portion",
  "slow service",
  "overpriced",
  "inconsistent quality",
  "noisy",
  "long wait",
];

// ─── Main seed ────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding FoodClaw Denver data...\n");

  // Clear existing data
  await prisma.communityFeedback.deleteMany();
  await prisma.reviewSummary.deleteMany();
  await prisma.dishPhoto.deleteMany();
  await prisma.restaurantDelivery.deleteMany();
  await prisma.restaurantLogistics.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.userProfile.deleteMany();
  console.log("Cleared existing data.");

  // Create demo user
  const user = await prisma.userProfile.create({
    data: {
      email: "demo@foodclaw.app",
      name: "Denver Foodie",
      dietaryRestrictions: { vegan: false, vegetarian: false, gluten_free: false },
      nutritionalGoals: { priority: "max_protein" },
      maxWaitMinutes: 30,
      searchRadiusMiles: 5.0,
      preferredCuisines: ["Thai", "Japanese", "Mexican", "Mediterranean"],
    },
  });
  console.log(`Created demo user: ${user.id}\n`);

  let totalDishes = 0;

  for (let i = 0; i < RESTAURANTS.length; i++) {
    const r = RESTAURANTS[i];
    const cuisine = r.cuisine[0];
    const templates = DISH_TEMPLATES[cuisine];
    if (!templates) {
      console.warn(`  No dish templates for cuisine "${cuisine}", skipping ${r.name}`);
      continue;
    }

    const hood = NEIGHBORHOODS[r.neighborhood] ?? { lat: BASE_LAT, lng: BASE_LNG };

    const restaurant = await prisma.restaurant.create({
      data: {
        googlePlaceId: `denver_place_${i}_${r.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
        name: r.name,
        address: r.address,
        latitude: jitter(hood.lat),
        longitude: jitter(hood.lng),
        cuisineType: r.cuisine,
        priceLevel: r.price,
        googleRating: r.rating,
        yelpRating: r.yelp,
        phone: r.phone,
        websiteUrl: r.website,
        acceptsReservations: r.price >= 3,
        menuSource: "website",
        lastMenuCrawl: new Date(),
        isActive: true,
      },
    });

    // Add delivery options for ~60% of restaurants
    if (Math.random() < 0.6) {
      await prisma.restaurantDelivery.create({
        data: {
          restaurantId: restaurant.id,
          platform: "ubereats",
          isAvailable: true,
          deliveryFeeMin: 1.99,
          deliveryFeeMax: 4.99,
          estimatedDeliveryMinutesMin: 25,
          estimatedDeliveryMinutesMax: 45,
          platformUrl: `https://ubereats.com/store/${r.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        },
      });
    }
    if (Math.random() < 0.4) {
      await prisma.restaurantDelivery.create({
        data: {
          restaurantId: restaurant.id,
          platform: "doordash",
          isAvailable: true,
          deliveryFeeMin: 2.49,
          deliveryFeeMax: 5.99,
          estimatedDeliveryMinutesMin: 30,
          estimatedDeliveryMinutesMax: 50,
          platformUrl: `https://doordash.com/store/${r.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        },
      });
    }

    // Add traffic data (current day/hour and a few around it)
    const now = new Date();
    const busynessBase = 30 + Math.floor(Math.random() * 50);
    for (let h = Math.max(0, now.getHours() - 2); h <= Math.min(23, now.getHours() + 2); h++) {
      const busyness = Math.max(
        10,
        Math.min(100, busynessBase + (h - now.getHours()) * 10 + Math.floor(Math.random() * 20 - 10))
      );
      await prisma.restaurantLogistics.create({
        data: {
          restaurantId: restaurant.id,
          dayOfWeek: now.getDay(),
          hour: h,
          typicalBusynessPct: busyness,
          estimatedWaitMinutes: Math.round(busyness * 0.4),
        },
      });
    }

    // Create dishes
    for (const t of templates) {
      const dish = await prisma.dish.create({
        data: {
          restaurantId: restaurant.id,
          name: t.name,
          description: t.desc,
          price: t.price,
          category: t.category,
          ingredientsRaw: t.ingredients,
          ingredientsParsed: t.ingredients.split(", ").map((ing: string) => ({ name: ing, is_primary: true })),
          dietaryFlags: t.flags,
          dietaryConfidence: t.confidence,
          caloriesMin: t.cal[0],
          caloriesMax: t.cal[1],
          proteinMinG: t.protein[0],
          proteinMaxG: t.protein[1],
          carbsMinG: t.carbs[0],
          carbsMaxG: t.carbs[1],
          fatMinG: t.fat[0],
          fatMaxG: t.fat[1],
          macroConfidence: t.confidence,
          macroSource: t.source,
          photoCountAnalyzed: t.photos,
          isAvailable: true,
        },
      });

      // Add photos
      for (let p = 0; p < Math.min(t.photos, 3); p++) {
        await prisma.dishPhoto.create({
          data: {
            dishId: dish.id,
            sourceUrl: `https://images.foodclaw.app/${dish.id}_${p}.jpg`,
            sourcePlatform: p === 0 ? "google_maps" : "yelp",
            macroEstimate: {
              calories: Math.round((t.cal[0] + t.cal[1]) / 2 + Math.random() * 40 - 20),
              protein_g: Math.round((t.protein[0] + t.protein[1]) / 2 + Math.random() * 4 - 2),
              carbs_g: Math.round((t.carbs[0] + t.carbs[1]) / 2 + Math.random() * 6 - 3),
              fat_g: Math.round((t.fat[0] + t.fat[1]) / 2 + Math.random() * 4 - 2),
            },
            analyzedAt: new Date(),
          },
        });
      }

      // Add review summary for ~80% of dishes
      if (Math.random() < 0.8) {
        const numPraises = 2 + Math.floor(Math.random() * 2);
        const numComplaints = Math.random() < 0.5 ? 1 : 0;
        const rating = 3.5 + Math.random() * 1.5;

        await prisma.reviewSummary.create({
          data: {
            dishId: dish.id,
            totalReviewsAnalyzed: 10 + Math.floor(Math.random() * 40),
            googleReviewCount: 5 + Math.floor(Math.random() * 20),
            yelpReviewCount: 3 + Math.floor(Math.random() * 15),
            averageDishRating: parseFloat(rating.toFixed(2)),
            summaryText: `${t.name} at ${r.name} is well-regarded for its ${t.ingredients.split(", ").slice(0, 2).join(" and ")}. Diners appreciate the quality and preparation.`,
            sentimentPositivePct: 70 + Math.random() * 20,
            sentimentNegativePct: 5 + Math.random() * 15,
            commonPraises: shuffle(REVIEW_PRAISES).slice(0, numPraises),
            commonComplaints: shuffle(REVIEW_COMPLAINTS).slice(0, numComplaints),
            dietaryWarnings: [],
          },
        });
      }

      totalDishes++;
    }

    console.log(`  [${r.neighborhood}] ${restaurant.name}: ${templates.length} dishes (${r.cuisine.join(", ")})`);
  }

  console.log(`\nDone! Created ${RESTAURANTS.length} restaurants with ${totalDishes} total dishes across Denver.`);
  console.log(`Demo user login: demo@foodclaw.app`);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
