# Dish Quality Audit

**Date:** 2026-04-03  
**Auditor:** FoodClaw Quality Bot  
**Database:** nutriscout (localhost:5433)

## Summary

| Metric | Count |
|--------|-------|
| Total dishes scanned | 3479 |
| **Category A (delete)** | **158** |
| **Category B (fix name)** | **246** |
| **Category C (suspicious)** | **3** |
| Clean | 3072 |

### Critical Findings

1. **SEO Spam Injection (5 items):** Mei Lai Wah has 5 gambling spam entries (RAJAJUDI88, SLOT GACOR) injected as dishes under a fake category. These are likely from a compromised menu source and should be investigated.

2. **Hotel Perks Scraped as Food (9 items):** Kimpton Hotel Eventi has 9 loyalty program benefits ("Complimentary WiFi", "$30 Spa Credit") stored as dishes. The scraper likely ingested a hotel benefits page.

3. **Blog/CMS Sidebar Artifacts (22 items):** Shu Jiao Fu Zhou has 22 entries from a blog sidebar -- archive months ("April 2026", "August 2025"), categories ("Cafe", "Restaurants"), recent comments, and recent posts. The scraper captured the entire page including navigation/sidebar.

4. **Wine List Parsing Failure (~219 items):** Lafayette Grand Cafe & Bakery has ~219 wine entries where the dish name starts with a wine-list reference number (e.g., "5110 | Jean Foillard Fleurie 2022"). The numbers should be stripped.

5. **HTML Artifact (1 item):** Ellen's Stardust Diner has a literal `<br>` tag stored as a dish name.

6. **Basic Drinks, Sides, and Condiments (~60 items):** Items like "Soda", "Fries", "Hot Tea", "Dipping Sauce", "Salt" are not appropriate for a food discovery app.

7. **Duplicate Dishes (~16 items):** Several restaurants have exact duplicate dish entries (LOS TACOS No.1 has the most with ~12 duplicates, likely from multiple menu sources).

---

## Category A -- Remove These

These are not real dishes and should be deleted from the database.

