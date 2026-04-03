/**
 * Seed script for FoodClaw — Real Manhattan NYC restaurants.
 * 28 restaurants across 10 cuisine types with real addresses, menus, and nutrition.
 *
 * Usage: npx tsx scripts/seed-manhattan.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedRestaurants } from "./seed-manhattan-data";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Load AI-generated photos (priority 1) and user-approved references (priority 2)
import * as fs from "fs";
const generatedPhotosPath = require("path").join(__dirname, "generated-photos.json");
const generatedPhotos: Record<string, string> = fs.existsSync(generatedPhotosPath)
  ? JSON.parse(fs.readFileSync(generatedPhotosPath, "utf8"))
  : {};
import approvedPhotos from "./approved-photos.json";

// Legacy mapping — replaced by approved-photos.json
export const PHOTOS_BY_DISH: Record<string, string> = {
  // === THAI ===
  "Somtum Thai": "https://images.unsplash.com/photo-mgjmgc0BPgw?w=800&h=500&fit=crop", // papaya salad bowl
  "Larb Moo Tod": "https://images.unsplash.com/photo-Q05TaeaYf3c?w=800&h=500&fit=crop", // Thai minced pork with basil
  "Pad Thai Goong": "https://images.unsplash.com/photo-QxYYXYFIZsA?w=800&h=500&fit=crop", // pad thai with shrimp, lime, beansprouts
  "Gaeng Keow Wan Gai": "https://images.unsplash.com/photo-ZjZJfpWQibs?w=800&h=500&fit=crop", // Thai green curry chicken
  "Khao Niew Ma Muang": "https://images.unsplash.com/photo-bKrXKkPkhas?w=800&h=500&fit=crop", // mango sticky rice plate
  "Nam Tok Moo": "https://images.unsplash.com/photo-CgWbZ8FzwZk?w=800&h=500&fit=crop", // Thai grilled pork salad
  "Sukhothai Noodle": "https://images.unsplash.com/photo-eW78v-wPWpU?w=800&h=500&fit=crop", // noodles with meat in bowl
  "Khao Soi Gai": "https://images.unsplash.com/photo-KbJOIEIHJEU?w=800&h=500&fit=crop", // khao soi curry noodle
  "Khao Soi": "https://images.unsplash.com/photo-KbJOIEIHJEU?w=800&h=500&fit=crop", // khao soi curry noodle
  "Ba Mii Pu": "https://images.unsplash.com/photo-OHfxJ2vrzdc?w=800&h=500&fit=crop", // egg noodles overhead
  "Tom Yum Noodle Soup": "https://images.unsplash.com/photo-1EcdFgIYBgM?w=800&h=500&fit=crop", // tom yum soup shrimp mushrooms
  "Moo Ping": "https://images.unsplash.com/photo-9GWukb7eDO4?w=800&h=500&fit=crop", // pork skewers on plate
  "Coconut Crab Curry": "https://images.unsplash.com/photo-zgSBwZGDsIo?w=800&h=500&fit=crop", // crab in coconut curry
  "Crab Fried Rice": "https://images.unsplash.com/photo-8Qb_oh6k4R4?w=800&h=500&fit=crop", // crab fried rice plate
  "Zabb Wings": "https://images.unsplash.com/photo-cTv9K4bpOis?w=800&h=500&fit=crop", // crispy chicken wings with dipping sauce
  "Whole Branzino": "https://images.unsplash.com/photo-bP__qCYnh9M?w=800&h=500&fit=crop", // grilled whole fish with salad
  "Thai Disco Fries": "https://images.unsplash.com/photo-xy7BK6oDD2s?w=800&h=500&fit=crop", // loaded fries with cheese
  "Kanom Jeen Nam Ya": "https://images.unsplash.com/photo-fFrXh0WRHOA?w=800&h=500&fit=crop", // Thai noodles
  "Pork Cheek Chili Garlic": "https://images.unsplash.com/photo-qEQhzgRvo2E?w=800&h=500&fit=crop", // cooked meat dish
  "Shrimp Paste Rice": "https://images.unsplash.com/photo-8Qb_oh6k4R4?w=800&h=500&fit=crop", // fried rice with seafood
  "Roti Kabocha": "https://images.unsplash.com/photo-0zVSdyIaCRw?w=800&h=500&fit=crop", // flatbread

  // === JAPANESE ===
  "Omakase": "https://images.unsplash.com/photo-p0niMe1u4Mo?w=800&h=500&fit=crop", // sushi nigiri assortment
  "21-Course Omakase": "https://images.unsplash.com/photo-p0niMe1u4Mo?w=800&h=500&fit=crop", // sushi nigiri
  "Salmon Sashimi": "https://images.unsplash.com/photo-KBACEp8hPh0?w=800&h=500&fit=crop", // close-up salmon sashimi
  "Seasonal Sashimi Plate": "https://images.unsplash.com/photo-KBACEp8hPh0?w=800&h=500&fit=crop", // sashimi plate
  "Yellowtail Hand Roll": "https://images.unsplash.com/photo-Gm2yJHZtT-8?w=800&h=500&fit=crop", // yellowtail sashimi
  "Uni Nigiri": "https://images.unsplash.com/photo-gKgiCFr46JE?w=800&h=500&fit=crop", // sea urchin in wooden box
  "Uni Bibimbap": "https://images.unsplash.com/photo-gKgiCFr46JE?w=800&h=500&fit=crop", // sea urchin
  "Toro Nigiri": "https://images.unsplash.com/photo-7BQC4h7wd9Y?w=800&h=500&fit=crop", // sushi on plate
  "A5 Wagyu Nigiri": "https://images.unsplash.com/photo-7BQC4h7wd9Y?w=800&h=500&fit=crop", // sushi nigiri
  "Kohada Nigiri": "https://images.unsplash.com/photo-KS0L-9but3Y?w=800&h=500&fit=crop", // sushi and sashimi assortment
  "Anago Nigiri": "https://images.unsplash.com/photo-KS0L-9but3Y?w=800&h=500&fit=crop", // sushi assortment
  "Tamago": "https://images.unsplash.com/photo-Az0Vm-lzzJM?w=800&h=500&fit=crop", // Japanese food
  "Chirashi Bowl": "https://images.unsplash.com/photo-KS0L-9but3Y?w=800&h=500&fit=crop", // sashimi assortment
  "Agedashi Tofu": "https://images.unsplash.com/photo-hf6--TVKNJg?w=800&h=500&fit=crop", // fried tofu/appetizer
  "Hire Katsu Set": "https://images.unsplash.com/photo-vv7I95p6aVQ?w=800&h=500&fit=crop", // breaded cutlet with salad
  "Rosu Katsu Set": "https://images.unsplash.com/photo-vv7I95p6aVQ?w=800&h=500&fit=crop", // pork cutlet
  "Katsu Curry": "https://images.unsplash.com/photo-_sfMD-OhFR8?w=800&h=500&fit=crop", // katsu curry
  "Katsu Don": "https://images.unsplash.com/photo-QercEMbK7Ak?w=800&h=500&fit=crop", // katsudon in bowl
  "Chicken Katsu Set": "https://images.unsplash.com/photo-HeubRvBGXBM?w=800&h=500&fit=crop", // chicken katsu curry plates
  "Ebi Fry Set": "https://images.unsplash.com/photo-hf6--TVKNJg?w=800&h=500&fit=crop", // fried Japanese food
  "Karaage": "https://images.unsplash.com/photo-hf6--TVKNJg?w=800&h=500&fit=crop", // fried Japanese appetizer
  "Tonnarelli Cacio e Pepe": "https://images.unsplash.com/photo-oW5eupy_Yhg?w=800&h=500&fit=crop", // pasta plate
  "Nabeyaki Udon": "https://images.unsplash.com/photo-h64xTyldrAg?w=800&h=500&fit=crop", // hot soup bowl
  "Cold Zaru Udon": "https://images.unsplash.com/photo-TQYTVB7BC-c?w=800&h=500&fit=crop", // cold noodles
  "Kitsune Udon": "https://images.unsplash.com/photo-h64xTyldrAg?w=800&h=500&fit=crop", // udon soup
  "Curry Udon": "https://images.unsplash.com/photo-3Yicc4IhVsk?w=800&h=500&fit=crop", // bowl of soup
  "Grilled Mackerel": "https://images.unsplash.com/photo-bP__qCYnh9M?w=800&h=500&fit=crop", // grilled fish

  // === ITALIAN ===
  "Spaghetti Cacio e Pepe": "https://images.unsplash.com/photo-oW5eupy_Yhg?w=800&h=500&fit=crop", // pasta on plate
  "Burrata": "https://images.unsplash.com/photo-3HynzI1U5-0?w=800&h=500&fit=crop", // burrata on plate
  "Pappardelle al Ragu": "https://images.unsplash.com/photo-nx_fDzbmRgU?w=800&h=500&fit=crop", // rigatoni with ragu
  "Grilled Branzino": "https://images.unsplash.com/photo-bP__qCYnh9M?w=800&h=500&fit=crop", // grilled fish with lemon
  "Branzino": "https://images.unsplash.com/photo-bP__qCYnh9M?w=800&h=500&fit=crop", // grilled fish
  "Pan-Roasted Branzino": "https://images.unsplash.com/photo-D6SB5vzTkV4?w=800&h=500&fit=crop", // fish plated
  "Black Cocoa Tiramisu": "https://images.unsplash.com/photo-pzRS_xF8brE?w=800&h=500&fit=crop", // tiramisu
  "Olive Oil Cake": "https://images.unsplash.com/photo-pzRS_xF8brE?w=800&h=500&fit=crop", // cake dessert
  "Insalata Verde": "https://images.unsplash.com/photo-iVYPVBdq5rU?w=800&h=500&fit=crop", // green salad plate
  "Carciofi Fritti": "https://images.unsplash.com/photo-6C9XHQj6ZIw?w=800&h=500&fit=crop", // artichoke on plate
  "Agnolotti": "https://images.unsplash.com/photo-tSg2tYDMNWI?w=800&h=500&fit=crop", // stuffed pasta
  "Meatballs al Forno": "https://images.unsplash.com/photo-HTpiHBRoBIc?w=800&h=500&fit=crop", // meatballs close-up
  "Ricotta Gnudi": "https://images.unsplash.com/photo-tSg2tYDMNWI?w=800&h=500&fit=crop", // Italian pasta/dumpling
  "Pinwheel Lasagna": "https://images.unsplash.com/photo-JR7yVg2NgQI?w=800&h=500&fit=crop", // lasagna
  "Pork Chop Milanese": "https://images.unsplash.com/photo-vv7I95p6aVQ?w=800&h=500&fit=crop", // breaded cutlet
  "Fuzi Bolognese": "https://images.unsplash.com/photo-nx_fDzbmRgU?w=800&h=500&fit=crop", // pasta with ragu
  "Pollo Arrosto": "https://images.unsplash.com/photo-PkVuvSYuFmw?w=800&h=500&fit=crop", // roasted chicken
  "Panna Cotta": "https://images.unsplash.com/photo-pzRS_xF8brE?w=800&h=500&fit=crop", // Italian dessert
  "Beef Carpaccio": "https://images.unsplash.com/photo-POARdeILuNM?w=800&h=500&fit=crop", // plated dish
  "Pot of Mussels": "https://images.unsplash.com/photo-G6fmW79llfY?w=800&h=500&fit=crop", // seafood stew

  // === MEXICAN ===
  "Taco de Adobada": "https://images.unsplash.com/photo-7rqlS3CObsA?w=800&h=500&fit=crop", // tacos on table
  "Al Pastor Tacos": "https://images.unsplash.com/photo-7rqlS3CObsA?w=800&h=500&fit=crop", // pork tacos
  "Mulita de Adobada": "https://images.unsplash.com/photo-7rqlS3CObsA?w=800&h=500&fit=crop", // adobada
  "Taco de Asada": "https://images.unsplash.com/photo-lXt3fU2cqAw?w=800&h=500&fit=crop", // carne asada tacos
  "Tacos de Carnitas": "https://images.unsplash.com/photo-ADKR5qm4Gy4?w=800&h=500&fit=crop", // meat tacos
  "Taco de Nopal": "https://images.unsplash.com/photo-jxshKbTXW_k?w=800&h=500&fit=crop", // nopal/cactus taco plates
  "Taco de Pollo": "https://images.unsplash.com/photo-A05ijm09lcI?w=800&h=500&fit=crop", // chicken taco
  "Catfish Tacos": "https://images.unsplash.com/photo-PNCPZ-NcTE4?w=800&h=500&fit=crop", // fish tacos
  "Fish Tacos": "https://images.unsplash.com/photo-PNCPZ-NcTE4?w=800&h=500&fit=crop", // fish tacos
  "Quesadilla de Asada": "https://images.unsplash.com/photo-NhYsXunTk_k?w=800&h=500&fit=crop", // quesadilla with sauce
  "Chicken Quesadilla": "https://images.unsplash.com/photo-NhYsXunTk_k?w=800&h=500&fit=crop", // quesadilla
  "Elote": "https://images.unsplash.com/photo-43zEu8kwXYo?w=800&h=500&fit=crop", // Mexican street corn
  "Enchiladas de Mole": "https://images.unsplash.com/photo-JR7yVg2NgQI?w=800&h=500&fit=crop", // enchiladas with sauce
  "Ceviche": "https://images.unsplash.com/photo-TxRL4f_ViKA?w=800&h=500&fit=crop", // ceviche bowl
  "Churros con Chocolate": "https://images.unsplash.com/photo-2a2TrOXYVBs?w=800&h=500&fit=crop", // churros with dipping sauce
  "Guacamole Clasico": "https://images.unsplash.com/photo-43zEu8kwXYo?w=800&h=500&fit=crop", // Mexican food
  "Nachos Supremos": "https://images.unsplash.com/photo-nQaXivzVnkE?w=800&h=500&fit=crop", // loaded nachos/fries
  "Burrito de Pollo": "https://images.unsplash.com/photo-ADKR5qm4Gy4?w=800&h=500&fit=crop", // Mexican wrap
  "Pork Belly Tostada": "https://images.unsplash.com/photo-jxshKbTXW_k?w=800&h=500&fit=crop", // Mexican plate
  "Tres Leches Cake": "https://images.unsplash.com/photo-2a2TrOXYVBs?w=800&h=500&fit=crop", // dessert
  "Horchata": "https://images.unsplash.com/photo-bbEs9Z2LbaA?w=800&h=500&fit=crop", // iced drink
  "Birria Tacos": "https://images.unsplash.com/photo-lXt3fU2cqAw?w=800&h=500&fit=crop", // meat tacos

  // === INDIAN ===
  "Chicken Tikka Masala": "https://images.unsplash.com/photo-2EvkSrJg-hU?w=800&h=500&fit=crop", // tikka masala bowl
  "Lamb Biryani": "https://images.unsplash.com/photo-Cgw62rXaPpM?w=800&h=500&fit=crop", // Indian biryani
  "Chicken Biryani": "https://images.unsplash.com/photo-Cgw62rXaPpM?w=800&h=500&fit=crop", // biryani
  "Saag Paneer": "https://images.unsplash.com/photo-kp2iOZuoufg?w=800&h=500&fit=crop", // spinach with paneer
  "Samosa Chaat": "https://images.unsplash.com/photo-I9PXfhnMkcE?w=800&h=500&fit=crop", // samosa
  "Butter Chicken": "https://images.unsplash.com/photo-5oW0l5PjsX8?w=800&h=500&fit=crop", // butter chicken with rice
  "Dal Makhani": "https://images.unsplash.com/photo-tLm99xV5zHM?w=800&h=500&fit=crop", // dal lentil curry
  "Garlic Naan": "https://images.unsplash.com/photo-PasVYmFY0VQ?w=800&h=500&fit=crop", // naan bread
  "Tandoori Chicken": "https://images.unsplash.com/photo-2EvkSrJg-hU?w=800&h=500&fit=crop", // tandoori
  "Tandoori Mixed Grill": "https://images.unsplash.com/photo-2EvkSrJg-hU?w=800&h=500&fit=crop", // grilled Indian
  "Lamb Rogan Josh": "https://images.unsplash.com/photo-5oW0l5PjsX8?w=800&h=500&fit=crop", // Indian curry
  "Chicken Vindaloo": "https://images.unsplash.com/photo-2EvkSrJg-hU?w=800&h=500&fit=crop", // Indian curry
  "Aloo Gobi": "https://images.unsplash.com/photo-kp2iOZuoufg?w=800&h=500&fit=crop", // Indian vegetable dish
  "Malai Kofta": "https://images.unsplash.com/photo-5oW0l5PjsX8?w=800&h=500&fit=crop", // Indian curry
  "Lamb Seekh Kebab": "https://images.unsplash.com/photo-oNzpuKsHNJ8?w=800&h=500&fit=crop", // grilled kebab
  "Gulab Jamun": "https://images.unsplash.com/photo-2a2TrOXYVBs?w=800&h=500&fit=crop", // sweet dessert
  "Mango Lassi": "https://images.unsplash.com/photo-bbEs9Z2LbaA?w=800&h=500&fit=crop", // drink
  "Fish Curry": "https://images.unsplash.com/photo-yZFWua6vDd8?w=800&h=500&fit=crop", // curry bowl

  // === CHINESE ===
  "Har Gow": "https://images.unsplash.com/photo-qwkJikR68Lg?w=800&h=500&fit=crop", // shrimp dumplings
  "Shrimp Ha Gow": "https://images.unsplash.com/photo-qwkJikR68Lg?w=800&h=500&fit=crop", // har gow
  "Siu Mai": "https://images.unsplash.com/photo-eQywNoRSXeU?w=800&h=500&fit=crop", // dim sum dumplings with chopsticks
  "Turnip Cake": "https://images.unsplash.com/photo-0zVSdyIaCRw?w=800&h=500&fit=crop", // pan-fried cake
  "Roast Pork Bun": "https://images.unsplash.com/photo-o2w6Z9qceis?w=800&h=500&fit=crop", // pork buns
  "Char Siu Bao": "https://images.unsplash.com/photo-o2w6Z9qceis?w=800&h=500&fit=crop", // pork buns
  "Cheung Fun": "https://images.unsplash.com/photo-WeebpKNxjcs?w=800&h=500&fit=crop", // dim sum steamer
  "Original Egg Roll": "https://images.unsplash.com/photo-BFEC7ft8Pz0?w=800&h=500&fit=crop", // fried appetizer
  "Dan Tat": "https://images.unsplash.com/photo-pzRS_xF8brE?w=800&h=500&fit=crop", // custard tart
  "Drunken Dumplings": "https://images.unsplash.com/photo-0S1jRLQZwVY?w=800&h=500&fit=crop", // dumplings in bamboo steamer
  "Spare Ribs with Black Bean": "https://images.unsplash.com/photo-qEQhzgRvo2E?w=800&h=500&fit=crop", // ribs
  "Pan Fried Noodles": "https://images.unsplash.com/photo-fFrXh0WRHOA?w=800&h=500&fit=crop", // fried noodles
  "Peking Duck": "https://images.unsplash.com/photo-xo-mqz2Be34?w=800&h=500&fit=crop", // roast duck carving
  "Roast Duck": "https://images.unsplash.com/photo-xo-mqz2Be34?w=800&h=500&fit=crop", // roast duck
  "Salt and Pepper Squid": "https://images.unsplash.com/photo-BFEC7ft8Pz0?w=800&h=500&fit=crop", // fried seafood
  "Lo Mein": "https://images.unsplash.com/photo-uhrGEOdGmts?w=800&h=500&fit=crop", // noodles
  "N1 Spicy Cumin Lamb Noodle Soup": "https://images.unsplash.com/photo-uhrGEOdGmts?w=800&h=500&fit=crop", // cumin lamb noodles
  "Spicy Cumin Lamb Hand-Ripped Noodles": "https://images.unsplash.com/photo-uhrGEOdGmts?w=800&h=500&fit=crop", // spicy noodles
  "Spicy and Tingly Beef Hand-Ripped Noodles": "https://images.unsplash.com/photo-uhrGEOdGmts?w=800&h=500&fit=crop", // hand-ripped noodles
  "Liang Pi Cold Skin Noodles": "https://images.unsplash.com/photo-TQYTVB7BC-c?w=800&h=500&fit=crop", // cold noodles bowl
  "Pork Belly": "https://images.unsplash.com/photo-qEQhzgRvo2E?w=800&h=500&fit=crop", // braised pork
  "Stewed Pork Burger": "https://images.unsplash.com/photo-HmzRTRNAGg4?w=800&h=500&fit=crop", // sandwich
  "Coconut Pancakes": "https://images.unsplash.com/photo-0zVSdyIaCRw?w=800&h=500&fit=crop", // flatbread/pancake

  // === KOREAN ===
  "Premium Beef Combo": "https://images.unsplash.com/photo-HseIo47OgxQ?w=800&h=500&fit=crop", // Korean BBQ spread
  "Bulgogi": "https://images.unsplash.com/photo-lH0TkYdyf84?w=800&h=500&fit=crop", // Korean beef bulgogi
  "Japchae": "https://images.unsplash.com/photo-LY4xyLYX5Vs?w=800&h=500&fit=crop", // glass noodles
  "Kimchi Jjigae": "https://images.unsplash.com/photo--CBhllA8BxM?w=800&h=500&fit=crop", // kimchi stew
  "Soondubu Jjigae": "https://images.unsplash.com/photo--CBhllA8BxM?w=800&h=500&fit=crop", // Korean stew
  "Spicy Seafood Tofu Stew": "https://images.unsplash.com/photo--CBhllA8BxM?w=800&h=500&fit=crop", // Korean stew
  "Bibimbap": "https://images.unsplash.com/photo-M0VDTDdJfr0?w=800&h=500&fit=crop", // bibimbap spread
  "Tteokbokki": "https://images.unsplash.com/photo-I9nIfi8fJEE?w=800&h=500&fit=crop", // rice cakes
  "Korean Fried Chicken": "https://images.unsplash.com/photo-AOtQJP6zMvA?w=800&h=500&fit=crop", // Korean fried chicken
  "Moroccan Fried Chicken": "https://images.unsplash.com/photo-AOtQJP6zMvA?w=800&h=500&fit=crop", // fried chicken
  "Bossam": "https://images.unsplash.com/photo-lH0TkYdyf84?w=800&h=500&fit=crop", // Korean pork
  "Kimchi Fried Rice": "https://images.unsplash.com/photo-8Qb_oh6k4R4?w=800&h=500&fit=crop", // fried rice
  "Kimchi Pancake": "https://images.unsplash.com/photo-0zVSdyIaCRw?w=800&h=500&fit=crop", // pancake
  "Seafood Pancake": "https://images.unsplash.com/photo-0zVSdyIaCRw?w=800&h=500&fit=crop", // Korean pancake
  "Gochujang Glazed Squid": "https://images.unsplash.com/photo-BFEC7ft8Pz0?w=800&h=500&fit=crop", // fried seafood
  "Steamed Egg": "https://images.unsplash.com/photo-h64xTyldrAg?w=800&h=500&fit=crop", // steamed dish
  "Cheese Corn": "https://images.unsplash.com/photo-43zEu8kwXYo?w=800&h=500&fit=crop", // corn dish
  "Chrysanthemum Salad": "https://images.unsplash.com/photo-iVYPVBdq5rU?w=800&h=500&fit=crop", // salad

  // === MEDITERRANEAN ===
  "Lamb Chops": "https://images.unsplash.com/photo-oNzpuKsHNJ8?w=800&h=500&fit=crop", // grilled lamb chops
  "Braised Lamb Shank": "https://images.unsplash.com/photo-oNzpuKsHNJ8?w=800&h=500&fit=crop", // lamb
  "Grilled Octopus": "https://images.unsplash.com/photo-gJ9B_Th_9Jc?w=800&h=500&fit=crop", // grilled octopus with broccoli
  "Shakshuka": "https://images.unsplash.com/photo-dBl6dnIIJeY?w=800&h=500&fit=crop", // shakshuka in pan
  "Hummus": "https://images.unsplash.com/photo-Ska4Rl7CptY?w=800&h=500&fit=crop", // hummus plate
  "Falafel": "https://images.unsplash.com/photo-LMBXBD5nSG8?w=800&h=500&fit=crop", // falafel sandwich
  "Flaming Saganaki": "https://images.unsplash.com/photo-dBl6dnIIJeY?w=800&h=500&fit=crop", // pan dish
  "Taramasalata": "https://images.unsplash.com/photo-Ska4Rl7CptY?w=800&h=500&fit=crop", // dip
  "Baklava": "https://images.unsplash.com/photo-2a2TrOXYVBs?w=800&h=500&fit=crop", // dessert
  "Mediterranean Salad": "https://images.unsplash.com/photo-iVYPVBdq5rU?w=800&h=500&fit=crop", // salad
  "Duck Borek": "https://images.unsplash.com/photo-0zVSdyIaCRw?w=800&h=500&fit=crop", // pastry
  "Lamb Burger": "https://images.unsplash.com/photo-gjACmQqnfW0?w=800&h=500&fit=crop", // burger

  // === AMERICAN ===
  "Buttermilk Biscuit Sandwich": "https://images.unsplash.com/photo-vkXA1Ab871c?w=800&h=500&fit=crop", // biscuit on plate
  "Sausage Gravy Biscuit": "https://images.unsplash.com/photo-vkXA1Ab871c?w=800&h=500&fit=crop", // biscuit
  "Fried Chicken Sandwich": "https://images.unsplash.com/photo-FCUsxq-11_8?w=800&h=500&fit=crop", // fried chicken sandwich
  "Mac and Cheese": "https://images.unsplash.com/photo-nkMIO2QsOkc?w=800&h=500&fit=crop", // mac and cheese skillet
  "Kale Caesar Salad": "https://images.unsplash.com/photo-DrNgNCtCD0Q?w=800&h=500&fit=crop", // kale caesar
  "Kale and Quinoa Salad": "https://images.unsplash.com/photo-DrNgNCtCD0Q?w=800&h=500&fit=crop", // green salad
  "The Smith Burger": "https://images.unsplash.com/photo-gjACmQqnfW0?w=800&h=500&fit=crop", // burger with lettuce
  "Westville Burger": "https://images.unsplash.com/photo-gjACmQqnfW0?w=800&h=500&fit=crop", // burger
  "Grilled Salmon": "https://images.unsplash.com/photo-7H8bhjuGtbo?w=800&h=500&fit=crop", // grilled salmon
  "Pan-Roasted Chicken": "https://images.unsplash.com/photo-PkVuvSYuFmw?w=800&h=500&fit=crop", // roasted chicken
  "Roasted Cauliflower Steak": "https://images.unsplash.com/photo-B7_QFoTCunE?w=800&h=500&fit=crop", // roasted vegetable
  "Market Plate": "https://images.unsplash.com/photo-iVYPVBdq5rU?w=800&h=500&fit=crop", // plated food
  "Shrimp and Grits": "https://images.unsplash.com/photo-BFEC7ft8Pz0?w=800&h=500&fit=crop", // shrimp dish
  "Low Country Meatloaf": "https://images.unsplash.com/photo-HTpiHBRoBIc?w=800&h=500&fit=crop", // meatloaf
  "Sweet Potato Fries": "https://images.unsplash.com/photo-xy7BK6oDD2s?w=800&h=500&fit=crop", // fries
  "Truffle Fries": "https://images.unsplash.com/photo-xy7BK6oDD2s?w=800&h=500&fit=crop", // fries
  "Pickle Plate": "https://images.unsplash.com/photo-tnirPqHidN8?w=800&h=500&fit=crop", // appetizer plate
  "Coconut Coffee Panna Cotta": "https://images.unsplash.com/photo-pzRS_xF8brE?w=800&h=500&fit=crop", // dessert

  // === VIETNAMESE ===
  "Special Pho": "https://images.unsplash.com/photo-eN9vAXAQvEw?w=800&h=500&fit=crop", // pho noodle soup close-up
  "Saigon Pho": "https://images.unsplash.com/photo-eN9vAXAQvEw?w=800&h=500&fit=crop", // pho
  "Summer Rolls": "https://images.unsplash.com/photo-eVfAEyurp5c?w=800&h=500&fit=crop", // fresh spring rolls
  "Banh Mi Dac Biet": "https://images.unsplash.com/photo-HmzRTRNAGg4?w=800&h=500&fit=crop", // banh mi sandwich
  "Braised Beef Banh Mi": "https://images.unsplash.com/photo-HmzRTRNAGg4?w=800&h=500&fit=crop", // banh mi
  "Bun Cha": "https://images.unsplash.com/photo-LZ5hWxVZVDM?w=800&h=500&fit=crop", // Vietnamese bun cha with noodles and herbs
  "Bun Bo Hue": "https://images.unsplash.com/photo-eN9vAXAQvEw?w=800&h=500&fit=crop", // Vietnamese noodle soup
  "Vietnamese Iced Coffee": "https://images.unsplash.com/photo-QsDbimbThBc?w=800&h=500&fit=crop", // Vietnamese phin filter coffee
  "Lemongrass Chicken": "https://images.unsplash.com/photo-CgWbZ8FzwZk?w=800&h=500&fit=crop", // Asian chicken dish
  "Turmeric Fish": "https://images.unsplash.com/photo-bP__qCYnh9M?w=800&h=500&fit=crop", // fish dish
};

// Keyword fallback — REAL verified Unsplash photo IDs that actually load
const PHOTOS_BY_TYPE: Record<string, string> = {
  sushi: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&h=500&fit=crop",
  nigiri: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&h=500&fit=crop",
  sashimi: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&h=500&fit=crop",
  taco: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800&h=500&fit=crop",
  ramen: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&h=500&fit=crop",
  udon: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&h=500&fit=crop",
  pho: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&h=500&fit=crop",
  noodle: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&h=500&fit=crop",
  pad_thai: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&h=500&fit=crop",
  curry: "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=800&h=500&fit=crop",
  soup: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&h=500&fit=crop",
  chicken: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&h=500&fit=crop",
  katsu: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&h=500&fit=crop",
  rice: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&h=500&fit=crop",
  dumpling: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&h=500&fit=crop",
  gyoza: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&h=500&fit=crop",
  burger: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&h=500&fit=crop",
  pizza: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=500&fit=crop",
  pasta: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&h=500&fit=crop",
  salad: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=500&fit=crop",
  fish: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=500&fit=crop",
  salmon: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=500&fit=crop",
  shrimp: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop",
  lamb: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop",
  pork: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop",
  steak: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop",
  sandwich: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&h=500&fit=crop",
  banh_mi: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&h=500&fit=crop",
  fries: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=500&fit=crop",
  bibimbap: "https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800&h=500&fit=crop",
  korean: "https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800&h=500&fit=crop",
  tofu: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=500&fit=crop",
  bowl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=500&fit=crop",
  poke: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=500&fit=crop",
  ice_cream: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=800&h=500&fit=crop",
  dessert: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=800&h=500&fit=crop",
  coffee: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&h=500&fit=crop",
  falafel: "https://images.unsplash.com/photo-1593001874117-c99c800e3eb7?w=800&h=500&fit=crop",
  hummus: "https://images.unsplash.com/photo-1593001874117-c99c800e3eb7?w=800&h=500&fit=crop",
  roll: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&h=500&fit=crop",
  wing: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&h=500&fit=crop",
  pancake: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=500&fit=crop",
  waffle: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=500&fit=crop",
  bruschetta: "https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=800&h=500&fit=crop",
  risotto: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=800&h=500&fit=crop",
  burrito: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&h=500&fit=crop",
  quesadilla: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800&h=500&fit=crop",
  mango: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=500&fit=crop",
};

const FALLBACK_PHOTO = "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=500&fit=crop";

export function matchPhoto(dishName: string): string {
  // 1. AI-generated photos (copyright-free, highest priority)
  const generated = generatedPhotos[dishName];
  if (generated) return generated;

  // 2. User-approved reference photos (from approval tool)
  const approved = (approvedPhotos as Record<string, string>)[dishName];
  if (approved) return approved;

  // 2. Keyword fallback
  const lower = dishName.toLowerCase().replace(/['']/g, "");
  for (const [keyword, photo] of Object.entries(PHOTOS_BY_TYPE)) {
    if (lower.includes(keyword.replace(/_/g, " ")) || lower.includes(keyword)) return photo;
  }

  // 3. Generic fallback
  return FALLBACK_PHOTO;
}

// Generate dietary flags from dish description
function inferDietaryFlags(name: string, desc: string) {
  const text = `${name} ${desc}`.toLowerCase();
  const hasMeat = /chicken|pork|beef|lamb|steak|brisket|duck|sausage|bacon|prosciutto|meatball|meatloaf|short rib|oxtail/.test(text);
  const hasFish = /shrimp|fish|salmon|tuna|crab|lobster|anchov|oyster|branzino|calamari|squid|scallop/.test(text);
  const hasDairy = /cheese|cream|butter|milk|yogurt|ricotta|mozzarella|parmesan|burrata/.test(text);
  const hasGluten = /bread|noodle|pasta|flour|baguette|biscuit|dumpling|wonton|gyoza|crust|tortilla|bun|roll|panko/.test(text);
  const hasNuts = /peanut|almond|cashew|walnut|pistachio|pine nut/.test(text);
  const hasPork = /pork|bacon|ham|prosciutto|sausage|lard/.test(text);

  return {
    vegan: !hasMeat && !hasFish && !hasDairy && !text.includes("egg") ? true : false,
    vegetarian: !hasMeat && !hasFish ? true : false,
    gluten_free: !hasGluten ? true : null,
    dairy_free: !hasDairy ? true : null,
    nut_free: !hasNuts ? true : null,
    halal: !hasPork && !text.includes("alcohol") ? true : null,
    kosher: !hasPork && !hasFish ? null : null,
  };
}

async function main() {
  console.log("Seeding FoodClaw with real Manhattan restaurants...\n");

  // Clear existing data
  console.log("Clearing existing data...");
  await prisma.communityFeedback.deleteMany();
  await prisma.userFavorite.deleteMany();
  await prisma.dishPhoto.deleteMany();
  await prisma.reviewSummary.deleteMany();
  await prisma.restaurantLogistics.deleteMany();
  await prisma.restaurantDelivery.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.restaurant.deleteMany();

  let totalDishes = 0;

  for (const r of seedRestaurants) {
    // Create restaurant
    const placeId = `ChIJ_${r.name.replace(/[^a-zA-Z]/g, "").slice(0, 20)}_${Math.random().toString(36).slice(2, 8)}`;
    const restaurant = await prisma.restaurant.create({
      data: {
        googlePlaceId: placeId,
        name: r.name,
        address: r.address,
        latitude: r.lat,
        longitude: r.lng,
        cuisineType: r.cuisine,
        priceLevel: r.price,
        googleRating: r.rating,
        phone: r.phone,
        websiteUrl: r.website,
        menuSource: "website",
        isActive: true,
        lastMenuCrawl: new Date(),
      },
    });

    // Add logistics for all days and key hours (so wait time data is always available)
    const baseBusyness = 20 + Math.floor(Math.random() * 40);
    for (let day = 0; day <= 6; day++) {
      // Lunch (11-14) and dinner (17-21) hours — most relevant for food discovery
      for (let h = 0; h < 24; h++) {
        const peakBonus = (h >= 12 && h <= 13) || (h >= 18 && h <= 19) ? 25 : 0;
        const weekendBonus = day === 0 || day === 6 ? 10 : 0;
        const b = Math.max(10, Math.min(100, baseBusyness + peakBonus + weekendBonus + Math.floor(Math.random() * 15 - 7)));
        await prisma.restaurantLogistics.create({
          data: {
            restaurantId: restaurant.id,
            dayOfWeek: day,
            hour: h,
            typicalBusynessPct: b,
            estimatedWaitMinutes: Math.round(b * 0.35),
          },
        });
      }
    }

    // Create dishes
    for (let i = 0; i < r.dishes.length; i++) {
      const d = r.dishes[i];
      const flags = inferDietaryFlags(d.name, d.description);
      const variance = 0.12; // ±12% for min/max range

      const dish = await prisma.dish.create({
        data: {
          restaurantId: restaurant.id,
          name: d.name,
          description: d.description,
          price: d.price,
          category: d.category,
          ingredientsRaw: d.description,
          dietaryFlags: flags,
          dietaryConfidence: 0.75 + Math.random() * 0.2,
          caloriesMin: Math.round(d.calories * (1 - variance)),
          caloriesMax: Math.round(d.calories * (1 + variance)),
          proteinMinG: Math.round(d.protein * (1 - variance) * 10) / 10,
          proteinMaxG: Math.round(d.protein * (1 + variance) * 10) / 10,
          carbsMinG: Math.round(d.carbs * (1 - variance) * 10) / 10,
          carbsMaxG: Math.round(d.carbs * (1 + variance) * 10) / 10,
          fatMinG: Math.round(d.fat * (1 - variance) * 10) / 10,
          fatMaxG: Math.round(d.fat * (1 + variance) * 10) / 10,
          macroConfidence: 0.78 + Math.random() * 0.17,
          macroSource: "third_party_db",
          macroSourceName: "USDA / MyFitnessPal estimate",
          isAvailable: true,
        },
      });

      // Add photo
      await prisma.dishPhoto.create({
        data: {
          dishId: dish.id,
          sourceUrl: matchPhoto(d.name),
          sourcePlatform: "google_maps",
          analyzedAt: new Date(),
        },
      });

      // Add review summary (~70% of dishes)
      if (Math.random() < 0.7) {
        const rating = 3.5 + Math.random() * 1.5;
        await prisma.reviewSummary.create({
          data: {
            dishId: dish.id,
            averageDishRating: Math.round(rating * 10) / 10,
            totalReviewsAnalyzed: 5 + Math.floor(Math.random() * 40),
            summaryText: `Popular dish at ${r.name}. Customers praise the flavors and portion size.`,
            commonPraises: ["Great flavor", "Good portion", "Fresh ingredients"],
            commonComplaints: Math.random() < 0.3 ? ["Can be spicy", "Wait time"] : [],
            lastUpdated: new Date(),
          },
        });
      }
    }

    totalDishes += r.dishes.length;
    console.log(`  ${r.name}: ${r.dishes.length} dishes created`);
  }

  console.log(`\nDone! Created ${seedRestaurants.length} restaurants with ${totalDishes} total dishes.`);
  await prisma.$disconnect();
}

main().catch(console.error);
