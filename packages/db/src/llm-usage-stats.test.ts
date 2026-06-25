import { describe, expect, test } from "bun:test";
import { createInMemoryDatabaseAdapter } from "./adapters/in-memory";
import { createSqliteDatabase } from "./adapters/sqlite";
import { LLM_USAGE_STATS_ID } from "./constants";

describe("llm usage stats persistence", () => {
  test("in-memory adapter accumulates usage deltas", async () => {
    const db = createInMemoryDatabaseAdapter();
    const trackedSince = "2026-06-05T00:00:00.000Z";

    await db.incrementLlmUsageStats(
      {
        requestCount: 1,
        inputTokens: 100,
        outputTokens: 50,
        estimatedCostUsd: 0.01,
      },
      trackedSince,
    );
    await db.incrementLlmUsageStats(
      {
        requestCount: 1,
        inputTokens: 200,
        outputTokens: 75,
        estimatedCostUsd: 0.02,
      },
      trackedSince,
    );

    const stats = await db.getLlmUsageStats();
    const byModel = await db.listLlmUsageStatsByModel();
    expect(stats).toEqual({
      id: LLM_USAGE_STATS_ID,
      requestCount: 2,
      inputTokens: 300,
      outputTokens: 125,
      estimatedCostUsd: 0.03,
      trackedSince,
      updatedAt: expect.any(String),
    });
    expect(byModel).toEqual([]);
  });

  test("sqlite adapter accumulates usage deltas", async () => {
    const database = await createSqliteDatabase(":memory:");
    const db = database.adapter;
    const trackedSince = "2026-06-05T00:00:00.000Z";

    try {
      await db.incrementLlmUsageStats(
        {
          requestCount: 2,
          inputTokens: 400,
          outputTokens: 100,
          estimatedCostUsd: 0.05,
        },
        trackedSince,
      );

      const stats = await db.getLlmUsageStats();
      const byModel = await db.listLlmUsageStatsByModel();
      expect(stats).toEqual({
        id: LLM_USAGE_STATS_ID,
        requestCount: 2,
        inputTokens: 400,
        outputTokens: 100,
        estimatedCostUsd: 0.05,
        trackedSince,
        updatedAt: expect.any(String),
      });
      expect(byModel).toEqual([]);
    } finally {
      database.close();
    }
  });

  test("adapters accumulate per-model usage deltas", async () => {
    const database = await createSqliteDatabase(":memory:");
    const db = database.adapter;
    const trackedSince = "2026-06-05T00:00:00.000Z";

    try {
      await db.incrementLlmUsageStatsByModel(
        "gpt-4o",
        {
          requestCount: 1,
          inputTokens: 100,
          outputTokens: 50,
          estimatedCostUsd: 0.01,
        },
        trackedSince,
      );
      await db.incrementLlmUsageStatsByModel(
        "gpt-4o-mini",
        {
          requestCount: 2,
          inputTokens: 120,
          outputTokens: 30,
          estimatedCostUsd: 0.005,
        },
        trackedSince,
      );
      await db.incrementLlmUsageStatsByModel(
        "gpt-4o",
        {
          requestCount: 1,
          inputTokens: 80,
          outputTokens: 20,
          estimatedCostUsd: 0.008,
        },
        trackedSince,
      );

      expect(await db.listLlmUsageStatsByModel()).toEqual([
        {
          modelId: "gpt-4o",
          requestCount: 2,
          inputTokens: 180,
          outputTokens: 70,
          estimatedCostUsd: 0.018000000000000002,
          trackedSince,
          updatedAt: expect.any(String),
        },
        {
          modelId: "gpt-4o-mini",
          requestCount: 2,
          inputTokens: 120,
          outputTokens: 30,
          estimatedCostUsd: 0.005,
          trackedSince,
          updatedAt: expect.any(String),
        },
      ]);
    } finally {
      database.close();
    }
  });
});