| ID | Name | Restaurant | Reason |
|----|------|------------|--------|
| `08a643d5...` | Kimchi | BCD Tofu House | Banchan (free Korean side) |
| `05e8a066...` | Marinated Radish | BCD Tofu House | Banchan (free Korean side) |
| `80952851...` | Steamed Broccoli | BCD Tofu House | Banchan (free Korean side) |
| `0c70ac39...` | Bean Sprouts | Jongro BBQ | Banchan (free Korean side) |
| `a8df05a8...` | Kimchi | Jongro BBQ | Banchan (free Korean side) |
| `77109229...` | Kimchi | NUBIANI - Koreatown | Banchan (free Korean side) |
| `3db876be...` | Bottle Water | Adel's Famous Halal Food | Basic drink |
| `57079c9b...` | Can Soda | Adel's Famous Halal Food | Basic drink |
| `f740e1ac...` | Snapple | Adel's Famous Halal Food | Basic drink |
| `31536748...` | Hot Tea | BCD Tofu House | Basic drink |
| `91c85161...` | Soda | Bleecker Street Pizza | Basic drink |
| `3e4938b6...` | Vitamin Water | Bleecker Street Pizza | Basic drink |
| `5a5f9e18...` | Arnold Palmer | Café Chelsea | Basic drink |
| `d29c9b70...` | Bottled Water | Ellen's Stardust Diner | Basic drink |
| `cc76a323...` | Chocolate Milk | Ellen's Stardust Diner | Basic drink |
| `d8af8fd5...` | Hot Chocolate | Ellen's Stardust Diner | Basic drink |
| `09442248...` | Juice | Ellen's Stardust Diner | Basic drink |
| `a1fd0519...` | Soda | Ellen's Stardust Diner | Basic drink |
| `f9cd30e6...` | Soda | Golden Unicorn | Basic drink |
| `c088fc91...` | Soda | ICHIRAN Ramen NY Times Square | Basic drink |
| `54fe82d2...` | Soda | Ichiran | Basic drink |
| `1a05216b...` | Soda | Kiki's | Basic drink |
| `1d0da0fb...` | Water | LOS TACOS No.1 | Basic drink |
| `8ff8eca1...` | Water | LOS TACOS No.1 | Basic drink |
| `367004d7...` | Hot Chocolate | Lafayette Grand Café & Bakery | Basic drink |
| `f52855e8...` | Arnold Palmer | Little Ruby's West Village | Basic drink |
| `f005c191...` | Drip Coffee | Little Ruby's West Village | Basic drink |
| `a6f048e3...` | Hot Chocolate | Little Ruby's West Village | Basic drink |
| `5c0200ec...` | Iced Tea | Little Ruby's West Village | Basic drink |
| `5fc3b15b...` | Lemonade | PLANTA New York | Basic drink |
| `6756e455...` | Fountain Drink | Raising Cane's Chicken Fingers | Basic drink |
| `6aa1e74a...` | Lemonade | Raising Cane's Chicken Fingers | Basic drink |
| `ddf49e98...` | Sweet Tea | Raising Cane's Chicken Fingers | Basic drink |
| `a49bec87...` | Unsweet Tea | Raising Cane's Chicken Fingers | Basic drink |
| `fc9a0fb9...` | Tea | Rubirosa | Basic drink |
| `3e230e2a...` | Diet Coke | Scarr's Pizza | Basic drink |
| `5274a670...` | Sparkling Water | Scarr's Pizza | Basic drink |
| `da7f8fdf...` | Arnold Palmer | The Grey Dog - Flatiron | Basic drink |
| `bd196d5c...` | Hot Chocolate | The Grey Dog - Flatiron | Basic drink |
| `ab1510fd...` | Lemonade | The Grey Dog - Flatiron | Basic drink |
| `c79bca77...` | Orange Juice | The Grey Dog - Flatiron | Basic drink |
| `386968ec...` | Coffee | The Smith | Basic drink |
| `b5b9a6b5...` | Hot Chocolate | The Smith | Basic drink |
| `6140a315...` | April 2026 | Jin Mei Dumpling | Blog/CMS artifact (Archives), not food |
| `f18624ea...` | August 2025 | Jin Mei Dumpling | Blog/CMS artifact (Archives), not food |
| `b21365f9...` | February 2026 | Jin Mei Dumpling | Blog/CMS artifact (Archives), not food |
| `d3ea22d1...` | January 2026 | Jin Mei Dumpling | Blog/CMS artifact (Archives), not food |
| `efbbd7d2...` | July 2025 | Jin Mei Dumpling | Blog/CMS artifact (Archives), not food |
| `bd84a4ea...` | June 2025 | Jin Mei Dumpling | Blog/CMS artifact (Archives), not food |
| `37602f11...` | March 2026 | Jin Mei Dumpling | Blog/CMS artifact (Archives), not food |
| `b30513ac...` | November 2025 | Jin Mei Dumpling | Blog/CMS artifact (Archives), not food |
| `9c5da72e...` | September 2025 | Jin Mei Dumpling | Blog/CMS artifact (Archives), not food |
| `ab62fd33...` | April 2026 | Shu Jiao Fu Zhou | Blog/CMS artifact (Archives), not food |
| `16663f7e...` | August 2025 | Shu Jiao Fu Zhou | Blog/CMS artifact (Archives), not food |
| `820e3c17...` | February 2026 | Shu Jiao Fu Zhou | Blog/CMS artifact (Archives), not food |
| `891fc1bb...` | January 2026 | Shu Jiao Fu Zhou | Blog/CMS artifact (Archives), not food |
| `95aca4ed...` | July 2025 | Shu Jiao Fu Zhou | Blog/CMS artifact (Archives), not food |
| `6e5be3b2...` | June 2025 | Shu Jiao Fu Zhou | Blog/CMS artifact (Archives), not food |
| `ed25caec...` | March 2026 | Shu Jiao Fu Zhou | Blog/CMS artifact (Archives), not food |
| `837e6b53...` | November 2025 | Shu Jiao Fu Zhou | Blog/CMS artifact (Archives), not food |
| `1dc99619...` | September 2025 | Shu Jiao Fu Zhou | Blog/CMS artifact (Archives), not food |
| `376b06e6...` | Cafe | Jin Mei Dumpling | Blog/CMS artifact (Categories), not food |
| `0a121432...` | My Pick | Jin Mei Dumpling | Blog/CMS artifact (Categories), not food |
| `f6709bd7...` | Repair | Jin Mei Dumpling | Blog/CMS artifact (Categories), not food |
| `9594d923...` | Restaurants | Jin Mei Dumpling | Blog/CMS artifact (Categories), not food |
| `d4353bd0...` | Shop | Jin Mei Dumpling | Blog/CMS artifact (Categories), not food |
| `de19278a...` | Shopping Mall | Jin Mei Dumpling | Blog/CMS artifact (Categories), not food |
| `770f1102...` | Cafe | Shu Jiao Fu Zhou | Blog/CMS artifact (Categories), not food |
| `89671884...` | My Pick | Shu Jiao Fu Zhou | Blog/CMS artifact (Categories), not food |
| `ab403d43...` | Repair | Shu Jiao Fu Zhou | Blog/CMS artifact (Categories), not food |
| `f80a9cde...` | Restaurants | Shu Jiao Fu Zhou | Blog/CMS artifact (Categories), not food |
| `b1a18a77...` | Shop | Shu Jiao Fu Zhou | Blog/CMS artifact (Categories), not food |
| `69755327...` | Shopping Mall | Shu Jiao Fu Zhou | Blog/CMS artifact (Categories), not food |
| `18dc2736...` | Gina on Kim Nhung Superfood | Jin Mei Dumpling | Blog/CMS artifact (Recent Comments), not food |
| `f98e20b3...` | Kevin on Herrell's Market - Imperial, MO | Jin Mei Dumpling | Blog/CMS artifact (Recent Comments), not food |
| `4dde6ba1...` | Gina on Kim Nhung Superfood | Shu Jiao Fu Zhou | Blog/CMS artifact (Recent Comments), not food |
| `4641ac82...` | Kevin on Herrell's Market - Imperial, MO | Shu Jiao Fu Zhou | Blog/CMS artifact (Recent Comments), not food |
| `4ddc1cc9...` | Good Truckin' Diner | Jin Mei Dumpling | Blog/CMS artifact (Recent Posts), not food |
| `bc09516a...` | New Hartford Diner | Jin Mei Dumpling | Blog/CMS artifact (Recent Posts), not food |
| `7be62df9...` | Rizos Cafe | Jin Mei Dumpling | Blog/CMS artifact (Recent Posts), not food |
| `4e926e9e...` | The Cottage Lounge | Jin Mei Dumpling | Blog/CMS artifact (Recent Posts), not food |
| `40f4e428...` | The Longfellow Bar | Jin Mei Dumpling | Blog/CMS artifact (Recent Posts), not food |
| `daccd3b1...` | Good Truckin' Diner | Shu Jiao Fu Zhou | Blog/CMS artifact (Recent Posts), not food |
| `1ecda52b...` | New Hartford Diner | Shu Jiao Fu Zhou | Blog/CMS artifact (Recent Posts), not food |
| `0d2a4ccd...` | Rizos Cafe | Shu Jiao Fu Zhou | Blog/CMS artifact (Recent Posts), not food |
| `55942480...` | The Cottage Lounge | Shu Jiao Fu Zhou | Blog/CMS artifact (Recent Posts), not food |
| `57e5fc26...` | The Longfellow Bar | Shu Jiao Fu Zhou | Blog/CMS artifact (Recent Posts), not food |
| `10249316...` | Affordability: Most meals cost under $10 | Shu Jiao Fu Zhou | Blog/CMS artifact (Why People Love Shu Jiao Fu Zhou), not food |
| `4cd04824...` | Authenticity: True Fujianese flavors that remind many of home | Shu Jiao Fu Zhou | Blog/CMS artifact (Why People Love Shu Jiao Fu Zhou), not food |
| `06d65996...` | Frozen Dumplings: Customers can take home frozen packs for later | Shu Jiao Fu Zhou | Blog/CMS artifact (Why People Love Shu Jiao Fu Zhou), not food |
| `20b76c22...` | Signature Dishes: Pork & Chive Dumplings and Peanut Butter Noodle | Shu Jiao Fu Zhou | Blog/CMS artifact (Why People Love Shu Jiao Fu Zhou), not food |
| `9092d4b6...` | Speed: Food is typically served within 5 minutes | Shu Jiao Fu Zhou | Blog/CMS artifact (Why People Love Shu Jiao Fu Zhou), not food |
| `d4dacf8b...` | Spicy Dipping Sauce | BCD Tofu House | Condiment |
| `781ece09...` | Salt | COTE Flatiron | Condiment |
| `836f1d30...` | Spicy Dipping Sauce | COTE Flatiron | Condiment |
| `eb740fd2...` | Dipping Sauce | Jongro BBQ | Condiment |
| `d9dfa426...` | Green Dipping Paste | NUBIANI - Koreatown | Condiment |
| `0b49e296...` | Red Dipping Sauce (Ssamjang) | NUBIANI - Koreatown | Condiment |
| `1829236b...` | Sea Salt | NUBIANI - Koreatown | Condiment |
| `6f9df879...` | Add Ons | Adel's Famous Halal Food | Generic menu label, not a dish |
| `795de9a2...` | Add Ons | Ellen's Stardust Diner | Generic menu label, not a dish |
| `da9f1ce8...` | Sides | Ellen's Stardust Diner | Generic menu label, not a dish |
| `3c0e0234...` | Sides | Isla & Co. - Midtown | Generic menu label, not a dish |
| `b44a3e8e...` | Add Ons | Little Ruby's West Village | Generic menu label, not a dish |
| `c4c96d51...` | Sides | Little Ruby's West Village | Generic menu label, not a dish |
| `bd0722c3...` | <br> | Ellen's Stardust Diner | HTML artifact |
| `bd1501e0...` | $30 Spa Credit for Members at Participating Hotels | Kimpton Hotel Eventi | Hotel perk, not food |
| `a5ee70c9...` | Access to discounts on room upgrades | Kimpton Hotel Eventi | Hotel perk, not food |
| `d8259c1b...` | Access to early check-in and late checkout | Kimpton Hotel Eventi | Hotel perk, not food |
| `dc517b6c...` | Access to more flexible cancellation policies | Kimpton Hotel Eventi | Hotel perk, not food |
| `6d29e8cf...` | Complimentary WiFi for members | Kimpton Hotel Eventi | Hotel perk, not food |
| `4c7b1023...` | Custom stay preferences | Kimpton Hotel Eventi | Hotel perk, not food |
| `3d1189f8...` | Earn credit towards reward nights | Kimpton Hotel Eventi | Hotel perk, not food |
| `671e7cb5...` | Exclusive rewards member rates | Kimpton Hotel Eventi | Hotel perk, not food |
| `ffd2f6c1...` | Guaranteed best rates when you book on our website | Kimpton Hotel Eventi | Hotel perk, not food |
| `5369f68d...` | Add Napkins & Utensils | Bleecker Street Pizza | Non-food item |
| `208aa48e...` | Fries | Adel's Famous Halal Food | Plain side |
| `6e624297...` | Steamed White Rice | BCD Tofu House | Plain side |
| `9477d0e6...` | French Fries | Coppelia | Plain side |
| `d529da90...` | Mashed Potatoes | Coppelia | Plain side |
| `2a5caec3...` | White Rice | ICHIRAN Ramen NY Times Square | Plain side |
| `40864255...` | White Rice | Ichiran | Plain side |
| `f44d8192...` | Steamed White Rice | Jongro BBQ | Plain side |
| `e9df3eec...` | French Fries | Minetta Tavern | Plain side |
| `f4f903a9...` | Tater Tots | PLANTA New York | Plain side |
| `8616b178...` | Coleslaw | Raising Cane's Chicken Fingers | Plain side |
| `3aa1f449...` | French Fries | Slate | Plain side |
| `26782134...` | French Fries | The Grey Dog - Flatiron | Plain side |
| `fe761d76...` | Mashed Potatoes | The Grey Dog - Flatiron | Plain side |
| `484329b7...` | Fries | The Smith | Plain side |
| `25512a64...` | French Fries | The Spaniard | Plain side |
| `ea567bc9...` | Onion Rings | The Spaniard | Plain side |
| `a7891b5c...` | Steamed White Rice | Uncle Lou 快樂人 | Plain side |
| `e3ac2e3e...` | 16 Each | Ellen's Stardust Diner | Price label, not a dish |
| `8f54c22d...` | 22 Each | Ellen's Stardust Diner | Price label, not a dish |
| `6edd3c3f...` | $2 Off All Drafts | The Spaniard | Promotional text, not a dish |
| `546f0735...` | FEATURED POUR (1oz) - Each week we feature a different spirit wit | The Spaniard | Promotional text, not a dish |
| `a59feb19...` | Banjir Scatter Gates Of Olympus | Mei Lai Wah | SEO spam/gambling injection |
| `109ed76e...` | Fitur Terbaik yang dapat bermain nikmati permainan lebih menguntu | Mei Lai Wah | SEO spam/gambling injection |
| `e52d5573...` | Hasil Rtp Live 100% Winrate | Mei Lai Wah | SEO spam/gambling injection |
| `908ed59f...` | SLOT GACOR Online Terpercaya Terbaru 2026 | Mei Lai Wah | SEO spam/gambling injection |
| `ab13c993...` | Situs RAJAJUDI88 JP Menyediakan Promo | Mei Lai Wah | SEO spam/gambling injection |
| `b89dfec6...` | Extra Chashu (4 Slices) | ICHIRAN Ramen NY Times Square | Side/add-on modifier |
| `704702dc...` | Extra Garlic (2 cloves) | ICHIRAN Ramen NY Times Square | Side/add-on modifier |
| `9045daaa...` | Extra Scallion | ICHIRAN Ramen NY Times Square | Side/add-on modifier |
| `84afe832...` | Extra Chashu (4 Slices) | Ichiran | Side/add-on modifier |
| `724cca4d...` | Extra Garlic (2 cloves) | Ichiran | Side/add-on modifier |
| `6051c047...` | Extra Scallion | Ichiran | Side/add-on modifier |
| `0eced7cc...` | Extra Pita | Kiki's | Side/add-on modifier |
| `f1fcae20...` | Side of Cucumbers | Kiki's | Side/add-on modifier |
| `947f2549...` | Side of Olives | Kiki's | Side/add-on modifier |
| `ff3fa562...` | Add Cheese | Rubirosa | Side/add-on modifier |
| `b26a2b69...` | Add Meat | Rubirosa | Side/add-on modifier |
| `ac646e1b...` | Add Vegetable | Rubirosa | Side/add-on modifier |
| `37d5a3fe...` | Add a Shot of Booze | The Grey Dog - Flatiron | Side/add-on modifier |
| `eb31de66...` | Add chicken, crispy tofu | The Grey Dog - Flatiron | Side/add-on modifier |
| `b7a8ca7b...` | Add grilled shrimp | The Grey Dog - Flatiron | Side/add-on modifier |
| `d9cef86c...` | Add seared salmon | The Grey Dog - Flatiron | Side/add-on modifier |

