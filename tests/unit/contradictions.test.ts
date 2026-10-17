import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CALIBRATED_JEV_MODEL } from "../../src/lib/report/certainty.ts";
import { findContradictions } from "../../src/lib/report/contradictions.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import { footerState } from "../../src/lib/report/view.ts";
import type { AreaVerdict } from "../../src/lib/report/verdict.ts";

const M = CALIBRATED_JEV_MODEL;
const user = (key: string, value: string): Fact => ({ key, value, source: { origin: "user", quote: value } });
const estimated = (key: string, value: string): Fact => ({
  key,
  value,
  source: { origin: "gpt", model: "gpt", assumptions: [], plausibility: { noul: 0.8, model: M } },
});
const ids = (facts: Fact[]) => findContradictions(facts).map((c) => c.id);

describe("findContradictions", () => {
  it("online con local o con nivel de alquiler", () => {
    assert.deepEqual(ids([user("geographic_scope", "Online"), user("offering_type", "Physical venue")]), ["online_with_premises"]);
    assert.deepEqual(ids([user("geographic_scope", "Online"), estimated("rent_level", "Average")]), ["online_with_premises"]);
  });

  it("comisión sin manejar dinero de terceros", () => {
    assert.deepEqual(ids([user("revenue_model", "Transaction commission"), user("money_handling", "No third-party money")]), [
      "commission_without_money",
    ]);
  });

  it("marketplace con local o producto propio", () => {
    assert.deepEqual(ids([user("customer_segment", "Two-sided marketplace"), user("offering_type", "Physical product")]), [
      "marketplace_with_own_offer",
    ]);
  });

  it("combinaciones posibles no son contradicción", () => {
    assert.deepEqual(ids([user("geographic_scope", "Local"), user("offering_type", "Physical venue")]), []);
    assert.deepEqual(ids([user("revenue_model", "Transaction commission"), user("money_handling", "Holds or intermediates funds")]), []);
    assert.deepEqual(ids([user("customer_segment", "Two-sided marketplace"), user("offering_type", "Platform or marketplace")]), []);
  });

  it("indica si interviene un dato estimado", () => {
    const [found] = findContradictions([user("revenue_model", "Transaction commission"), estimated("money_handling", "No third-party money")]);
    assert.equal(found.estimated, true);
  });

  it("lo no sabido no cuenta para contradecir", () => {
    assert.deepEqual(ids([user("geographic_scope", "Online"), user("offering_type", "Not specified")]), []);
  });
});

describe("footerState con contradicciones", () => {
  const v = (verdict: AreaVerdict["verdict"]) => ({ verdict }) as AreaVerdict;
  it("las contradicciones mandan sobre todo lo demás", () => {
    assert.equal(footerState([v("needs_info"), v("risk")], 1), "contradictions");
  });
});