import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { publicErrorMessage } from "@/lib/http/public-error";
import { generateInDepthReport } from "@/lib/llm/generation";

export const maxDuration = 60;

const riskSchema = z.enum(["low", "medium", "high"]);
const bodySchema = z
  .object({
    analysis: z
      .object({
        claims: z
          .array(
            z.object({
              claim: z.string().max(4_000),
              confidence: z.number().min(0).max(1),
              evidenceIds: z.array(z.string().max(120)).max(50),
              stance: z.string().max(500),
            }),
          )
          .max(100),
        riskFlags: z
          .array(
            z.object({
              count: z.number().nonnegative(),
              label: z.string().max(500),
              severity: riskSchema,
            }),
          )
          .max(100),
        riskLevel: riskSchema,
        sentiment: z.object({
          negative: z.number().nonnegative(),
          neutral: z.number().nonnegative(),
          positive: z.number().nonnegative(),
          total: z.number().nonnegative(),
        }),
        stanceSummary: z.string().max(8_000),
        summary: z.string().max(12_000),
        topicClusters: z
          .array(
            z.object({
              count: z.number().nonnegative(),
              name: z.string().max(500),
              riskLevel: riskSchema,
              trend: z.string().max(500),
            }),
          )
          .max(100),
      })
      .strict(),
    depth: z.enum(["standard", "deep"]).default("deep"),
    draftBody: z.string().max(20_000).nullable().optional(),
    evidence: z
      .array(
        z
          .object({
            id: z.string().min(1).max(120),
            quote: z.string().max(20_000).nullable().optional(),
            riskLevel: riskSchema.nullable().optional(),
            sourceLabel: z.string().max(1_000).nullable().optional(),
            summary: z.string().max(12_000).nullable().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(60),
    report: z
      .object({
        description: z.string().min(1).max(2_000),
        sections: z.array(z.string().min(1).max(500)).min(1).max(12),
        title: z.string().min(1).max(180),
      })
      .strict(),
    scan: z
      .object({
        createdAt: z.string().max(100),
        provider: z.string().max(100),
        riskLevel: riskSchema,
        sourceLabel: z.string().max(1_000),
        status: z.string().max(100),
        title: z.string().max(2_000),
      })
      .strict(),
  })
  .strict();

export async function POST(request: Request) {
  const auth = await requireAdminSession(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const input = bodySchema.parse(await request.json());
    const report = await generateInDepthReport({
      ...input,
      session: auth.session,
    });
    return Response.json(
      { report },
      {
        headers: {
          ...authHeaders(auth),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "Dữ liệu tạo báo cáo chưa hợp lệ.",
          details: z.treeifyError(error),
        },
        { status: 400, headers: authHeaders(auth) },
      );
    }
    console.error("AI report generation failed", safeProviderDiagnostic(error));
    return Response.json(
      {
        error: publicErrorMessage(
          error,
          "Không thể soạn báo cáo chuyên sâu bằng AI lúc này.",
        ),
      },
      { status: 500, headers: authHeaders(auth) },
    );
  }
}

function safeProviderDiagnostic(error: unknown) {
  if (!(error instanceof Error)) return { name: "UnknownError" };
  const candidate = error as Error & { code?: unknown; statusCode?: unknown };
  return {
    code:
      typeof candidate.code === "string"
        ? candidate.code.slice(0, 80)
        : undefined,
    name: error.name.slice(0, 80),
    statusCode:
      typeof candidate.statusCode === "number"
        ? candidate.statusCode
        : undefined,
  };
}
