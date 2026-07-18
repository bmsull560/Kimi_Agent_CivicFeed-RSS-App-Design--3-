import { describe, it, expect } from "vitest";
import {
  applyPlanToSource,
  exceedsMassChangeGuard,
  parseReport,
  planStatusUpdates,
  summarizePlan,
  type ApplyObservation,
  type CatalogStatus,
} from "./apply-feed-statuses.js";

function observation(overrides: Partial<ApplyObservation> = {}): ApplyObservation {
  return {
    id: "feed-001",
    operationalStatus: "blocked",
    transportStatus: "not_found",
    httpStatus: 404,
    parseStatus: "not_attempted",
    contentType: null,
    ...overrides,
  };
}

function statuses(entries: Array<[string, CatalogStatus]>): Map<string, CatalogStatus> {
  return new Map(entries);
}

describe("parseReport", () => {
  it("accepts a well-formed report", () => {
    const report = { validatedAt: "2026-07-17T00:00:00Z", results: [observation()] };
    const parsed = parseReport(report);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("feed-001");
  });

  it("rejects a report without a results array", () => {
    expect(() => parseReport({ validatedAt: "2026-07-17T00:00:00Z" })).toThrow(/results/);
    expect(() => parseReport(null)).toThrow();
    expect(() => parseReport("not a report")).toThrow();
  });

  it("rejects a report missing validatedAt", () => {
    expect(() => parseReport({ results: [observation()] })).toThrow(/validatedAt/);
  });

  it("fails closed on old-schema results without operationalStatus", () => {
    const oldSchemaResult = {
      id: "feed-001",
      status: "blocked",
      transportStatus: "not_found",
      httpStatus: 404,
      parseStatus: "not_attempted",
      contentType: null,
    };
    const report = { validatedAt: "2026-07-17T00:00:00Z", results: [oldSchemaResult] };
    expect(() => parseReport(report)).toThrow(/operationalStatus/);
  });

  it("rejects unknown operationalStatus values", () => {
    const report = {
      validatedAt: "2026-07-17T00:00:00Z",
      results: [observation({ operationalStatus: "melted" as never })],
    };
    expect(() => parseReport(report)).toThrow(/operationalStatus/);
  });
});

describe("planStatusUpdates", () => {
  it("applies a genuine permanent failure as blocked", () => {
    const plan = planStatusUpdates(
      [observation({ transportStatus: "not_found", httpStatus: 404 })],
      statuses([["feed-001", "working"]])
    );
    expect(plan.changes).toEqual([{ id: "feed-001", from: "working", to: "blocked" }]);
    expect(plan.preserved).toEqual([]);
  });

  it("applies a genuine unsupported-format failure as blocked", () => {
    const plan = planStatusUpdates(
      [
        observation({
          operationalStatus: "unsupported",
          transportStatus: "ok",
          httpStatus: 200,
          parseStatus: "unsupported_format",
          contentType: "application/pdf",
        }),
      ],
      statuses([["feed-001", "working"]])
    );
    expect(plan.changes).toEqual([{ id: "feed-001", from: "working", to: "blocked" }]);
  });

  it("preserves a working feed on a DVIDS-style WAF challenge (202 + HTML)", () => {
    const plan = planStatusUpdates(
      [
        observation({
          transportStatus: "ok",
          httpStatus: 202,
          parseStatus: "unparseable",
          contentType: "text/html; charset=UTF-8",
        }),
      ],
      statuses([["feed-001", "working"]])
    );
    expect(plan.changes).toEqual([]);
    expect(plan.preserved).toHaveLength(1);
    expect(plan.preserved[0].id).toBe("feed-001");
    expect(plan.preserved[0].reason).toMatch(/challenge|interstitial/i);
  });

  it("preserves a working feed on a 403 challenge", () => {
    const plan = planStatusUpdates(
      [observation({ transportStatus: "blocked", httpStatus: 403 })],
      statuses([["feed-001", "working"]])
    );
    expect(plan.changes).toEqual([]);
    expect(plan.preserved[0].reason).toMatch(/challenge|401\/403/i);
  });

  it("preserves a working feed on transient failures", () => {
    for (const transportStatus of ["timeout", "network_error", "too_many_redirects"] as const) {
      const plan = planStatusUpdates(
        [observation({ transportStatus, httpStatus: 0 })],
        statuses([["feed-001", "working"]])
      );
      expect(plan.changes).toEqual([]);
      expect(plan.preserved).toHaveLength(1);
    }
  });

  it("recovers a blocked feed to working on a healthy observation", () => {
    const plan = planStatusUpdates(
      [
        observation({
          operationalStatus: "healthy",
          transportStatus: "ok",
          httpStatus: 200,
          parseStatus: "ok",
        }),
      ],
      statuses([["feed-001", "blocked"]])
    );
    expect(plan.changes).toEqual([{ id: "feed-001", from: "blocked", to: "working" }]);
  });

  it("ignores observations for feeds not in the catalog", () => {
    const plan = planStatusUpdates([observation({ id: "feed-999" })], statuses([]));
    expect(plan.changes).toEqual([]);
    expect(plan.ignored).toEqual(["feed-999"]);
  });
});

