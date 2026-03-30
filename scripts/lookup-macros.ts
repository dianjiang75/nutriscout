/**
 * CLI script to look up macros for a food item.
 * Usage: npx tsx -r tsconfig-paths/register scripts/lookup-macros.ts "grilled chicken breast" 200
 */
import "dotenv/config";

async function main() {
  const [foodName, portionStr] = process.argv.slice(2);

  if (!foodName) {
    console.error("Usage: npx tsx -r tsconfig-paths/register scripts/lookup-macros.ts <food_name> [portion_grams]");
    console.error('Example: npx tsx -r tsconfig-paths/register scripts/lookup-macros.ts "grilled chicken breast" 200');
    process.exit(1);
  }

  const portionGrams = portionStr ? parseFloat(portionStr) : 100;

  if (isNaN(portionGrams) || portionGrams <= 0) {
    console.error("Portion must be a positive number in grams");
    process.exit(1);
  }

  const { estimateMacros, searchFood } = await import("../src/lib/usda/client");

  console.log(`\nSearching USDA for: "${foodName}" (${portionGrams}g portion)\n`);

  try {
    const foods = await searchFood(foodName, 3);
    console.log(`Found ${foods.length} matches:`);
    foods.forEach((f, i) => {
      console.log(`  ${i + 1}. [${f.fdcId}] ${f.description} (${f.dataType})`);
    });

    console.log(`\n--- Macro Estimate (${portionGrams}g) ---`);
    const macros = await estimateMacros(foodName, portionGrams);

    console.log(`Food:       ${macros.serving_description}`);
    console.log(`Calories:   ${macros.calories} kcal`);
    console.log(`Protein:    ${macros.protein_g}g`);
    console.log(`Carbs:      ${macros.carbs_g}g`);
    console.log(`Fat:        ${macros.fat_g}g`);
    console.log(`Fiber:      ${macros.fiber_g}g`);
    console.log(`Confidence: ${(macros.confidence * 100).toFixed(0)}%`);
    console.log(`USDA FDC:   ${macros.usda_fdc_id}`);
  } catch (err) {
    console.error("Error:", (err as Error).message);
    process.exit(1);
  }

  process.exit(0);
}

main();
