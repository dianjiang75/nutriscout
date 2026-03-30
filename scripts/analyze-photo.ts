/**
 * CLI script to analyze a food photo.
 * Usage: npx tsx -r tsconfig-paths/register scripts/analyze-photo.ts <image_url>
 */
import "dotenv/config";

async function main() {
  const imageUrl = process.argv[2];

  if (!imageUrl) {
    console.error("Usage: npx tsx -r tsconfig-paths/register scripts/analyze-photo.ts <image_url>");
    process.exit(1);
  }

  const { analyzeFoodPhoto } = await import(
    "../src/lib/agents/vision-analyzer"
  );

  console.log(`\nAnalyzing photo: ${imageUrl}\n`);

  try {
    const result = await analyzeFoodPhoto(imageUrl);

    console.log(`Dish:        ${result.dish_name}`);
    console.log(`Cuisine:     ${result.cuisine_type}`);
    console.log(`Preparation: ${result.preparation_method}`);
    console.log(`Confidence:  ${(result.confidence * 100).toFixed(0)}%`);
    console.log(`\n--- Ingredients ---`);
    for (const ing of result.ingredients) {
      const macroStr = ing.macros
        ? ` → ${ing.macros.calories} cal, ${ing.macros.protein_g}g P`
        : " → (no USDA match)";
      console.log(
        `  ${ing.is_primary ? "●" : "○"} ${ing.name} (${ing.estimated_grams}g)${macroStr}`
      );
    }
    console.log(`\n--- Macro Estimates ---`);
    const m = result.macros;
    console.log(
      `Calories:  ${m.calories.best_estimate} (${m.calories.min}–${m.calories.max})`
    );
    console.log(
      `Protein:   ${m.protein_g.best_estimate}g (${m.protein_g.min}–${m.protein_g.max})`
    );
    console.log(
      `Carbs:     ${m.carbs_g.best_estimate}g (${m.carbs_g.min}–${m.carbs_g.max})`
    );
    console.log(
      `Fat:       ${m.fat_g.best_estimate}g (${m.fat_g.min}–${m.fat_g.max})`
    );
    console.log(`\nUSDA References: ${result.usda_references.join(", ")}`);
  } catch (err) {
    console.error("Error:", (err as Error).message);
    process.exit(1);
  }

  process.exit(0);
}

main();