describe("exceedsMassChangeGuard", () => {
  it("allows small transition sets", () => {
    expect(exceedsMassChangeGuard(10, 594)).toBe(false);
    expect(exceedsMassChangeGuard(29, 594)).toBe(false);
  });

  it("flags anomalously large transition sets", () => {
    expect(exceedsMassChangeGuard(177, 594)).toBe(true);
    expect(exceedsMassChangeGuard(30, 594)).toBe(true);
    expect(exceedsMassChangeGuard(11, 50)).toBe(true);
  });
});

describe("applyPlanToSource", () => {
  const source = `export const feeds = [
  {
    id: "feed-001",
    name: "A",
    status: "working" as const,
    rssUrl: "https://a.gov/rss",
  },
  {
    id: "feed-002",
    name: "B",
    status: "blocked" as const,
    rssUrl: "https://b.gov/rss",
  },
];
export const feedStats = { byStatus: { unverified: 0, working: 1, blocked: 1 } };
`;

  it("applies status changes and recomputes byStatus", () => {
    const plan = planStatusUpdates(
      [
        observation({ id: "feed-001" }),
        observation({
          id: "feed-002",
          operationalStatus: "healthy",
          transportStatus: "ok",
          httpStatus: 200,
          parseStatus: "ok",
        }),
      ],
      statuses([
        ["feed-001", "working"],
        ["feed-002", "blocked"],
      ])
    );
    const { source: updated, changed } = applyPlanToSource(source, plan);
    expect(changed).toBe(2);
    expect(updated).toContain('id: "feed-001",\n    name: "A",\n    status: "blocked" as const');
    expect(updated).toContain('id: "feed-002",\n    name: "B",\n    status: "working" as const');
    expect(updated).toContain("byStatus: { unverified: 0, working: 1, blocked: 1 }");
  });

  it("leaves the source untouched when there are no changes", () => {
    const plan = planStatusUpdates(
      [
        observation({
          id: "feed-001",
          transportStatus: "ok",
          httpStatus: 202,
          parseStatus: "unparseable",
          contentType: "text/html",
        }),
      ],
      statuses([["feed-001", "working"]])
    );
    const { source: updated, changed } = applyPlanToSource(source, plan);
    expect(changed).toBe(0);
    expect(updated).toBe(source);
  });
});

describe("summarizePlan", () => {
  it("counts transitions, preservations, and unchanged feeds", () => {
    const plan = planStatusUpdates(
      [
        observation({ id: "feed-001" }), // working -> blocked (permanent 404)
        observation({
          id: "feed-002",
          operationalStatus: "healthy",
          transportStatus: "ok",
          httpStatus: 200,
          parseStatus: "ok",
        }), // blocked -> working
        observation({
          id: "feed-003",
          transportStatus: "ok",
          httpStatus: 202,
          parseStatus: "unparseable",
          contentType: "text/html",
        }), // preserved (WAF challenge)
        observation({
          id: "feed-004",
          operationalStatus: "healthy",
          transportStatus: "ok",
          httpStatus: 200,
          parseStatus: "ok",
        }), // already working, unchanged
      ],
      statuses([
        ["feed-001", "working"],
        ["feed-002", "blocked"],
        ["feed-003", "working"],
        ["feed-004", "working"],
      ])
    );
    expect(summarizePlan(plan)).toEqual({
      considered: 4,
      toBlocked: 1,
      toWorking: 1,
      preserved: 1,
      unchanged: 1,
      ignored: 0,
    });
  });
});
