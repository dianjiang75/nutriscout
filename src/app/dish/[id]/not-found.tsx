import Link from "next/link";

export default function DishNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <p className="text-4xl mb-3">🍽</p>
      <h1 className="text-xl font-bold mb-1">Dish not found</h1>
      <p className="text-sm text-muted-foreground mb-6">
        This dish may have been removed or the link may be incorrect.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Back to search
      </Link>
    </div>
  );
}
