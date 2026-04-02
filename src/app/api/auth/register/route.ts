import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hash } from "bcryptjs";
import { signToken } from "@/lib/auth/jwt";
import { checkApiRateLimit } from "@/lib/middleware/rate-limiter";
import { apiBadRequest, apiError, apiRateLimited } from "@/lib/utils/api-response";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").max(100),
  password: z.string().min(6, "Password must be at least 6 characters"),
  dietary_restrictions: z.record(z.string(), z.boolean()).optional(),
  nutritional_goals: z.record(z.string(), z.any()).optional(),
});

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const rl = await checkApiRateLimit(ip, "auth");
    if (!rl.allowed) {
      return apiRateLimited(rl.retryAfterSeconds);
    }

    const body = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message || "Invalid input");
    }
    const { email, name, password, dietary_restrictions, nutritional_goals } = parsed.data;

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
      { success: true, data: { token, user: { id: user.id, email: user.email, name: user.name } } },
      {
        status: 201,
        headers: { "Set-Cookie": `token=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${7 * 24 * 60 * 60}` },
      }
    );
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return apiError("Email already registered", 409);
    }
    return apiError("Registration failed");
  }
}
