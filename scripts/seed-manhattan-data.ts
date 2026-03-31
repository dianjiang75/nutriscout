// FoodClaw Seed Data — Real Manhattan Restaurants
// Generated from web research (March 2026)
// Sources: Yelp, Google, The Infatuation, TimeOut, Michelin Guide, restaurant websites

export const seedRestaurants = [
  // ==================== THAI (4) ====================
  {
    name: "Somtum Der",
    address: "85 Ave A, New York, NY 10009",
    neighborhood: "East Village",
    lat: 40.7264,
    lng: -73.9840,
    cuisine: ["Thai", "Isan"],
    price: 2,
    rating: 4.4,
    phone: "(212) 260-8570",
    website: "https://www.somtumdernewyork.com",
    dishes: [
      { name: "Somtum Thai", description: "Green papaya salad with tomato, long bean, peanut, dried shrimp, palm sugar, and lime", price: 14.00, category: "Appetizers", calories: 220, protein: 8, carbs: 28, fat: 10 },
      { name: "Larb Moo Tod", description: "Crispy pork larb with toasted rice, shallots, mint, cilantro, and chili", price: 16.00, category: "Appetizers", calories: 380, protein: 22, carbs: 18, fat: 24 },
      { name: "Pad Thai Goong", description: "Stir-fried rice noodles with shrimp, egg, bean sprouts, chives, and tamarind sauce", price: 18.00, category: "Entrees", calories: 520, protein: 24, carbs: 62, fat: 18 },
      { name: "Gaeng Keow Wan Gai", description: "Green curry with chicken, Thai eggplant, bamboo shoots, and sweet basil in coconut milk", price: 17.00, category: "Entrees", calories: 480, protein: 28, carbs: 22, fat: 30 },
      { name: "Khao Niew Ma Muang", description: "Sticky rice with fresh mango and sweet coconut cream", price: 12.00, category: "Desserts", calories: 360, protein: 4, carbs: 68, fat: 10 },
      { name: "Nam Tok Moo", description: "Grilled pork waterfall salad with toasted rice, mint, shallots, and fish sauce", price: 16.00, category: "Appetizers", calories: 310, protein: 26, carbs: 12, fat: 18 }
    ]
  },
  {
    name: "Soothr",
    address: "204 E 13th St, New York, NY 10003",
    neighborhood: "East Village",
    lat: 40.7325,
    lng: -73.9876,
    cuisine: ["Thai"],
    price: 2,
    rating: 4.5,
    phone: "(212) 844-9789",
    website: "https://www.soothrnyc.com",
    dishes: [
      { name: "Sukhothai Noodle", description: "Dry rice noodles with pork, homemade fish cake, ground peanuts, dried shrimp, and jammy egg", price: 18.00, category: "Entrees", calories: 560, protein: 30, carbs: 58, fat: 22 },
      { name: "Khao Soi Gai", description: "Northern Thai curry noodle soup with chicken, crispy egg noodles, pickled mustard greens", price: 19.00, category: "Entrees", calories: 620, protein: 32, carbs: 52, fat: 30 },
      { name: "Ba Mii Pu", description: "Spicy dry crab egg noodles with ground peanuts, bean sprouts, and lettuce", price: 22.00, category: "Entrees", calories: 510, protein: 26, carbs: 48, fat: 24 },
      { name: "Tom Yum Noodle Soup", description: "Rice noodles in spicy and sour tom yum broth with shrimp and mushrooms", price: 18.00, category: "Entrees", calories: 440, protein: 24, carbs: 50, fat: 16 },
      { name: "Moo Ping", description: "Grilled marinated pork skewers with tamarind dipping sauce and sticky rice", price: 14.00, category: "Appetizers", calories: 340, protein: 22, carbs: 30, fat: 14 },
      { name: "Kanom Jeen Nam Ya", description: "Fermented rice noodles in spicy fish curry with fresh vegetables", price: 17.00, category: "Entrees", calories: 420, protein: 20, carbs: 52, fat: 16 }
    ]
  },
  {
    name: "Fish Cheeks",
    address: "55 Bond St, New York, NY 10012",
    neighborhood: "NoHo",
    lat: 40.7263,
    lng: -73.9928,
    cuisine: ["Thai", "Seafood"],
    price: 3,
    rating: 4.4,
    phone: "(212) 677-2223",
    website: "https://www.fishcheeksnyc.com",
    dishes: [
      { name: "Coconut Crab Curry", description: "Jumbo lump crab in yellow coconut curry with Thai herbs and lime leaf", price: 34.00, category: "Entrees", calories: 520, protein: 32, carbs: 18, fat: 36 },
      { name: "Crab Fried Rice", description: "Wok-fried jasmine rice with crab meat, egg, scallions, and fish sauce", price: 28.00, category: "Entrees", calories: 580, protein: 26, carbs: 68, fat: 22 },
      { name: "Zabb Wings", description: "Crispy chicken wings tossed in spicy fish sauce glaze with toasted rice and herbs", price: 18.00, category: "Appetizers", calories: 440, protein: 28, carbs: 22, fat: 28 },
      { name: "Whole Branzino", description: "Deep-fried branzino with three-flavor sauce, crispy basil, and chili", price: 36.00, category: "Entrees", calories: 480, protein: 42, carbs: 16, fat: 28 },
      { name: "Pork Cheek Chili Garlic", description: "Braised pork cheeks with roasted chili garlic sauce and Thai basil", price: 26.00, category: "Entrees", calories: 460, protein: 34, carbs: 12, fat: 30 },
      { name: "Shrimp Paste Rice", description: "Fried rice with shrimp paste, sweet pork, dried shrimp, shredded omelette, and fresh mango", price: 22.00, category: "Entrees", calories: 540, protein: 24, carbs: 64, fat: 20 }
    ]
  },
  {
    name: "Thai Diner",
    address: "186 Mott St, New York, NY 10012",
    neighborhood: "Nolita",
    lat: 40.7207,
    lng: -73.9956,
    cuisine: ["Thai", "American"],
    price: 2,
    rating: 4.3,
    phone: "(646) 559-4140",
    website: "https://www.thaidiner.com",
    dishes: [
      { name: "Crab Fried Rice", description: "Uncle Boon's signature crab fried rice with egg and scallions", price: 28.00, category: "Entrees", calories: 560, protein: 24, carbs: 66, fat: 22 },
      { name: "Thai Disco Fries", description: "Crispy fries with green curry gravy and cheese curds", price: 14.00, category: "Appetizers", calories: 520, protein: 12, carbs: 48, fat: 32 },
      { name: "Coconut Pancakes", description: "Fluffy coconut pancakes with coconut cream and tropical fruit", price: 17.00, category: "Brunch", calories: 480, protein: 8, carbs: 58, fat: 24 },
      { name: "Drunken Dumplings", description: "Pan-fried dumplings with spicy basil filling and chili vinegar", price: 15.00, category: "Appetizers", calories: 340, protein: 14, carbs: 32, fat: 18 },
      { name: "Roti Kabocha", description: "Flaky roti bread with kabocha squash curry dipping sauce", price: 14.00, category: "Appetizers", calories: 380, protein: 8, carbs: 44, fat: 20 },
      { name: "Khao Soi", description: "Northern Thai curry with egg noodles, crispy shallots, and pickled mustard", price: 22.00, category: "Entrees", calories: 580, protein: 28, carbs: 54, fat: 28 }
    ]
  },

  // ==================== JAPANESE/SUSHI (4) ====================
  {
    name: "Sushi Yasuda",
    address: "204 E 43rd St, New York, NY 10017",
    neighborhood: "Midtown East",
    lat: 40.7520,
    lng: -73.9735,
    cuisine: ["Japanese", "Sushi"],
    price: 4,
    rating: 4.6,
    phone: "(212) 972-1001",
    website: "https://www.sushiyasuda.com",
    dishes: [
      { name: "Omakase", description: "Chef's selection of 15-20 pieces of seasonal nigiri sushi", price: 120.00, category: "Omakase", calories: 800, protein: 52, carbs: 80, fat: 24 },
      { name: "Toro Nigiri", description: "Fatty bluefin tuna belly over seasoned sushi rice", price: 12.00, category: "Nigiri", calories: 80, protein: 6, carbs: 8, fat: 4 },
      { name: "Uni Nigiri", description: "Fresh sea urchin from Hokkaido over sushi rice", price: 14.00, category: "Nigiri", calories: 70, protein: 5, carbs: 8, fat: 3 },
      { name: "Salmon Sashimi", description: "Six pieces of fresh Atlantic salmon, thinly sliced", price: 16.00, category: "Sashimi", calories: 180, protein: 22, carbs: 0, fat: 10 },
      { name: "Yellowtail Hand Roll", description: "Hamachi with scallion in crispy nori cone with sushi rice", price: 8.00, category: "Hand Rolls", calories: 140, protein: 8, carbs: 16, fat: 5 },
      { name: "Chirashi Bowl", description: "Assorted sashimi over seasoned sushi rice with pickled ginger", price: 38.00, category: "Entrees", calories: 620, protein: 40, carbs: 72, fat: 14 }
    ]
  },
  {
    name: "Sushi Nakazawa",
    address: "23 Commerce St, New York, NY 10014",
    neighborhood: "West Village",
    lat: 40.7322,
    lng: -74.0037,
    cuisine: ["Japanese", "Sushi"],
    price: 4,
    rating: 4.7,
    phone: "(212) 924-2212",
    website: "https://www.sushinakazawa.com",
    dishes: [
      { name: "21-Course Omakase", description: "Chef Nakazawa's signature twenty-one course sushi omakase experience", price: 190.00, category: "Omakase", calories: 1100, protein: 68, carbs: 110, fat: 32 },
      { name: "Kohada Nigiri", description: "Gizzard shad marinated in vinegar, a classic Edomae preparation", price: 10.00, category: "Nigiri", calories: 65, protein: 5, carbs: 8, fat: 2 },
      { name: "A5 Wagyu Nigiri", description: "Japanese A5 wagyu beef lightly seared over sushi rice", price: 18.00, category: "Nigiri", calories: 120, protein: 6, carbs: 8, fat: 8 },
      { name: "Anago Nigiri", description: "Freshwater eel brushed with sweet soy reduction over rice", price: 10.00, category: "Nigiri", calories: 90, protein: 6, carbs: 10, fat: 4 },
      { name: "Tamago", description: "House-made sweet Japanese omelette, a signature preparation", price: 8.00, category: "Nigiri", calories: 85, protein: 6, carbs: 10, fat: 3 },
      { name: "Seasonal Sashimi Plate", description: "Selection of five seasonal fish, chef's choice", price: 42.00, category: "Sashimi", calories: 280, protein: 38, carbs: 2, fat: 14 }
    ]
  },
  {
    name: "Raku",
    address: "342 E 6th St, New York, NY 10003",
    neighborhood: "East Village",
    lat: 40.7268,
    lng: -73.9867,
    cuisine: ["Japanese", "Udon"],
    price: 2,
    rating: 4.5,
    phone: "(212) 228-1324",
    website: "https://www.rakunyc.com",
    dishes: [
      { name: "Kitsune Udon", description: "Hand-pulled udon noodles in dashi broth with sweet fried tofu", price: 16.00, category: "Entrees", calories: 420, protein: 16, carbs: 62, fat: 12 },
      { name: "Nabeyaki Udon", description: "Hot pot udon with shrimp tempura, chicken, egg, mushroom, and vegetables", price: 22.00, category: "Entrees", calories: 580, protein: 30, carbs: 68, fat: 18 },
      { name: "Curry Udon", description: "Thick udon noodles in Japanese curry broth with sliced pork", price: 18.00, category: "Entrees", calories: 540, protein: 24, carbs: 64, fat: 20 },
      { name: "Cold Zaru Udon", description: "Chilled hand-pulled udon with dipping sauce, scallion, and wasabi", price: 14.00, category: "Entrees", calories: 340, protein: 10, carbs: 64, fat: 4 },
      { name: "Agedashi Tofu", description: "Deep-fried silken tofu in warm dashi broth with grated daikon", price: 10.00, category: "Appetizers", calories: 220, protein: 10, carbs: 18, fat: 12 },
      { name: "Karaage", description: "Japanese fried chicken thigh with yuzu mayo and shichimi", price: 14.00, category: "Appetizers", calories: 380, protein: 24, carbs: 20, fat: 22 }
    ]
  },
  {
    name: "Katsu-Hama",
    address: "11 E 47th St, New York, NY 10017",
    neighborhood: "Midtown",
    lat: 40.7558,
    lng: -73.9770,
    cuisine: ["Japanese"],
    price: 2,
    rating: 4.3,
    phone: "(212) 758-5909",
    website: "https://www.katsuhama.com",
    dishes: [
      { name: "Hire Katsu Set", description: "Premium pork tenderloin cutlet, deep-fried with panko, served with cabbage, rice, and miso soup", price: 22.00, category: "Entrees", calories: 680, protein: 36, carbs: 62, fat: 30 },
      { name: "Rosu Katsu Set", description: "Pork loin cutlet with tonkatsu sauce, cabbage, rice, and pickles", price: 20.00, category: "Entrees", calories: 740, protein: 34, carbs: 64, fat: 36 },
      { name: "Chicken Katsu Set", description: "Crispy panko-breaded chicken breast with curry sauce, rice, and salad", price: 19.00, category: "Entrees", calories: 660, protein: 38, carbs: 60, fat: 28 },
      { name: "Katsu Curry", description: "Tonkatsu pork cutlet with Japanese curry, steamed rice, and fukujinzuke", price: 21.00, category: "Entrees", calories: 780, protein: 32, carbs: 82, fat: 34 },
      { name: "Ebi Fry Set", description: "Jumbo fried shrimp with tartar sauce, rice, miso soup, and cabbage", price: 24.00, category: "Entrees", calories: 620, protein: 28, carbs: 58, fat: 28 },
      { name: "Katsu Don", description: "Tonkatsu over rice with egg, onion, and sweet soy broth", price: 18.00, category: "Entrees", calories: 720, protein: 34, carbs: 74, fat: 30 }
    ]
  },

  // ==================== ITALIAN (3) ====================
  {
    name: "L'Artusi",
    address: "228 W 10th St, New York, NY 10014",
    neighborhood: "West Village",
    lat: 40.7338,
    lng: -74.0027,
    cuisine: ["Italian"],
    price: 3,
    rating: 4.5,
    phone: "(212) 255-5757",
    website: "https://www.lartusi.com",
    dishes: [
      { name: "Spaghetti Cacio e Pepe", description: "Spaghetti with pecorino romano and cracked black pepper", price: 22.00, category: "Pasta", calories: 520, protein: 18, carbs: 62, fat: 22 },
      { name: "Beef Carpaccio", description: "Thinly sliced raw beef with arugula, capers, and shaved parmigiano", price: 18.00, category: "Crudo", calories: 240, protein: 22, carbs: 4, fat: 16 },
      { name: "Ricotta Gnudi", description: "Light ricotta dumplings with brown butter and sage", price: 20.00, category: "Pasta", calories: 440, protein: 16, carbs: 34, fat: 26 },
      { name: "Grilled Branzino", description: "Whole grilled branzino with olive oil, lemon, and herbs", price: 36.00, category: "Entrees", calories: 380, protein: 42, carbs: 2, fat: 22 },
      { name: "Burrata", description: "Fresh burrata with grilled peaches, arugula, and aged balsamic", price: 19.00, category: "Appetizers", calories: 320, protein: 14, carbs: 12, fat: 24 },
      { name: "Olive Oil Cake", description: "Moist olive oil cake with mascarpone cream and citrus zest", price: 14.00, category: "Desserts", calories: 420, protein: 6, carbs: 48, fat: 24 }
    ]
  },
  {
    name: "Via Carota",
    address: "51 Grove St, New York, NY 10014",
    neighborhood: "West Village",
    lat: 40.7330,
    lng: -74.0035,
    cuisine: ["Italian"],
    price: 3,
    rating: 4.6,
    phone: "(212) 255-1962",
    website: "https://www.viacarota.com",
    dishes: [
      { name: "Carciofi Fritti", description: "Fried artichokes Roman-style with lemon and sea salt", price: 18.00, category: "Appetizers", calories: 280, protein: 6, carbs: 24, fat: 18 },
      { name: "Tonnarelli Cacio e Pepe", description: "Fresh hand-cut pasta with pecorino and black pepper", price: 24.00, category: "Pasta", calories: 540, protein: 20, carbs: 64, fat: 22 },
      { name: "Pappardelle al Ragu", description: "Wide ribbon pasta with slow-braised wild boar ragu", price: 28.00, category: "Pasta", calories: 620, protein: 30, carbs: 58, fat: 28 },
      { name: "Insalata Verde", description: "Mixed green salad with herbs, fennel, celery, and lemon vinaigrette", price: 16.00, category: "Appetizers", calories: 160, protein: 4, carbs: 12, fat: 12 },
      { name: "Pollo Arrosto", description: "Roasted half chicken with salsa verde and roasted potatoes", price: 34.00, category: "Entrees", calories: 680, protein: 48, carbs: 28, fat: 38 },
      { name: "Panna Cotta", description: "Classic vanilla panna cotta with seasonal fruit compote", price: 14.00, category: "Desserts", calories: 340, protein: 6, carbs: 32, fat: 22 }
    ]
  },
  {
    name: "Don Angie",
    address: "103 Greenwich Ave, New York, NY 10014",
    neighborhood: "West Village",
    lat: 40.7360,
    lng: -73.9994,
    cuisine: ["Italian", "Italian-American"],
    price: 3,
    rating: 4.6,
    phone: "(212) 889-8884",
    website: "https://www.donangie.com",
    dishes: [
      { name: "Pinwheel Lasagna", description: "Signature spiral-rolled lasagna with bolognese, bechamel, and mozzarella", price: 28.00, category: "Pasta", calories: 680, protein: 32, carbs: 52, fat: 36 },
      { name: "Chrysanthemum Salad", description: "Shaved vegetables arranged like a flower with lemon vinaigrette", price: 18.00, category: "Appetizers", calories: 180, protein: 4, carbs: 16, fat: 12 },
      { name: "Fuzi Bolognese", description: "Hand-rolled pasta with rich meat sauce and parmigiano", price: 26.00, category: "Pasta", calories: 580, protein: 28, carbs: 56, fat: 26 },
      { name: "Meatballs al Forno", description: "Baked meatballs in tomato sauce with whipped ricotta and basil", price: 22.00, category: "Appetizers", calories: 460, protein: 28, carbs: 24, fat: 28 },
      { name: "Pork Chop Milanese", description: "Breaded and fried pork chop with arugula and cherry tomato salad", price: 38.00, category: "Entrees", calories: 720, protein: 44, carbs: 32, fat: 44 },
      { name: "Black Cocoa Tiramisu", description: "Dark cocoa tiramisu with espresso-soaked ladyfingers and mascarpone", price: 16.00, category: "Desserts", calories: 440, protein: 8, carbs: 48, fat: 24 }
    ]
  },

  // ==================== MEXICAN (3) ====================
  {
    name: "Los Tacos No. 1",
    address: "75 9th Ave, New York, NY 10011",
    neighborhood: "Chelsea",
    lat: 40.7424,
    lng: -74.0048,
    cuisine: ["Mexican"],
    price: 1,
    rating: 4.6,
    phone: "(212) 256-0343",
    website: "https://www.lostacos1.com",
    dishes: [
      { name: "Taco de Adobada", description: "Marinated pork al pastor in hand-pressed corn tortilla with onion, cilantro, and salsa", price: 4.75, category: "Tacos", calories: 220, protein: 14, carbs: 22, fat: 10 },
      { name: "Taco de Asada", description: "Grilled steak in fresh corn tortilla with onion and cilantro", price: 4.75, category: "Tacos", calories: 240, protein: 16, carbs: 20, fat: 12 },
      { name: "Taco de Pollo", description: "Grilled chicken in corn tortilla with fresh salsa verde", price: 4.50, category: "Tacos", calories: 200, protein: 18, carbs: 20, fat: 6 },
      { name: "Quesadilla de Asada", description: "Flour tortilla with melted cheese and grilled steak", price: 9.50, category: "Quesadillas", calories: 480, protein: 28, carbs: 36, fat: 24 },
      { name: "Taco de Nopal", description: "Grilled cactus with onion, cilantro, and salsa roja in corn tortilla", price: 4.25, category: "Tacos", calories: 160, protein: 4, carbs: 22, fat: 6 },
      { name: "Horchata", description: "Traditional Mexican rice milk drink with cinnamon and vanilla", price: 5.00, category: "Beverages", calories: 180, protein: 2, carbs: 38, fat: 3 },
      { name: "Mulita de Adobada", description: "Double tortilla with al pastor pork, melted cheese, and salsa", price: 8.00, category: "Specialties", calories: 420, protein: 22, carbs: 38, fat: 20 }
    ]
  },
  {
    name: "La Contenta",
    address: "102 Norfolk St, New York, NY 10002",
    neighborhood: "Lower East Side",
    lat: 40.7189,
    lng: -73.9869,
    cuisine: ["Mexican"],
    price: 2,
    rating: 4.3,
    phone: "(212) 432-4180",
    website: "https://lacontentales.com",
    dishes: [
      { name: "Guacamole Clasico", description: "Fresh avocado with serrano pepper, onion, cilantro, and lime, served with chips", price: 14.00, category: "Appetizers", calories: 320, protein: 4, carbs: 18, fat: 28 },
      { name: "Fish Tacos", description: "Beer-battered white fish with chipotle crema, cabbage slaw, and pico de gallo", price: 16.00, category: "Tacos", calories: 380, protein: 22, carbs: 32, fat: 18 },
      { name: "Pork Belly Tostada", description: "Crispy tostada with braised pork belly, avocado, and pickled onion", price: 15.00, category: "Appetizers", calories: 420, protein: 18, carbs: 28, fat: 26 },
      { name: "Enchiladas de Mole", description: "Corn tortillas filled with chicken in rich mole negro sauce with sesame seeds", price: 22.00, category: "Entrees", calories: 540, protein: 28, carbs: 42, fat: 26 },
      { name: "Tacos de Carnitas", description: "Slow-roasted pulled pork tacos with salsa verde and pickled onion", price: 16.00, category: "Tacos", calories: 360, protein: 24, carbs: 28, fat: 16 },
      { name: "Churros con Chocolate", description: "Crispy cinnamon churros with warm Mexican chocolate dipping sauce", price: 12.00, category: "Desserts", calories: 380, protein: 4, carbs: 52, fat: 18 }
    ]
  },
  {
    name: "El Camion Cantina",
    address: "194 Ave A, New York, NY 10009",
    neighborhood: "East Village",
    lat: 40.7285,
    lng: -73.9790,
    cuisine: ["Mexican"],
    price: 2,
    rating: 4.2,
    phone: "(212) 228-0977",
    website: "https://www.elcamioncantina.com",
    dishes: [
      { name: "Al Pastor Tacos", description: "Handmade corn tortillas with spit-roasted pork, pineapple, and cilantro", price: 14.00, category: "Tacos", calories: 340, protein: 20, carbs: 30, fat: 14 },
      { name: "Birria Tacos", description: "Braised beef birria tacos with consomme for dipping", price: 16.00, category: "Tacos", calories: 440, protein: 28, carbs: 32, fat: 22 },
      { name: "Elote", description: "Grilled Mexican street corn with mayo, cotija cheese, chili powder, and lime", price: 8.00, category: "Appetizers", calories: 240, protein: 6, carbs: 28, fat: 14 },
      { name: "Burrito de Pollo", description: "Large flour tortilla with grilled chicken, rice, beans, cheese, and pico de gallo", price: 14.00, category: "Entrees", calories: 680, protein: 36, carbs: 72, fat: 24 },
      { name: "Nachos Supremos", description: "Tortilla chips with ground beef, cheese, jalapenos, guacamole, and sour cream", price: 15.00, category: "Appetizers", calories: 780, protein: 28, carbs: 56, fat: 48 },
      { name: "Tres Leches Cake", description: "Sponge cake soaked in three milks with whipped cream and cinnamon", price: 10.00, category: "Desserts", calories: 420, protein: 8, carbs: 56, fat: 18 }
    ]
  },

  // ==================== INDIAN (3) ====================
  {
    name: "Adda",
    address: "107 1st Ave, New York, NY 10003",
    neighborhood: "East Village",
    lat: 40.7272,
    lng: -73.9851,
    cuisine: ["Indian"],
    price: 3,
    rating: 4.5,
    phone: "(917) 502-3396",
    website: "https://www.addanyc.com",
    dishes: [
      { name: "Butter Chicken", description: "Tandoori chicken in rich tomato-cream sauce with fenugreek, served tableside", price: 28.00, category: "Entrees", calories: 520, protein: 34, carbs: 18, fat: 34 },
      { name: "Lamb Seekh Kebab", description: "Spiced ground lamb skewers cooked in tandoor with mint chutney", price: 18.00, category: "Appetizers", calories: 340, protein: 24, carbs: 8, fat: 24 },
      { name: "Chicken Biryani", description: "Fragrant basmati rice layered with spiced chicken, saffron, and caramelized onion", price: 26.00, category: "Entrees", calories: 620, protein: 32, carbs: 72, fat: 20 },
      { name: "Fish Curry", description: "Coastal-style fish curry with coconut milk, curry leaves, and tamarind", price: 26.00, category: "Entrees", calories: 380, protein: 30, carbs: 14, fat: 24 },
      { name: "Garlic Naan", description: "Tandoor-baked leavened bread with garlic butter and cilantro", price: 6.00, category: "Breads", calories: 260, protein: 8, carbs: 38, fat: 8 },
      { name: "Gulab Jamun", description: "Warm milk dumplings soaked in rose cardamom syrup", price: 10.00, category: "Desserts", calories: 320, protein: 4, carbs: 52, fat: 12 }
    ]
  },
  {
    name: "Dhaba",
    address: "108 Lexington Ave, New York, NY 10016",
    neighborhood: "Midtown",
    lat: 40.7460,
    lng: -73.9800,
    cuisine: ["Indian"],
    price: 2,
    rating: 4.2,
    phone: "(212) 679-1284",
    website: "https://www.dhabanyc.com",
    dishes: [
      { name: "Chicken Tikka Masala", description: "Tandoori chicken pieces in creamy tomato-spice sauce with fenugreek", price: 19.00, category: "Entrees", calories: 480, protein: 32, carbs: 16, fat: 32 },
      { name: "Saag Paneer", description: "Fresh spinach puree with cubes of house-made paneer cheese", price: 16.00, category: "Entrees", calories: 360, protein: 18, carbs: 12, fat: 26 },
      { name: "Lamb Rogan Josh", description: "Braised lamb in aromatic Kashmiri spice gravy with yogurt", price: 22.00, category: "Entrees", calories: 520, protein: 36, carbs: 14, fat: 36 },
      { name: "Samosa Chaat", description: "Crispy potato samosas topped with chickpea curry, yogurt, and tamarind chutney", price: 10.00, category: "Appetizers", calories: 380, protein: 10, carbs: 48, fat: 16 },
      { name: "Dal Makhani", description: "Slow-cooked black lentils with cream, butter, and spices", price: 15.00, category: "Entrees", calories: 340, protein: 14, carbs: 36, fat: 16 },
      { name: "Tandoori Mixed Grill", description: "Assortment of tandoori chicken, lamb chop, seekh kebab, and shrimp", price: 28.00, category: "Entrees", calories: 560, protein: 48, carbs: 8, fat: 36 }
    ]
  },
  {
    name: "Panna II",
    address: "93 1st Ave, New York, NY 10003",
    neighborhood: "East Village",
    lat: 40.7265,
    lng: -73.9855,
    cuisine: ["Indian"],
    price: 1,
    rating: 4.0,
    phone: "(212) 598-4610",
    website: "https://www.panna2.com",
    dishes: [
      { name: "Chicken Vindaloo", description: "Spicy chicken curry with potatoes in tangy vinegar-based sauce", price: 13.00, category: "Entrees", calories: 420, protein: 28, carbs: 22, fat: 24 },
      { name: "Malai Kofta", description: "Fried paneer and vegetable dumplings in rich cream sauce", price: 12.00, category: "Entrees", calories: 480, protein: 14, carbs: 32, fat: 34 },
      { name: "Tandoori Chicken", description: "Half chicken marinated in yogurt and spices, roasted in tandoor", price: 14.00, category: "Entrees", calories: 380, protein: 38, carbs: 6, fat: 22 },
      { name: "Aloo Gobi", description: "Cauliflower and potato cooked with cumin, turmeric, and tomatoes", price: 11.00, category: "Entrees", calories: 260, protein: 6, carbs: 34, fat: 12 },
      { name: "Mango Lassi", description: "Creamy yogurt smoothie blended with sweet mango pulp", price: 5.00, category: "Beverages", calories: 220, protein: 6, carbs: 38, fat: 6 },
      { name: "Garlic Naan", description: "Fluffy tandoor-baked bread brushed with garlic butter", price: 4.00, category: "Breads", calories: 260, protein: 8, carbs: 38, fat: 8 }
    ]
  },

  // ==================== CHINESE (3) ====================
  {
    name: "Nom Wah Tea Parlor",
    address: "13 Doyers St, New York, NY 10013",
    neighborhood: "Chinatown",
    lat: 40.7141,
    lng: -73.9981,
    cuisine: ["Chinese", "Dim Sum"],
    price: 2,
    rating: 4.3,
    phone: "(212) 962-6047",
    website: "https://www.nomwah.com",
    dishes: [
      { name: "Original Egg Roll", description: "Nom Wah's famous egg roll since 1920 with mixed vegetables and chicken", price: 7.95, category: "Dim Sum", calories: 280, protein: 10, carbs: 28, fat: 14 },
      { name: "Shrimp Ha Gow", description: "Steamed crystal shrimp dumplings with translucent wheat starch wrapper", price: 8.95, category: "Dim Sum", calories: 180, protein: 14, carbs: 18, fat: 6 },
      { name: "Siu Mai", description: "Open-top pork and shrimp dumplings topped with fish roe", price: 7.95, category: "Dim Sum", calories: 200, protein: 14, carbs: 16, fat: 8 },
      { name: "Turnip Cake", description: "Pan-fried daikon radish cake with dried shrimp and scallion", price: 6.95, category: "Dim Sum", calories: 220, protein: 6, carbs: 26, fat: 10 },
      { name: "Roast Pork Bun", description: "Fluffy steamed bao filled with sweet BBQ roast pork", price: 7.95, category: "Dim Sum", calories: 260, protein: 12, carbs: 32, fat: 10 },
      { name: "Pan Fried Noodles", description: "Crispy wheat flour noodles with soy sauce glaze and scallions", price: 10.95, category: "Noodles", calories: 420, protein: 12, carbs: 56, fat: 16 },
      { name: "Salt and Pepper Squid", description: "Wok-fried calamari with chili, garlic, and salt-pepper seasoning", price: 11.95, category: "Small Plates", calories: 320, protein: 18, carbs: 22, fat: 18 }
    ]
  },
  {
    name: "Jing Fong",
    address: "202 Centre St, New York, NY 10013",
    neighborhood: "Chinatown",
    lat: 40.7180,
    lng: -73.9995,
    cuisine: ["Chinese", "Cantonese", "Dim Sum"],
    price: 2,
    rating: 4.1,
    phone: "(212) 964-5256",
    website: "https://jingfongny.com",
    dishes: [
      { name: "Har Gow", description: "Classic steamed shrimp dumplings in translucent rice flour wrapper", price: 7.50, category: "Dim Sum", calories: 160, protein: 12, carbs: 16, fat: 5 },
      { name: "Char Siu Bao", description: "Steamed fluffy buns filled with sweet barbecue roast pork", price: 6.50, category: "Dim Sum", calories: 240, protein: 10, carbs: 30, fat: 8 },
      { name: "Spare Ribs with Black Bean", description: "Steamed pork spare ribs with fermented black bean and chili", price: 7.50, category: "Dim Sum", calories: 320, protein: 22, carbs: 8, fat: 24 },
      { name: "Cheung Fun", description: "Silky rice noodle rolls filled with shrimp, drizzled with sweet soy", price: 7.50, category: "Dim Sum", calories: 220, protein: 10, carbs: 32, fat: 6 },
      { name: "Peking Duck", description: "Whole roasted duck served with pancakes, scallion, and hoisin sauce", price: 58.00, category: "Entrees", calories: 480, protein: 36, carbs: 28, fat: 24 },
      { name: "Lo Mein", description: "Wok-tossed egg noodles with vegetables and choice of protein", price: 14.00, category: "Noodles", calories: 520, protein: 22, carbs: 62, fat: 20 },
      { name: "Dan Tat", description: "Flaky Portuguese-style egg custard tart", price: 3.50, category: "Desserts", calories: 180, protein: 4, carbs: 22, fat: 8 }
    ]
  },
  {
    name: "Xi'an Famous Foods",
    address: "81 St Marks Pl, New York, NY 10003",
    neighborhood: "East Village",
    lat: 40.7278,
    lng: -73.9876,
    cuisine: ["Chinese", "Northwestern Chinese"],
    price: 1,
    rating: 4.4,
    phone: "(212) 786-2068",
    website: "https://www.xianfoods.com",
    dishes: [
      { name: "Spicy Cumin Lamb Hand-Ripped Noodles", description: "Hand-pulled biang biang noodles with cumin-spiced lamb and chili oil", price: 12.95, category: "Noodles", calories: 680, protein: 30, carbs: 72, fat: 28 },
      { name: "Liang Pi Cold Skin Noodles", description: "Chewy cold wheat noodles with sesame paste, chili oil, and vinegar", price: 8.45, category: "Noodles", calories: 380, protein: 10, carbs: 52, fat: 14 },
      { name: "Lamb Burger", description: "Spicy cumin lamb stuffed in freshly baked flatbread", price: 7.95, category: "Sandwiches", calories: 440, protein: 24, carbs: 38, fat: 22 },
      { name: "Stewed Pork Burger", description: "Braised pork belly with spices in crispy flatbread", price: 6.95, category: "Sandwiches", calories: 460, protein: 22, carbs: 36, fat: 26 },
      { name: "Spicy and Tingly Beef Hand-Ripped Noodles", description: "Hand-pulled noodles with Sichuan peppercorn beef in numbing chili sauce", price: 12.95, category: "Noodles", calories: 640, protein: 28, carbs: 70, fat: 26 },
      { name: "N1 Spicy Cumin Lamb Noodle Soup", description: "Hand-ripped noodles in rich lamb broth with cumin lamb slices", price: 12.95, category: "Soups", calories: 580, protein: 28, carbs: 60, fat: 24 }
    ]
  },

  // ==================== KOREAN (3) ====================
  {
    name: "Baekjeong NYC",
    address: "49 W 32nd St, New York, NY 10001",
    neighborhood: "Koreatown",
    lat: 40.7481,
    lng: -73.9871,
    cuisine: ["Korean", "Korean BBQ"],
    price: 3,
    rating: 4.3,
    phone: "(212) 966-9839",
    website: "https://www.baekjeongnyc.com",
    dishes: [
      { name: "Premium Beef Combo", description: "Selection of prime brisket, short rib, and beef tongue for tabletop grilling", price: 62.00, category: "BBQ Sets", calories: 820, protein: 64, carbs: 4, fat: 60 },
      { name: "Pork Belly", description: "Thick-cut pork belly slices for grilling with ssamjang and lettuce wraps", price: 28.00, category: "BBQ", calories: 580, protein: 28, carbs: 4, fat: 50 },
      { name: "Cheese Corn", description: "Sweet corn kernels baked with mozzarella cheese", price: 10.00, category: "Side Dishes", calories: 280, protein: 10, carbs: 30, fat: 14 },
      { name: "Steamed Egg", description: "Silky Korean steamed egg custard cooked in stone pot", price: 8.00, category: "Side Dishes", calories: 140, protein: 10, carbs: 4, fat: 10 },
      { name: "Bulgogi", description: "Marinated prime beef in sweet soy sauce, grilled at the table", price: 32.00, category: "BBQ", calories: 480, protein: 36, carbs: 18, fat: 28 },
      { name: "Japchae", description: "Sweet potato glass noodles stir-fried with vegetables and beef", price: 16.00, category: "Appetizers", calories: 340, protein: 12, carbs: 52, fat: 10 },
      { name: "Kimchi Jjigae", description: "Spicy kimchi stew with pork, tofu, and scallion", price: 16.00, category: "Soups", calories: 320, protein: 22, carbs: 18, fat: 18 }
    ]
  },
  {
    name: "Her Name Is Han",
    address: "17 E 31st St, New York, NY 10016",
    neighborhood: "Koreatown",
    lat: 40.7464,
    lng: -73.9849,
    cuisine: ["Korean"],
    price: 2,
    rating: 4.4,
    phone: "(212) 779-9990",
    website: "https://www.hernameishan.com",
    dishes: [
      { name: "Bossam", description: "Slow-boiled pork belly slices with fresh lettuce, garlic, and ssamjang", price: 32.00, category: "Entrees", calories: 520, protein: 36, carbs: 12, fat: 38 },
      { name: "Seafood Pancake", description: "Crispy Korean pancake loaded with shrimp, squid, and scallion", price: 22.00, category: "Appetizers", calories: 440, protein: 20, carbs: 42, fat: 22 },
      { name: "Spicy Seafood Tofu Stew", description: "Bubbling soon-tofu jjigae with shrimp, clams, and soft tofu in chili broth", price: 18.00, category: "Soups", calories: 280, protein: 24, carbs: 14, fat: 14 },
      { name: "Grilled Mackerel", description: "Whole salt-grilled atka mackerel with steamed rice and banchan", price: 20.00, category: "Entrees", calories: 360, protein: 32, carbs: 28, fat: 18 },
      { name: "Bibimbap", description: "Hot stone bowl with rice, seasoned vegetables, beef, and gochujang", price: 18.00, category: "Entrees", calories: 560, protein: 24, carbs: 72, fat: 18 },
      { name: "Tteokbokki", description: "Spicy rice cakes in sweet-hot gochujang sauce with fish cake", price: 14.00, category: "Appetizers", calories: 380, protein: 8, carbs: 66, fat: 8 }
    ]
  },
  {
    name: "Osamil",
    address: "5 W 31st St, New York, NY 10001",
    neighborhood: "Koreatown",
    lat: 40.7472,
    lng: -73.9863,
    cuisine: ["Korean"],
    price: 2,
    rating: 4.3,
    phone: "(212) 300-4713",
    website: "https://www.osamil.com",
    dishes: [
      { name: "Uni Bibimbap", description: "Hot stone rice bowl with fresh sea urchin, sesame, and gochujang", price: 28.00, category: "Entrees", calories: 520, protein: 18, carbs: 68, fat: 20 },
      { name: "Kimchi Pancake", description: "Crispy fermented kimchi pancake with pork and scallion", price: 16.00, category: "Appetizers", calories: 360, protein: 14, carbs: 36, fat: 18 },
      { name: "Gochujang Glazed Squid", description: "Grilled whole squid with sweet-spicy gochujang glaze", price: 18.00, category: "Appetizers", calories: 280, protein: 22, carbs: 16, fat: 14 },
      { name: "Kimchi Fried Rice", description: "Wok-fried rice with aged kimchi, topped with prime hanger steak", price: 24.00, category: "Entrees", calories: 620, protein: 32, carbs: 64, fat: 24 },
      { name: "Korean Fried Chicken", description: "Double-fried chicken wings in soy garlic or spicy sauce", price: 18.00, category: "Appetizers", calories: 480, protein: 28, carbs: 28, fat: 28 },
      { name: "Soondubu Jjigae", description: "Silken tofu stew with kimchi, pork, and egg in clay pot", price: 16.00, category: "Soups", calories: 260, protein: 20, carbs: 14, fat: 14 }
    ]
  },

  // ==================== MEDITERRANEAN (2) ====================
  {
    name: "Barbounia",
    address: "250 Park Ave S, New York, NY 10003",
    neighborhood: "Gramercy",
    lat: 40.7380,
    lng: -73.9867,
    cuisine: ["Mediterranean", "Greek"],
    price: 3,
    rating: 4.3,
    phone: "(212) 995-0242",
    website: "https://www.barbounia.com",
    dishes: [
      { name: "Grilled Octopus", description: "Charred octopus with fingerling potatoes, capers, and red pepper coulis", price: 22.00, category: "Appetizers", calories: 320, protein: 28, carbs: 18, fat: 16 },
      { name: "Lamb Chops", description: "Grilled lamb chops with roasted eggplant puree, tzatziki, and za'atar", price: 42.00, category: "Entrees", calories: 580, protein: 44, carbs: 12, fat: 40 },
      { name: "Branzino", description: "Whole grilled Mediterranean sea bass with lemon, olive oil, and herbs", price: 36.00, category: "Entrees", calories: 380, protein: 42, carbs: 4, fat: 22 },
      { name: "Hummus", description: "Creamy chickpea dip with tahini, lemon, and warm pita bread", price: 14.00, category: "Appetizers", calories: 380, protein: 12, carbs: 42, fat: 18 },
      { name: "Shakshuka", description: "Baked eggs in spiced tomato sauce with feta cheese and sourdough toast", price: 18.00, category: "Brunch", calories: 420, protein: 22, carbs: 32, fat: 24 },
      { name: "Mediterranean Salad", description: "Mixed greens, tomato, cucumber, olives, feta, and lemon-herb vinaigrette", price: 16.00, category: "Appetizers", calories: 240, protein: 8, carbs: 16, fat: 18 }
    ]
  },
  {
    name: "Zaytinya",
    address: "1185 Broadway, New York, NY 10001",
    neighborhood: "NoMad",
    lat: 40.7446,
    lng: -73.9885,
    cuisine: ["Mediterranean", "Turkish", "Greek", "Lebanese"],
    price: 3,
    rating: 4.4,
    phone: "(212) 804-9070",
    website: "https://www.zaytinya.com",
    dishes: [
      { name: "Falafel", description: "Crispy chickpea fritters with tahini sauce and pickled turnip", price: 14.00, category: "Mezze", calories: 320, protein: 12, carbs: 36, fat: 16 },
      { name: "Braised Lamb Shank", description: "Slow-braised lamb shank with orzo pasta and roasted tomatoes", price: 38.00, category: "Entrees", calories: 620, protein: 46, carbs: 38, fat: 30 },
      { name: "Flaming Saganaki", description: "Pan-seared kasseri cheese flambed tableside with lemon", price: 16.00, category: "Mezze", calories: 340, protein: 18, carbs: 8, fat: 28 },
      { name: "Taramasalata", description: "Whipped carp roe dip with lemon, olive oil, and warm pita", price: 14.00, category: "Mezze", calories: 280, protein: 8, carbs: 24, fat: 18 },
      { name: "Duck Borek", description: "Spiral-shaped phyllo pastry filled with spiced duck and pistachios", price: 18.00, category: "Mezze", calories: 420, protein: 22, carbs: 30, fat: 24 },
      { name: "Moroccan Fried Chicken", description: "Crispy fried chicken with harissa honey glaze and preserved lemon", price: 24.00, category: "Entrees", calories: 540, protein: 34, carbs: 28, fat: 32 },
      { name: "Baklava", description: "Layered phyllo with walnuts and pistachios, drizzled with honey syrup", price: 12.00, category: "Desserts", calories: 380, protein: 6, carbs: 46, fat: 20 }
    ]
  },

  // ==================== AMERICAN (3) ====================
  {
    name: "Jacob's Pickles",
    address: "680 Columbus Ave, New York, NY 10025",
    neighborhood: "Upper West Side",
    lat: 40.7915,
    lng: -73.9695,
    cuisine: ["American", "Southern"],
    price: 2,
    rating: 4.4,
    phone: "(212) 470-5566",
    website: "https://www.jacobspickles.com",
    dishes: [
      { name: "Buttermilk Biscuit Sandwich", description: "Flaky biscuit with fried chicken, honey butter, and house pickles", price: 16.00, category: "Sandwiches", calories: 620, protein: 28, carbs: 52, fat: 34 },
      { name: "Low Country Meatloaf", description: "Smoked meatloaf with mashed potatoes, gravy, and seasonal vegetables", price: 22.00, category: "Entrees", calories: 680, protein: 32, carbs: 42, fat: 40 },
      { name: "Shrimp and Grits", description: "Sauteed shrimp with creamy cheddar grits, bacon, and scallion", price: 24.00, category: "Entrees", calories: 580, protein: 34, carbs: 38, fat: 32 },
      { name: "Catfish Tacos", description: "Beer-battered catfish with slaw, pickled onions, and remoulade", price: 18.00, category: "Entrees", calories: 480, protein: 24, carbs: 42, fat: 22 },
      { name: "Mac and Cheese", description: "Baked four-cheese macaroni with breadcrumb crust", price: 14.00, category: "Sides", calories: 520, protein: 18, carbs: 48, fat: 28 },
      { name: "Sausage Gravy Biscuit", description: "Split biscuit smothered in house-made sausage gravy", price: 14.00, category: "Brunch", calories: 560, protein: 20, carbs: 44, fat: 34 },
      { name: "Pickle Plate", description: "Seasonal house-made pickles and fermented vegetables", price: 10.00, category: "Appetizers", calories: 60, protein: 2, carbs: 12, fat: 0 }
    ]
  },
  {
    name: "The Smith",
    address: "956 2nd Ave, New York, NY 10022",
    neighborhood: "Midtown East",
    lat: 40.7565,
    lng: -73.9656,
    cuisine: ["American", "New American"],
    price: 3,
    rating: 4.2,
    phone: "(212) 644-2700",
    website: "https://thesmithrestaurant.com",
    dishes: [
      { name: "The Smith Burger", description: "Dry-aged beef burger with cheddar, caramelized onions, and special sauce on brioche", price: 22.00, category: "Entrees", calories: 780, protein: 42, carbs: 46, fat: 46 },
      { name: "Kale and Quinoa Salad", description: "Tuscan kale with quinoa, dried cranberries, almonds, and lemon vinaigrette", price: 18.00, category: "Salads", calories: 380, protein: 12, carbs: 42, fat: 20 },
      { name: "Pan-Roasted Branzino", description: "Mediterranean sea bass with roasted vegetables and salsa verde", price: 34.00, category: "Entrees", calories: 420, protein: 38, carbs: 14, fat: 24 },
      { name: "Pot of Mussels", description: "Prince Edward Island mussels in white wine, garlic, and herbs with grilled bread", price: 22.00, category: "Appetizers", calories: 380, protein: 28, carbs: 22, fat: 16 },
      { name: "Truffle Fries", description: "Hand-cut fries with truffle oil, parmesan, and herbs", price: 14.00, category: "Sides", calories: 420, protein: 8, carbs: 48, fat: 24 },
      { name: "Pan-Roasted Chicken", description: "Half roasted chicken with whipped potatoes and seasonal vegetables", price: 28.00, category: "Entrees", calories: 620, protein: 44, carbs: 32, fat: 34 }
    ]
  },
  {
    name: "Westville",
    address: "333 Hudson St, New York, NY 10013",
    neighborhood: "West Village",
    lat: 40.7275,
    lng: -74.0079,
    cuisine: ["American"],
    price: 2,
    rating: 4.3,
    phone: "(212) 776-1404",
    website: "https://westville.com",
    dishes: [
      { name: "Market Plate", description: "Choice of protein with three seasonal vegetable sides from the daily market board", price: 18.00, category: "Entrees", calories: 480, protein: 32, carbs: 36, fat: 20 },
      { name: "Westville Burger", description: "Grass-fed beef burger with lettuce, tomato, and special sauce on a brioche bun", price: 16.00, category: "Sandwiches", calories: 640, protein: 34, carbs: 42, fat: 36 },
      { name: "Grilled Salmon", description: "Atlantic salmon fillet with seasonal vegetables and herb sauce", price: 22.00, category: "Entrees", calories: 420, protein: 36, carbs: 14, fat: 24 },
      { name: "Kale Caesar Salad", description: "Tuscan kale with anchovy dressing, croutons, and shaved parmesan", price: 14.00, category: "Salads", calories: 320, protein: 12, carbs: 24, fat: 20 },
      { name: "Sweet Potato Fries", description: "Crispy sweet potato fries with chipotle aioli", price: 8.00, category: "Sides", calories: 340, protein: 4, carbs: 48, fat: 16 },
      { name: "Roasted Cauliflower Steak", description: "Whole roasted cauliflower with tahini, pomegranate, and herbs", price: 16.00, category: "Entrees", calories: 280, protein: 8, carbs: 28, fat: 18 }
    ]
  },

  // ==================== VIETNAMESE (2) ====================
  {
    name: "Hanoi House",
    address: "119 St Marks Pl, New York, NY 10009",
    neighborhood: "East Village",
    lat: 40.7279,
    lng: -73.9837,
    cuisine: ["Vietnamese"],
    price: 2,
    rating: 4.4,
    phone: "(212) 995-5010",
    website: "https://www.hanoihousenyc.com",
    dishes: [
      { name: "Special Pho", description: "Hanoi-style beef pho with rare filet mignon, oxtail, brisket, bone marrow, and breadstick", price: 28.00, category: "Soups", calories: 580, protein: 42, carbs: 52, fat: 20 },
      { name: "Summer Rolls", description: "Fresh rice paper rolls with pork sausage, shrimp, herbs, and peanut sauce", price: 14.00, category: "Appetizers", calories: 240, protein: 14, carbs: 26, fat: 8 },
      { name: "Braised Beef Banh Mi", description: "Braised short rib on baguette with pickled daikon, cilantro, and jalapeno", price: 18.00, category: "Sandwiches", calories: 520, protein: 30, carbs: 48, fat: 22 },
      { name: "Bun Cha", description: "Grilled pork patties and belly with rice vermicelli, herbs, and dipping sauce", price: 22.00, category: "Entrees", calories: 480, protein: 28, carbs: 48, fat: 18 },
      { name: "Turmeric Fish", description: "Pan-seared turmeric-marinated fish with dill, scallion, and rice noodles", price: 24.00, category: "Entrees", calories: 420, protein: 32, carbs: 38, fat: 16 },
      { name: "Coconut Coffee Panna Cotta", description: "Vietnamese coffee-flavored panna cotta with coconut cream", price: 12.00, category: "Desserts", calories: 320, protein: 4, carbs: 36, fat: 18 }
    ]
  },
  {
    name: "Saigon Shack",
    address: "114 Macdougal St, New York, NY 10012",
    neighborhood: "Greenwich Village",
    lat: 40.7293,
    lng: -73.9997,
    cuisine: ["Vietnamese"],
    price: 1,
    rating: 4.2,
    phone: "(212) 228-0588",
    website: "https://www.saigonshack.com",
    dishes: [
      { name: "Saigon Pho", description: "Traditional beef pho with rice noodles, rare steak, brisket, herbs, and bean sprouts", price: 14.00, category: "Soups", calories: 480, protein: 30, carbs: 52, fat: 14 },
      { name: "Banh Mi Dac Biet", description: "Classic Vietnamese sandwich with pate, ham, pork roll, pickled vegetables, and jalapeno", price: 10.00, category: "Sandwiches", calories: 440, protein: 22, carbs: 44, fat: 20 },
      { name: "Summer Rolls", description: "Fresh rice paper rolls with shrimp, pork, vermicelli, and peanut hoisin sauce", price: 8.00, category: "Appetizers", calories: 200, protein: 10, carbs: 24, fat: 6 },
      { name: "Bun Bo Hue", description: "Spicy beef and pork noodle soup with lemongrass and chili oil", price: 14.00, category: "Soups", calories: 520, protein: 32, carbs: 48, fat: 20 },
      { name: "Lemongrass Chicken", description: "Grilled lemongrass chicken over broken rice with fried egg and pickles", price: 13.00, category: "Entrees", calories: 540, protein: 34, carbs: 56, fat: 16 },
      { name: "Vietnamese Iced Coffee", description: "Strong drip coffee with sweetened condensed milk over ice", price: 5.00, category: "Beverages", calories: 180, protein: 4, carbs: 28, fat: 6 }
    ]
  }
];

// Total: 28 restaurants across 10 cuisine types
// Thai: 4 (Somtum Der, Soothr, Fish Cheeks, Thai Diner)
// Japanese: 4 (Sushi Yasuda, Sushi Nakazawa, Raku, Katsu-Hama)
// Italian: 3 (L'Artusi, Via Carota, Don Angie)
// Mexican: 3 (Los Tacos No. 1, La Contenta, El Camion Cantina)
// Indian: 3 (Adda, Dhaba, Panna II)
// Chinese: 3 (Nom Wah Tea Parlor, Jing Fong, Xi'an Famous Foods)
// Korean: 3 (Baekjeong NYC, Her Name Is Han, Osamil)
// Mediterranean: 2 (Barbounia, Zaytinya)
// American: 3 (Jacob's Pickles, The Smith, Westville)
// Vietnamese: 2 (Hanoi House, Saigon Shack)
