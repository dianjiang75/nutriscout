import { prisma } from "@/lib/db/client";
import { compare } from "bcryptjs";
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

    const { email, password } = await request.json();
    if (!email || !password) {
      return Response.json({ error: "email and password are required" }, { status: 400 });
    }

    const user = await prisma.userProfile.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await signToken({ sub: user.id, email: user.email, name: user.name });

    return Response.json(
      {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          dietary_restrictions: user.dietaryRestrictions,
          nutritional_goals: user.nutritionalGoals,
        },
      },
      {
        headers: { "Set-Cookie": `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}` },
      }
    );
  } catch {
    return Response.json({ error: "Login failed" }, { status: 500 });
  }
}