---

## Category B -- Fix Name

These are real (or potentially real) items but have names that need correction.

| ID | Current Name | Restaurant | Suggested Fix |
|----|-------------|------------|---------------|
| `f0a69ecf...` | 16 oz Dry Aged Bone-In NY Strip | Café Chelsea | Starts with portion size; consider removing |
| `429f536b...` | Milan Nestarec 'Forks & Knives' Blaufränkisch Blend, Morovia | Chinese Tuxedo | Name too long (81 chars); likely marketing copy |
| `470a9440...` | Ruth Lewandowski 'Stock Pot' Grüner Veltliner, Russian River | Chinese Tuxedo | Name too long (84 chars); likely marketing copy |
| `97880c27...` | Classic | Dante West Village | Too vague alone; needs qualifier |
| `d169ae32...` | Black Cocoa Tiramisu | Don Angie | Duplicate of 'Black Cocoa Tiramisu' (keep b5aabaa9...) |
| `43f9211e...` | Chrysanthemum Salad | Don Angie | Duplicate of 'Chrysanthemum Salad' (keep 90601265...) |
| `59b452cb...` | Olive Oil Cake | L'Artusi | Duplicate of 'Olive Oil Cake' (keep d942e192...) |
| `a9304b44...` | Adobada | LOS TACOS No.1 | Duplicate of 'Adobada' (keep fe589a1a...) |
| `b25082c5...` | Aguas Frescas | LOS TACOS No.1 | Duplicate of 'Aguas Frescas' (keep ab992338...) |
| `a1dfa3e8...` | Bottled Sodas | LOS TACOS No.1 | Duplicate of 'Bottled Sodas' (keep 369bed60...) |
| `786d6bb4...` | Carne Asada | LOS TACOS No.1 | Duplicate of 'Carne Asada' (keep dbd64778...) |
| `39da8d83...` | Chips y Guacamole | LOS TACOS No.1 | Duplicate of 'Chips y Guacamole' (keep 5b7cb7d0...) |
| `d0d399d3...` | Chips y Salsa | LOS TACOS No.1 | Duplicate of 'Chips y Salsa' (keep fa807bf3...) |
| `4b9fc5cb...` | Especial | LOS TACOS No.1 | Duplicate of 'Especial' (keep 8876ddc2...) |
| `4711c3ba...` | Mexican Sodas | LOS TACOS No.1 | Duplicate of 'Mexican Sodas' (keep 3b533229...) |
| `50d3cd96...` | Nopal | LOS TACOS No.1 | Duplicate of 'Nopal' (keep 21983ece...) |
| `96f5914c...` | Nopal Plate | LOS TACOS No.1 | Duplicate of 'Nopal Plate' (keep 87639bbe...) |
| `83149b1f...` | Pollo Asado | LOS TACOS No.1 | Duplicate of 'Pollo Asado' (keep d2d7f00b...) |
| `8a250987...` | 1924 Bleu | Lafayette Grand Café & Bakery | Remove wine list # -> 'Bleu' |
| `d5985c09...` | 3002 / Sauvignon Blanc / Foucher LeBrun Sancerre 'Le Mont' 2 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Sauvignon Blanc | Foucher LeBrun Sancerre 'Le Mont' |
| `2ab08e46...` | 3004 / Domaine Guiberteau Saumur 2021 / Loire | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Guiberteau Saumur 2021 | Loire' |
| `9b5dfe9f...` | 3026 / Domaine Moreau-Naudet Chablis 1er Cru 'Montmains' 202 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Moreau-Naudet Chablis 1er Cru 'Montmains' ' |
| `3cbb8155...` | 3032 / Chenin / Domaine l'Ecu Vin de France 'Matris' 2018 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Chenin | Domaine l'Ecu Vin de France 'Matris' 2018' |
| `d2b31ef0...` | 3039 / Melon B. / Landron Sèvre & Maine 'Fief Breil' 2018 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Melon B. | Landron Sèvre & Maine 'Fief Breil' 2018' |
| `f91cea60...` | 3040 / Joseph Drouhin Vaudon Chablis 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Joseph Drouhin Vaudon Chablis 2022' |
| `208bebcb...` | 3044 / Château Peyrassol 'Cuvee De Commandeurs' 2023 / Prove | Lafayette Grand Café & Bakery | Remove wine list # -> 'Château Peyrassol 'Cuvee De Commandeurs' 2023 | Pr' |
| `030e48d3...` | 3046 / Gilbert Picq Chablis Vosgros 1er Cru 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Gilbert Picq Chablis Vosgros 1er Cru 2021' |
| `5ec4f792...` | 3047 / Domaine Daniel Crochet Sancerre 2023 / Loire | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Daniel Crochet Sancerre 2023 | Loire' |
| `6ecf7209...` | 3050 / Domaine De Villaine Bouzeron Aligoté 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine De Villaine Bouzeron Aligoté 2021' |
| `98b92b04...` | 3068 / Dominique Lafon Bourgogne Blanc 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Dominique Lafon Bourgogne Blanc 2022' |
| `9114cd18...` | 3077 / Sauvignon Blanc / C & F Berthier Coteaux du Giennois  | Lafayette Grand Café & Bakery | Remove wine list # -> 'Sauvignon Blanc | C & F Berthier Coteaux du Gienno' |
| `0f122dfd...` | 3088 / Château Le Puy Rose-Marie VdF 2022 / Bordeaux | Lafayette Grand Café & Bakery | Remove wine list # -> 'Château Le Puy Rose-Marie VdF 2022 | Bordeaux' |
| `0b4ad3d9...` | 3089 / Petit Manseng / Dagueneau Jardins De Babylone Sec VdF | Lafayette Grand Café & Bakery | Remove wine list # -> 'Petit Manseng | Dagueneau Jardins De Babylone Sec ' |
| `8dd692f2...` | 3103 / Domaine Bachelet Monnot Chassagne Montrachet 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Bachelet Monnot Chassagne Montrachet 2022' |
| `807536ec...` | 3104 / Moreau-Naudet Chablis 'Pargues' V.V. / Magnum, 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Moreau-Naudet Chablis 'Pargues' V.V. | Magnum, 202' |
| `45ce582e...` | 3105 / Riesling / Trimbach Frederic Emile 2015 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Riesling | Trimbach Frederic Emile 2015' |
| `cc4247ed...` | 3112 / Pinot Blanc+ / Domaine Marcel Deiss 'Complantation' 2 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Pinot Blanc+ | Domaine Marcel Deiss 'Complantation' |
| `a456cdad...` | 3120 / Marsanne / Domaine A. Clape St. Peray Blanc 2021 / Rh | Lafayette Grand Café & Bakery | Remove wine list # -> 'Marsanne | Domaine A. Clape St. Peray Blanc 2021 |' |
| `f78448c1...` | 3140 / Chenin / Domaine du Closel Savennieres 'La Jalousie'  | Lafayette Grand Café & Bakery | Remove wine list # -> 'Chenin | Domaine du Closel Savennieres 'La Jalousi' |
| `4ac24928...` | 3158 / Melon B. / Domaine L'Ecu Sevre & Maine 'Classic' '202 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Melon B. | Domaine L'Ecu Sevre & Maine 'Classic' '' |
| `b3d05c42...` | 3161 / J & P Droin Chablis Grand Cru 'Grenouilles' '20 | Lafayette Grand Café & Bakery | Remove wine list # -> 'J & P Droin Chablis Grand Cru 'Grenouilles' '20' |
| `563e3833...` | 3163 / Chardonnay / Domaine Pelican Arbois 2018 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Chardonnay | Domaine Pelican Arbois 2018' |
| `47850610...` | 3180 / Chenin / Thibaud Boudignon Anjou 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Chenin | Thibaud Boudignon Anjou 2020' |
| `4f4e2c3e...` | 3183 / Sauvignon Blanc / Didier Dagueneau Blanc Etc VdF 2019 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Sauvignon Blanc | Didier Dagueneau Blanc Etc VdF 2' |
| `60194bec...` | 3186 / Sylvaner / Domaine Ostertag Vieilles Vignes 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Sylvaner | Domaine Ostertag Vieilles Vignes 2022' |
| `fb5c303e...` | 3197 / Domaine Chantereves Bourgogne Aligoté 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Chantereves Bourgogne Aligoté 2020' |
| `0b82dc5f...` | 3204 Riesling / Domaine Ostertag Fronholz 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Riesling | Domaine Ostertag Fronholz 2020' |
| `fc32a0da...` | 3205 Gewurtztraminer / Weinbach Altenbourg Grand Cru 2011 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Gewurtztraminer | Weinbach Altenbourg Grand Cru 20' |
| `83b30380...` | 3208 / Chenin / Arnaud Lambert Saumur Breze 'Clos Midi' 2023 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Chenin | Arnaud Lambert Saumur Breze 'Clos Midi' 2' |
| `2a632afc...` | 3209 / Gilbert Picq Chablis 'Dessus la Carrière' 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Gilbert Picq Chablis 'Dessus la Carrière' 2022' |
| `431e87fd...` | 3210 / Domaine Roulot Bourgogne Aligoté 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Roulot Bourgogne Aligoté 2021' |
| `c8c91bd1...` | 3211 / Chardonnay / Ganevat 'Grand Teppes V.V.' 2010 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Chardonnay | Ganevat 'Grand Teppes V.V.' 2010' |
| `3f4ca93e...` | 3213 / Chardonnay / Ganevat 'Grand Teppes V.V.' 2011 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Chardonnay | Ganevat 'Grand Teppes V.V.' 2011' |
| `4f07639d...` | 3214 / Savagnin / Ganevat 'Les Grand Teppes VV' 2013 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Savagnin | Ganevat 'Les Grand Teppes VV' 2013' |
| `246f73d2...` | 3217 / Pinot Blanc / Kreydenweiss 'La Fontaine aux Enfants'  | Lafayette Grand Café & Bakery | Remove wine list # -> 'Pinot Blanc | Kreydenweiss 'La Fontaine aux Enfant' |
| `380c0275...` | 3220 / Domaine Marquis d'Angerville Bourgogne Blanc 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Marquis d'Angerville Bourgogne Blanc 2022' |
| `f1a44c5d...` | 3224 / C. Blanc / Bouche du Roi 'Grand Lever' 2023 / Île de  | Lafayette Grand Café & Bakery | Remove wine list # -> 'C. Blanc | Bouche du Roi 'Grand Lever' 2023 | Île ' |
| `73fcfe57...` | 3230 / Pinot Gris / Domaine Weinbach Altenbourg Grand Cru 20 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Pinot Gris | Domaine Weinbach Altenbourg Grand Cru' |
| `1be340a7...` | 3231 / Domaine de Cassiopée Maranges 'Les Plantes' 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine de Cassiopée Maranges 'Les Plantes' 2022' |
| `d20b8162...` | 3261 / Domaine Juillot Bourgogne Blanc 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Juillot Bourgogne Blanc 2020' |
| `5b455113...` | 3263 / Chenin / Domaine Guiberteau Saumur Blanc 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Chenin | Domaine Guiberteau Saumur Blanc 2021' |
| `329b8587...` | 3266 / Domaine Marquis D'Angerville Bourgogne Blanc 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Marquis D'Angerville Bourgogne Blanc 2020' |
| `ea7f2b64...` | 3267 / Domaine Chanterêves Bourgogne 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Chanterêves Bourgogne 2020' |
| `5a2a051c...` | 3269 / Domaine Les Aphillanthes 'Nymphea Rosé' 2024 / Rhône | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Les Aphillanthes 'Nymphea Rosé' 2024 | Rhô' |
| `6e41a740...` | 3271 / Saint Damien Gigongas 2024 / Rhône | Lafayette Grand Café & Bakery | Remove wine list # -> 'Saint Damien Gigongas 2024 | Rhône' |
| `6cce67db...` | 3275 / Domaine Marquis d`Angerville Aligoté 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Marquis d`Angerville Aligoté 2021' |
| `50a1bd2a...` | 3292 / Domaine Raveneau Chablis 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Raveneau Chablis 2020' |
| `38466317...` | 3310 / Savagnin / Ganevat 'Les Chalasses Marnes Blenes' 2009 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Savagnin | Ganevat 'Les Chalasses Marnes Blenes' 2' |
| `94bf2577...` | 3315 / Riesling / Albert Boxler Réserve 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Riesling | Albert Boxler Réserve 2020' |
| `eb574d9c...` | 3325 / Olivier Merlin Pouilly Fuissé 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Olivier Merlin Pouilly Fuissé 2022' |
| `41e52d04...` | 3326 / Domaine Roulot Bourgogne Blanc 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Roulot Bourgogne Blanc 2021' |
| `c38ca920...` | 3329 / Michel Sarrazin Bourgogne Aligoté 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Michel Sarrazin Bourgogne Aligoté 2020' |
| `993a93de...` | 3333 / Château Pigoudet 'Classique' 2024 / Provence | Lafayette Grand Café & Bakery | Remove wine list # -> 'Château Pigoudet 'Classique' 2024 | Provence' |
| `78cb5bf9...` | 3334 / Christian Moreau Chablis 2023 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Christian Moreau Chablis 2023' |
| `3bef1c99...` | 3337 / Domaine La Bastide Blanche Bandol 2024 / Provence | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine La Bastide Blanche Bandol 2024 | Provence' |
| `3d1a4578...` | 3338 / Domaine Roulot Auxey-Duress 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Roulot Auxey-Duress 2022' |
| `dc840705...` | 3340 / Moreau Naudet Petit Chablis 2023 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Moreau Naudet Petit Chablis 2023' |
| `d0a1623c...` | 3341 / Chenin / Clos de L'Elu Anjou 'Ephata' 2013 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Chenin | Clos de L'Elu Anjou 'Ephata' 2013' |
| `c38eebdb...` | 3344 / Chenin / Taille aux Loups Montlouis 'Remus' 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Chenin | Taille aux Loups Montlouis 'Remus' 2021' |
| `29e8be6d...` | 3345 / Chenin / Grange Tiphaine 'Clef De Sol' 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Chenin | Grange Tiphaine 'Clef De Sol' 2022' |
| `a5a9508a...` | 3349 / Domaine du Bagnol Cassis 2023 / Provence | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine du Bagnol Cassis 2023 | Provence' |
| `37d4b74a...` | 3363 / Moreau-Naudet Chablis 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Moreau-Naudet Chablis 2022' |
| `6f2303f3...` | 3370 / Domaine des Moirots Montangy 1er Cru 'Le vieux' 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine des Moirots Montangy 1er Cru 'Le vieux' 20' |
| `72c2f31f...` | 3373 / Melon B. / Domaine Brégeon Clisson 'La Molette' 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Melon B. | Domaine Brégeon Clisson 'La Molette' 20' |
| `fd69cc28...` | 3374 / Chenin / Thibaud Boudignon Anjou 'Francois Blanc' 201 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Chenin | Thibaud Boudignon Anjou 'Francois Blanc' ' |
| `f8cfa3fa...` | 3390 / Melon B. / Domaine de l'Ecu Vin de France 'Taurus' 20 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Melon B. | Domaine de l'Ecu Vin de France 'Taurus'' |
| `abd5964a...` | 3392 / Jean Philippe Fichet Haute-Côtes de Beaune 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Jean Philippe Fichet Haute-Côtes de Beaune 2020' |
| `c4754acd...` | 3398 / Clos du Moulin aux Moines 'Les Combottes' 2019 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Clos du Moulin aux Moines 'Les Combottes' 2019' |
| `a6212fbb...` | 3408 / Hubert Lignier Bourgogne Aligoté 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Hubert Lignier Bourgogne Aligoté 2020' |
| `a08787fa...` | 3430 / Benjamin Leroux Bourgogne 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Benjamin Leroux Bourgogne 2020' |
| `913270d8...` | 3433 / Chardonnay / Ganevat 'Cuvee Florine' 2013 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Chardonnay | Ganevat 'Cuvee Florine' 2013' |
| `3721f121...` | 3460 / Remi Jobard Bourgogne Aligoté 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Remi Jobard Bourgogne Aligoté 2020' |
| `49d280d2...` | 3478 / Domaine Servin Chablis 1er Cru 'Montée De Tonnerre' 2 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Servin Chablis 1er Cru 'Montée De Tonnerre' |
| `a04b6b48...` | 3480 / Vermentino / Giudicelli Patrimonio Blanc 2020 / Coric | Lafayette Grand Café & Bakery | Remove wine list # -> 'Vermentino | Giudicelli Patrimonio Blanc 2020 | Co' |
| `ce21812f...` | 3489 / Domaine Servin Chablis 'Les Pargues' 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Servin Chablis 'Les Pargues' 2022' |
| `d6a822e7...` | 3508 / Clos Canarelli Corse 'Figari' 2022 / Corsica | Lafayette Grand Café & Bakery | Remove wine list # -> 'Clos Canarelli Corse 'Figari' 2022 | Corsica' |
| `65f9d38c...` | 3509 / Savignin / Château Montbourgeau L'Etoile 2018 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Savignin | Château Montbourgeau L'Etoile 2018' |
| `2049e754...` | 5004 / Carignan & Grenache / Les Aurelles 'Solen' '12 / Lang | Lafayette Grand Café & Bakery | Remove wine list # -> 'Carignan & Grenache | Les Aurelles 'Solen' '12 | L' |
| `c0a156d6...` | 5017 / Syrah / Domaine Phillipe Faury Cote Rotie 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Syrah | Domaine Phillipe Faury Cote Rotie 2021' |
| `f3ff99c7...` | 5025 / Gamay / Hérve Souhaut 'La Souteronne' 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Gamay | Hérve Souhaut 'La Souteronne' 2021' |
| `8b3a49dc...` | 5027 / Domaine Comte Senard Aloxe-Corton 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Comte Senard Aloxe-Corton 2021' |
| `8b320641...` | 5048 / Syrah / Domaine Faury Saint Joseph 'La Gloriette' VV  | Lafayette Grand Café & Bakery | Remove wine list # -> 'Syrah | Domaine Faury Saint Joseph 'La Gloriette' ' |
| `3006dab1...` | 5066 / Cab Franc & Malbec / La Grange Tiphaine 'Clef De Sol' | Lafayette Grand Café & Bakery | Remove wine list # -> 'Cab Franc & Malbec | La Grange Tiphaine 'Clef De S' |
| `4545eddd...` | 5067 / Grenache+ / Domaine Les Aphillanthes Rasteau '1921' 2 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Grenache+ | Domaine Les Aphillanthes Rasteau '1921' |
| `9bb827c4...` | 5070 / Pierre Morey Bourgogne Rouge 2019 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Pierre Morey Bourgogne Rouge 2019' |
| `b7afed22...` | 5073 / Syrah / Vincent Paris Cornas 'Granit 30' 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Syrah | Vincent Paris Cornas 'Granit 30' 2021' |
| `62fc27b2...` | 5074 / Syrah / Yves Cuilleron Côte Rôtie 'Bonnivières' 2019 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Syrah | Yves Cuilleron Côte Rôtie 'Bonnivières' 20' |
| `ea78e364...` | 5102 / Syrah / Hervé Souhaut Saint Joseph 'Cessieux' 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Syrah | Hervé Souhaut Saint Joseph 'Cessieux' 2021' |
| `402cfad6...` | 5104 / Grenache+ / Santa Duc Gigondas 'Aux Lieux-Dits' 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Grenache+ | Santa Duc Gigondas 'Aux Lieux-Dits' 20' |
| `58b4b0f3...` | 5107 / Cabernet Franc / Domaine du Mortier 'Dionysos' 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Cabernet Franc | Domaine du Mortier 'Dionysos' 202' |
| `07f845c2...` | 5108 / Grenache+ / Santa Duc Vacqueyra 'Les Aubes' 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Grenache+ | Santa Duc Vacqueyra 'Les Aubes' 2021' |
| `9771f3b0...` | 5109 / Trousseau / Domaine Pignier 2019 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Trousseau | Domaine Pignier 2019' |
| `4143c063...` | 5110 / Jean Foillard Fleurie 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Jean Foillard Fleurie 2022' |
| `88683150...` | 5112 / Syrah / Graillot Croze Hermitage 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Syrah | Graillot Croze Hermitage 2020' |
| `547bcc08...` | 5126 / Olivier Merlin Bourgogne Rouge 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Olivier Merlin Bourgogne Rouge 2022' |
| `3c442f85...` | 5137 / Domaine Hudelot-Baillet Bourgogne Rouge 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Hudelot-Baillet Bourgogne Rouge 2021' |
| `0d2a0c20...` | 5150 / Syrah / Domaine Hervé Souhaut 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Syrah | Domaine Hervé Souhaut 2021' |
| `5db8ef9e...` | 5164 / Sylvain Pataille Bourgogne Rouge 2019 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Sylvain Pataille Bourgogne Rouge 2019' |
| `aed4917d...` | 5195 / Syrah / Yves Cuilleron Côte Rôtie 'Terres Sombres' 20 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Syrah | Yves Cuilleron Côte Rôtie 'Terres Sombres'' |
| `6757498c...` | 5200 / Pinot/Trousseau/Poulsard / Domaine Pélican '3 Cépages | Lafayette Grand Café & Bakery | Remove wine list # -> 'Pinot/Trousseau/Poulsard | Domaine Pélican '3 Cépa' |
| `f5ea546e...` | 5203 / Malbec / Grange Tiphaine Côt 'Vieilles Vignes' 2017 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Malbec | Grange Tiphaine Côt 'Vieilles Vignes' 201' |
| `bf460fd9...` | 5207 / Julien Sunier Régnié 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Julien Sunier Régnié 2021' |
| `aa7ca94e...` | 5210 / Mourvèdre+ / Domaine Tempier Bandol 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Mourvèdre+ | Domaine Tempier Bandol 2020' |
| `88147683...` | 5240 / Syrah / Julien Cécillon St. Joseph 'Babylone' 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Syrah | Julien Cécillon St. Joseph 'Babylone' 2020' |
| `07b82c32...` | 5242 / Domaine Coillot Bourgogne Rouge 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Coillot Bourgogne Rouge 2022' |
| `4d2654ed...` | 5245 / Sylvain Pataille Marsannay 2018 'En Clemengeots' | Lafayette Grand Café & Bakery | Remove wine list # -> 'Sylvain Pataille Marsannay 2018 'En Clemengeots'' |
| `4f42f1cf...` | 5278 / Poulsard / Domaine Pélican Arbois 2019 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Poulsard | Domaine Pélican Arbois 2019' |
| `709005b2...` | 5280 / Jean Grivot Vosne Romanee 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Jean Grivot Vosne Romanee 2020' |
| `2225b7b4...` | 5291 / Mourvedre+ / Domaine Tempier Bandol 'La Migoua' 2016 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Mourvedre+ | Domaine Tempier Bandol 'La Migoua' 20' |
| `26ff4bc6...` | 5292 / Ghislaine Barthod Chambolle-Musigny 2018 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Ghislaine Barthod Chambolle-Musigny 2018' |
| `15398ac2...` | 5294 / Cab Franc / Thierry Germain Saumur 'La Marginale' 202 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Cab Franc | Thierry Germain Saumur 'La Marginale' ' |
| `327e8a00...` | 5320 / Prudhon & Fils 1er Cru 'Sur Le Sentier Du Clou' 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Prudhon & Fils 1er Cru 'Sur Le Sentier Du Clou' 20' |
| `9d92ad40...` | 5336 / Didier Fornerol Côte de Nuits Villages 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Didier Fornerol Côte de Nuits Villages 2021' |
| `4de2201d...` | 5348 / Ghislaine Barthod 'Les Bon Bâton' 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Ghislaine Barthod 'Les Bon Bâton' 2020' |
| `9add392a...` | 5349 / Cabernet Franc / Grange Tiphaine 'Ad Libitum' 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Cabernet Franc | Grange Tiphaine 'Ad Libitum' 2022' |
| `dc0f094a...` | 5350 / Michel Juillot Bourgogne 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Michel Juillot Bourgogne 2022' |
| `73357630...` | 5352 / Julien Sunier Morgon 2023 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Julien Sunier Morgon 2023' |
| `7cf8649b...` | 5354 / Syrah / Jean Luc Colombo 'Les Ruchets' Cornas 2017 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Syrah | Jean Luc Colombo 'Les Ruchets' Cornas 2017' |
| `df477677...` | 5355 / Syrah / Domaine A. Clape CdRhône 2017 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Syrah | Domaine A. Clape CdRhône 2017' |
| `64a37840...` | 5361 / Grenache+/ Gramenon Cotes du Rhône 'La Sagesse' 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Grenache+| Gramenon Cotes du Rhône 'La Sagesse' 20' |
| `eeb0f512...` | 5363 / Domaine De Villaine Bourgogne Rouge 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine De Villaine Bourgogne Rouge 2021' |
| `8d7b4ba7...` | 5365 / Domaine de la Grand' Cour Fleurie 2023 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine de la Grand' Cour Fleurie 2023' |
| `29c3f860...` | 5372 / Simon Bize Savigny Les Beaune 1er Cru 'Aux Vergelesse | Lafayette Grand Café & Bakery | Remove wine list # -> 'Simon Bize Savigny Les Beaune 1er Cru 'Aux Vergele' |
| `e6eb9218...` | 5374 / Gamay & Trousseau / Ganevat 'J'en Veux Encore' 2016 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Gamay & Trousseau | Ganevat 'J'en Veux Encore' 201' |
| `fa26d663...` | 5375 / Domaine Cassiopée Hautes Côtes de Beaune 'Les Côtés'  | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Cassiopée Hautes Côtes de Beaune 'Les Côté' |
| `50d0f3a6...` | 5377 / Daniel Bouland Morgon 'Les Delys - 1926' 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Daniel Bouland Morgon 'Les Delys - 1926' 2022' |
| `ca75aa46...` | 5380 / Gamay & Pinot Noir / Christian Venier 'Haut de Madon' | Lafayette Grand Café & Bakery | Remove wine list # -> 'Gamay & Pinot Noir | Christian Venier 'Haut de Mad' |
| `631172a5...` | 5392 / Château Cambon Brouilly 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Château Cambon Brouilly 2021' |
| `d23e51ee...` | 5394 / Syrah / Auguste Clape Vin des Amis Rouge 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Syrah | Auguste Clape Vin des Amis Rouge 2021' |
| `ec70f274...` | 5395 / Grenache+ / Gramenon CdRhône 'La Papesse' 2019 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Grenache+ | Gramenon CdRhône 'La Papesse' 2019' |
| `c2a5a80f...` | 5400 / Clos de la Roilette Fleurie 2023 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Clos de la Roilette Fleurie 2023' |
| `3f14fbee...` | 5405 / Cabernet+ / Margaux de Brane 2020 / Margaux | Lafayette Grand Café & Bakery | Remove wine list # -> 'Cabernet+ | Margaux de Brane 2020 | Margaux' |
| `100f42aa...` | 5444 / Simon Bize & Fils Aloxe Corton 1er Cru 'Suchot' 2019 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Simon Bize & Fils Aloxe Corton 1er Cru 'Suchot' 20' |
| `9fa10cbb...` | 5445 / Domaine Marquis D'Angerville Volnay 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Marquis D'Angerville Volnay 2022' |
| `9ebab3d0...` | 5447 / Mourvedre+ / Domaine Tempier Bandol 2019 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Mourvedre+ | Domaine Tempier Bandol 2019' |
| `b9aa4b54...` | 5456 / Daniel Bouland Morgon Corcelette Sable VV 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Daniel Bouland Morgon Corcelette Sable VV 2022' |
| `04802652...` | 5458 / Syrah / Domaine Du Gringet 'Yseult Mon Amour' 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Syrah | Domaine Du Gringet 'Yseult Mon Amour' 2022' |
| `f47bcb3a...` | 5471 / Hubert Lignier Gevrey Chambertin 'Les Seuvrées' 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Hubert Lignier Gevrey Chambertin 'Les Seuvrées' 20' |
| `fa8e7971...` | 5482 / Merlot+ / Château Montlandrie 2016 / Cotes de Castill | Lafayette Grand Café & Bakery | Remove wine list # -> 'Merlot+ | Château Montlandrie 2016 | Cotes de Cast' |
| `5e292494...` | 5485 / Cab Franc / C & P Breton Bourgueil 'Les Pèrrieres' 20 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Cab Franc | C & P Breton Bourgueil 'Les Pèrrieres'' |
| `dc83a3d6...` | 5486 / Merlot+ / Ch. Rausan Gassies 'L'Orme' 2018 / Haut Med | Lafayette Grand Café & Bakery | Remove wine list # -> 'Merlot+ | Ch. Rausan Gassies 'L'Orme' 2018 | Haut ' |
| `77291eb9...` | 5487 / Grenache+ / Les Vieux Donjon CNDPape 2017 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Grenache+ | Les Vieux Donjon CNDPape 2017' |
| `df7394fd...` | 5490 / Benjamin Leroux Bourgogne Rouge 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Benjamin Leroux Bourgogne Rouge 2022' |
| `1a37d780...` | 5491 / Syrah / Domaine A. Clape CdRhône 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Syrah | Domaine A. Clape CdRhône 2021' |
| `7732ff34...` | 5493 / Grenache+ / Santa Duc Gigondas 'Derrière Vieille' 202 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Grenache+ | Santa Duc Gigondas 'Derrière Vieille' ' |
| `4e107ac2...` | 5494 / Syrah / Franck Balthazar Crozes Hertimage 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Syrah | Franck Balthazar Crozes Hertimage 2021' |
| `cc0a724d...` | 5498 / Merlot+ / Le Carillon de Rouget 2019 / Pomerol | Lafayette Grand Café & Bakery | Remove wine list # -> 'Merlot+ | Le Carillon de Rouget 2019 | Pomerol' |
| `1b57dd86...` | 5521 / Marcel Lapierre Morgon 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Marcel Lapierre Morgon 2022' |
| `6c8c25c3...` | 5530 / Cabernet+ / Château Mauvesin Barton 2020 / Moulis | Lafayette Grand Café & Bakery | Remove wine list # -> 'Cabernet+ | Château Mauvesin Barton 2020 | Moulis' |
| `0727ca87...` | 5532 / Domaine Cornu Camus Pernand-Vergelesses 1er Cru 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Cornu Camus Pernand-Vergelesses 1er Cru 20' |
| `29be9a97...` | 5541 / Jean Foillard Morgon 'Côte du Py' 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Jean Foillard Morgon 'Côte du Py' 2021' |
| `2a758cfe...` | 6000 / Malbec / Grange Tiphaine Côt 'Vieilles Vignes' 2019 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Malbec | Grange Tiphaine Côt 'Vieilles Vignes' 201' |
| `00f67a30...` | 6002 / Syrah / Rene Balthazar Cornas 'Sans Soufre' 2019 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Syrah | Rene Balthazar Cornas 'Sans Soufre' 2019' |
| `b5dc5ff2...` | 6014 / Les Horées Savigny-les-Beaune 'Les Vermots' 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Les Horées Savigny-les-Beaune 'Les Vermots' 2020' |
| `cebede94...` | 6015 / Simon Bize Savigny Le Beaune Blanc 2018 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Simon Bize Savigny Le Beaune Blanc 2018' |
| `a6b4ef63...` | 6026 / Cabernet+ / Château Kirwan 2016 / Margaux | Lafayette Grand Café & Bakery | Remove wine list # -> 'Cabernet+ | Château Kirwan 2016 | Margaux' |
| `f4f2ec85...` | 6030 / Syrah / Rene Balthazar Cornas 'Chaillots' 2019 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Syrah | Rene Balthazar Cornas 'Chaillots' 2019' |
| `343ad401...` | 6105 / Cabernet+ / Château Pape Clément 2019 / Pessac | Lafayette Grand Café & Bakery | Remove wine list # -> 'Cabernet+ | Château Pape Clément 2019 | Pessac' |
| `a14233b3...` | 6117 / Merlot+ / La Gravette de Certan 2017 / Pomerol | Lafayette Grand Café & Bakery | Remove wine list # -> 'Merlot+ | La Gravette de Certan 2017 | Pomerol' |
| `241f0aab...` | 6119 / Syrah / Franck Balthazar Cornas 'Juliette' 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Syrah | Franck Balthazar Cornas 'Juliette' 2021' |
| `155b11c1...` | 6120 / Mourvedre+ / Domaine Tempier Bandol 'La Migoua' 2014 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Mourvedre+ | Domaine Tempier Bandol 'La Migoua' 20' |
| `130da3a5...` | 6121 / Mourvedre+ / Domaine Tempier Bandol 'La Migoua' 2015 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Mourvedre+ | Domaine Tempier Bandol 'La Migoua' 20' |
| `396022cf...` | 6123 / Domaine Hubert Lignier V.V. 2019 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine Hubert Lignier V.V. 2019' |
| `0dddf16d...` | 6124 / Les Horées 'Aganippe' Bourgogne Blanc 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Les Horées 'Aganippe' Bourgogne Blanc 2020' |
| `47e47398...` | 6126 / Cabernet+ / La Siréne de Giscours 2019 / Margaux | Lafayette Grand Café & Bakery | Remove wine list # -> 'Cabernet+ | La Siréne de Giscours 2019 | Margaux' |
| `69cf1162...` | 6129 / Cabernet+ / Les Pagodes de Cos 2016 / St. Estèphe | Lafayette Grand Café & Bakery | Remove wine list # -> 'Cabernet+ | Les Pagodes de Cos 2016 | St. Estèphe' |
| `6d51ea89...` | 6132 / Merlot+ / Château Larcis Ducasse 2016 / St. Émilion | Lafayette Grand Café & Bakery | Remove wine list # -> 'Merlot+ | Château Larcis Ducasse 2016 | St. Émilio' |
| `ae80d8fe...` | 6138 / Simon Bize et Fils Savigny-les-Beaune 'Aka' 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Simon Bize et Fils Savigny-les-Beaune 'Aka' 2021' |
| `bf005798...` | 6146 / Marquis D'Angerville Volnay 1er Cru 'Champans' 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Marquis D'Angerville Volnay 1er Cru 'Champans' 202' |
| `0c7223ea...` | 6151 / Cabernet+ / Mas de Daumas Gassac 2009 / Languedoc | Lafayette Grand Café & Bakery | Remove wine list # -> 'Cabernet+ | Mas de Daumas Gassac 2009 | Languedoc' |
| `8c65aed7...` | 6155 / Grenache+ / Les Vieux Donjon CNDPape 2020 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Grenache+ | Les Vieux Donjon CNDPape 2020' |
| `f9251fa9...` | 6158 / Cabernet+ / Château Belgrave 2016 / Haut Medoc | Lafayette Grand Café & Bakery | Remove wine list # -> 'Cabernet+ | Château Belgrave 2016 | Haut Medoc' |
| `8cd987e7...` | 6159 / Simon Bize 'Shiro' Savigny Blanc 2019 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Simon Bize 'Shiro' Savigny Blanc 2019' |
| `39a369a2...` | 6165 / Comtes Lafon Meursault 'Clos De La Baron' 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Comtes Lafon Meursault 'Clos De La Baron' 2021' |
| `53812365...` | 6170 / Cabernet+ / Château Calon Ségur 2015 / St. Estèphe | Lafayette Grand Café & Bakery | Remove wine list # -> 'Cabernet+ | Château Calon Ségur 2015 | St. Estèphe' |
| `69ecba06...` | 6185 / Grenache+ / Domaine Charbonnière CNDPape 'VV' 2019 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Grenache+ | Domaine Charbonnière CNDPape 'VV' 2019' |
| `3c44219b...` | 6186 / Merlot+ / Château Canon 2016 / St. Émilion | Lafayette Grand Café & Bakery | Remove wine list # -> 'Merlot+ | Château Canon 2016 | St. Émilion' |
| `2924aedd...` | 6205 / Cabernet+ / La Croix Ducru-Beaucaillou 2016 / Saint-J | Lafayette Grand Café & Bakery | Remove wine list # -> 'Cabernet+ | La Croix Ducru-Beaucaillou 2016 | Sain' |
| `433bd420...` | 6210 / Merlot+ / Petit Figeac 2020 / St. Émilion | Lafayette Grand Café & Bakery | Remove wine list # -> 'Merlot+ | Petit Figeac 2020 | St. Émilion' |
| `398c3637...` | 6212 / Cabernet+ / Château Grand Puy Lacoste 2020 / Pauillac | Lafayette Grand Café & Bakery | Remove wine list # -> 'Cabernet+ | Château Grand Puy Lacoste 2020 | Pauil' |
| `bf556334...` | 6605 / Krug Grand Cuvée, 170th Édition Brut | Lafayette Grand Café & Bakery | Remove wine list # -> 'Krug Grand Cuvée, 170th Édition Brut' |
| `aa1de67e...` | 7033 / Chartogne-Taillet 'Les Barres' Extra-Brut | Lafayette Grand Café & Bakery | Remove wine list # -> 'Chartogne-Taillet 'Les Barres' Extra-Brut' |
| `4baf799c...` | 7035 / Pehu Simmonet 'Face Nord' Brut Rosé | Lafayette Grand Café & Bakery | Remove wine list # -> 'Pehu Simmonet 'Face Nord' Brut Rosé' |
| `43400c55...` | 7041 / Larmandier Bernier 'Rosé de Saignée' Brut | Lafayette Grand Café & Bakery | Remove wine list # -> 'Larmandier Bernier 'Rosé de Saignée' Brut' |
| `beac0143...` | 7045 / Egly -Ouriet 'Millesime' Grand Cru 2012 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Egly -Ouriet 'Millesime' Grand Cru 2012' |
| `625a94e3...` | 7075 / Egly -Ouriet Blanc de Noirs Grand Cru 'Les Crayeres' | Lafayette Grand Café & Bakery | Remove wine list # -> 'Egly -Ouriet Blanc de Noirs Grand Cru 'Les Crayere' |
| `73bbe2ac...` | 7082 / Drappier Brut Nature Rosé | Lafayette Grand Café & Bakery | Remove wine list # -> 'Drappier Brut Nature Rosé' |
| `eb37b7c3...` | 7105 / Bérêche Brut Réserve | Lafayette Grand Café & Bakery | Remove wine list # -> 'Bérêche Brut Réserve' |
| `82e028bb...` | 7107 / Rene Geoffrey Brut 'Rosé de Saignée' Brut | Lafayette Grand Café & Bakery | Remove wine list # -> 'Rene Geoffrey Brut 'Rosé de Saignée' Brut' |
| `53fcc92d...` | 7108 / RH Coutier Brut Rosé Grand Cru | Lafayette Grand Café & Bakery | Remove wine list # -> 'RH Coutier Brut Rosé Grand Cru' |
| `09456b18...` | 7109 / P. Gimonnet et Fils 'Chouilly' Grand Cru 2015 | Lafayette Grand Café & Bakery | Remove wine list # -> 'P. Gimonnet et Fils 'Chouilly' Grand Cru 2015' |
| `5d57e92f...` | 7112 / Eric Maître Brut Tradition NV | Lafayette Grand Café & Bakery | Remove wine list # -> 'Eric Maître Brut Tradition NV' |
| `367bcd48...` | 7120 / Egly-Ouriet 'Les Vignes de Bisseuil' 1er Cru Brut | Lafayette Grand Café & Bakery | Remove wine list # -> 'Egly-Ouriet 'Les Vignes de Bisseuil' 1er Cru Brut' |
| `ff29680d...` | 7121 / P. Gimonnet 'Cuvée Oenophile' GC BdBlancs Extra-Brut  | Lafayette Grand Café & Bakery | Remove wine list # -> 'P. Gimonnet 'Cuvée Oenophile' GC BdBlancs Extra-Br' |
| `f7741828...` | 7122 / La Grange Tiphaine 'Rosa Rosé Rosam' Pét-Nat | Lafayette Grand Café & Bakery | Remove wine list # -> 'La Grange Tiphaine 'Rosa Rosé Rosam' Pét-Nat' |
| `caea33c9...` | 7124 / Pierre Gimonnet & Fils Rosé 'Rosé de Blancs' Brut | Lafayette Grand Café & Bakery | Remove wine list # -> 'Pierre Gimonnet & Fils Rosé 'Rosé de Blancs' Brut' |
| `a88d89fa...` | 7126 / Fredrick Savart 'Bulle de Rosé' 1er Cru | Lafayette Grand Café & Bakery | Remove wine list # -> 'Fredrick Savart 'Bulle de Rosé' 1er Cru' |
| `81affff6...` | 7134 / Dappier Brut Nature | Lafayette Grand Café & Bakery | Remove wine list # -> 'Dappier Brut Nature' |
| `f768a8fd...` | 7140 / Egly-Ouriet VP Grand Cru Extra Brut | Lafayette Grand Café & Bakery | Remove wine list # -> 'Egly-Ouriet VP Grand Cru Extra Brut' |
| `7c0070e4...` | 7145 / Pierre Péters 'Cuvée de Réserve' Brut | Lafayette Grand Café & Bakery | Remove wine list # -> 'Pierre Péters 'Cuvée de Réserve' Brut' |
| `9238f988...` | 7150 / Francois Seconde NV 'Clavier' Grand Cru | Lafayette Grand Café & Bakery | Remove wine list # -> 'Francois Seconde NV 'Clavier' Grand Cru' |
| `57754998...` | 7155 / Paul Prieur et Fils Bulles de Pinot 2023 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Paul Prieur et Fils Bulles de Pinot 2023' |
| `89fb19da...` | 7210 / P. Gimonnet et Fils 'Special Club' Brut 2014 | Lafayette Grand Café & Bakery | Remove wine list # -> 'P. Gimonnet et Fils 'Special Club' Brut 2014' |
| `e66fdcfb...` | 7215 / Egly-Ouriet Grand Cru Brut | Lafayette Grand Café & Bakery | Remove wine list # -> 'Egly-Ouriet Grand Cru Brut' |
| `414bcc02...` | 7218 / Jacques Lassaigne Montgueux Blanc de Blanc | Lafayette Grand Café & Bakery | Remove wine list # -> 'Jacques Lassaigne Montgueux Blanc de Blanc' |
| `bfcbb124...` | 7227 / Fredrick Savart 'L Ouverture' 1er Cru | Lafayette Grand Café & Bakery | Remove wine list # -> 'Fredrick Savart 'L Ouverture' 1er Cru' |
| `0753cbc6...` | 9000 / Toques et Clochers Brut Crémant de Limoux | Lafayette Grand Café & Bakery | Remove wine list # -> 'Toques et Clochers Brut Crémant de Limoux' |
| `aec02de0...` | 9004 / R.H. Coutier Brut Tradition Grand Cru | Lafayette Grand Café & Bakery | Remove wine list # -> 'R.H. Coutier Brut Tradition Grand Cru' |
| `37a13ae7...` | 9006 / Sauvignon Blanc / Domaine de La Pagerie Reuilly 2021 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Sauvignon Blanc | Domaine de La Pagerie Reuilly 20' |
| `0f5e78e3...` | 9008 / Vermentino / Domaine Preignes 'Le Vieux' 2023 / Langu | Lafayette Grand Café & Bakery | Remove wine list # -> 'Vermentino | Domaine Preignes 'Le Vieux' 2023 | La' |
| `d115f0bc...` | 9009 / Riesling / Paul Blanck 'Classique' 2023 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Riesling | Paul Blanck 'Classique' 2023' |
| `e568878a...` | 9032 / Dirler Cadé Crémant d'Alsace Brut Nature Rosé 2019 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Dirler Cadé Crémant d'Alsace Brut Nature Rosé 2019' |
| `679381f7...` | 9035 / Domaine des Marrans 'Corcelette' 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Domaine des Marrans 'Corcelette' 2022' |
| `f12ce83d...` | 9037 / Malbec / Clos Siguier 'Les Camilles' V. V. 2019 / Cah | Lafayette Grand Café & Bakery | Remove wine list # -> 'Malbec | Clos Siguier 'Les Camilles' V. V. 2019 | ' |
| `d59f8cf7...` | 9050 / Cabernet & Merlot / Château Réal 2019 / Haut Medoc | Lafayette Grand Café & Bakery | Remove wine list # -> 'Cabernet & Merlot | Château Réal 2019 | Haut Medoc' |
| `fba6521e...` | 9103 / Grenache + / Alain Graillot 'Clos Somi' 2022 | Lafayette Grand Café & Bakery | Remove wine list # -> 'Grenache + | Alain Graillot 'Clos Somi' 2022' |
| `b09b1d17...` | 9104 / Cabernet+ / Château Lilian Ladouys 2020 / Saint-Estèp | Lafayette Grand Café & Bakery | Remove wine list # -> 'Cabernet+ | Château Lilian Ladouys 2020 | Saint-Es' |
| `45e632cb...` | Selection of assorted pastries baked fresh daily and served  | Lafayette Grand Café & Bakery | Name too long (94 chars); likely marketing copy |
| `971f26d0...` | ETERNALLY GRAPEFRUIT (vodka, grapefruit liqueur, lemon, rose | PLANTA New York | Name too long (81 chars); likely marketing copy |
| `54fac669...` | Plain | Prince Street Pizza | Too vague alone; needs qualifier |
| `8a250062...` | Classic | Rubirosa | Too vague alone; needs qualifier |
| `93879662...` | Original | Scarr's Pizza | Too vague alone; needs qualifier |
| `d079a9e4...` | Classic | The Smith | Too vague alone; needs qualifier |
| `9f35a54a...` | Classic Green / Green Mint / Earl Grey / English Breakfast / | The Smith | Name too long (98 chars); likely marketing copy |
| `17c4b839...` | Pot of Mussels | The Smith | Duplicate of 'Pot of Mussels' (keep f81e8d12...) |
| `fb5b07dd...` | The Smith Burger | The Smith | Duplicate of 'The Smith Burger' (keep 718ef391...) |

---

## Category C -- Verify Accuracy

These dishes may have cuisine mismatches worth investigating.

| ID | Name | Restaurant | Concern |
|----|------|------------|---------|
| `cc7e28ea...` | Cuttle Fish Taco Ball | Golden Unicorn | 'Cuttle Fish Taco Ball' at Chinese restaurant 'Golden Unicorn' - possible cuisine mismatch |
| `0648a4e8...` | Minced Chicken Meat with Lettuce Taco | Golden Unicorn | 'Minced Chicken Meat with Lettuce Taco' at Chinese restaurant 'Golden Unicorn' - possible cuisine mismatch |
| `97aa1c9e...` | Vegetable Bibimbap | The Smith | 'Vegetable Bibimbap' at American restaurant 'The Smith' - possible cuisine mismatch |
