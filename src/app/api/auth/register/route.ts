import { prisma } from "@/lib/db/client";
import { hash } from "bcryptjs";
import { signToken } from "@/lib/auth/jwt";
import { checkApiRateLimit } from "@/lib/middleware/rate-limiter";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const rl = await checkApiRateLimit(ip, "auth");
    if (!rl.allowed) {
      return Response.json(
        { error: "Too many requests", retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) } }
      );
    }

    const body = await request.json();
    const { email, name, password, dietary_restrictions, nutritional_goals } = body;

    if (!email || !name || !password) {
      return Response.json(
        { error: "email, name, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return Response.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const passwordHash = await hash(password, 12);

    const user = await prisma.userProfile.create({
      data: {
        email,
        name,
        passwordHash,
        dietaryRestrictions: dietary_restrictions ?? undefined,
        nutritionalGoals: nutritional_goals ?? undefined,
      },
    });

    const token = await signToken({ sub: user.id, email: user.email, name: user.name });

    return Response.json(
      { token, user: { id: user.id, email: user.email, name: user.name } },
      {
        status: 201,
        headers: { "Set-Cookie": `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}` },
      }
    );
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return Response.json({ error: "Email already registered" }, { status: 409 });
    }
    return Response.json({ error: "Registration failed" }, { status: 500 });
  }
}
