import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CALIBRATED_JEV_MODEL } from "../../src/lib/report/certainty.ts";
import type { Fact } from "../../src/lib/report/facts.ts";
import { areaVerdicts } from "../../src/lib/report/verdict.ts";

const M = CALIBRATED_JEV_MODEL;

function known(key: string, value: unknown): Fact {
  return { key, value, source: { origin: "jev", model: M, confidence: 0.95, from: "user" } };
}

function estimated(key: string, value: unknown, noul = 0.8): Fact {
  return { key, value, source: { origin: "gpt", model: "gpt", assumptions: [], plausibility: { noul, model: M } } };
}

const budget = (amount: number): Fact => ({ key: "budget_eur", value: amount, source: { origin: "user", quote: "x" } });
const range = (key: string, min: number, max: number) => estimated(key, { min, max });

function verdictOf(area: string, facts: Fact[]) {
  const found = areaVerdicts(facts).find((v) => v.area === area);
  assert.ok(found, `el área ${area} no aparece`);
  return found;
}

describe("Money", () => {
  it("sin presupuesto o sin coste de arranque: needs_info con lo que falta", () => {
    const v = verdictOf("money", []);
    assert.equal(v.verdict, "needs_info");
    assert.deepEqual(v.missing, ["budget_band", "startup_cost_eur"]);
  });

  it("no llega al coste mínimo: risk", () => {
    assert.equal(verdictOf("money", [budget(30000), range("startup_cost_eur", 45000, 60000)]).verdict, "risk");
  });

  it("entre mínimo y máximo: watch", () => {
    assert.equal(verdictOf("money", [budget(50000), range("startup_cost_eur", 45000, 60000)]).reason, "money.tight");
  });

  it("cubre y aguanta hasta el primer ingreso: strong", () => {
    const v = verdictOf("money", [
      budget(100000),
      range("startup_cost_eur", 40000, 60000),
      range("monthly_fixed_costs_eur", 2000, 3000),
      known("time_to_revenue", "3-12 months"),
    ]);
    assert.equal(v.verdict, "strong");
    assert.equal(v.estimated, true);
  });

  it("cubre pero sin gastos fijos conocidos: watch, nunca strong", () => {
    const v = verdictOf("money", [budget(100000), range("startup_cost_eur", 40000, 60000)]);
    assert.equal(v.verdict, "watch");
    assert.equal(v.reason, "money.runway_unknown");
  });
});

describe("Validation", () => {
  it("validado: strong", () => {
    assert.equal(verdictOf("validation", [known("validation_stage", "MVP with customers")]).verdict, "strong");
  });

  it("solo idea con poca inversión: watch", () => {
    assert.equal(verdictOf("validation", [known("validation_stage", "Idea only")]).verdict, "watch");
  });

  it("solo idea con capital alto o arranque caro: risk", () => {
    assert.equal(
      verdictOf("validation", [
        known("validation_stage", "Idea only"),
        known("capital_intensity", "High (inventory, equipment, premises or R&D)"),
      ]).verdict,
      "risk",
    );
    assert.equal(
      verdictOf("validation", [known("validation_stage", "Idea only"), range("startup_cost_eur", 30000, 80000)]).reason,
      "validation.unvalidated_investment",
    );
  });

  it("sin dato: needs_info", () => {
    assert.equal(verdictOf("validation", []).verdict, "needs_info");
  });
});

describe("Competition", () => {
  it("nicho: strong", () => {
    assert.equal(verdictOf("competition", [known("competition", "Niche with no clear competitors")]).verdict, "strong");
  });

  it("saturado y solo precio o sin diferenciador: risk", () => {
    assert.equal(
      verdictOf("competition", [estimated("competition", "Crowded market"), known("differentiator", "Price")]).verdict,
      "risk",
    );
    assert.equal(verdictOf("competition", [estimated("competition", "Crowded market")]).verdict, "risk");
  });

  it("saturado pero con algo propio: watch", () => {
    assert.equal(
      verdictOf("competition", [
        estimated("competition", "Dominated by large players"),
        known("differentiator", "Technology or IP"),
      ]).verdict,
      "watch",
    );
  });

  it("una competencia descartada por Jev no cuenta: needs_info", () => {
    assert.equal(verdictOf("competition", [estimated("competition", "Crowded market", 0.1)]).verdict, "needs_info");
  });
});

describe("Location", () => {
  const venue = known("offering_type", "Physical venue");

  it("sin nivel de alquiler: needs_info", () => {
    const v = verdictOf("location", [venue]);
    assert.equal(v.verdict, "needs_info");
    assert.deepEqual(v.missing, ["rent_level"]);
  });

  it("alquiler normal: strong; por encima de la media: watch", () => {
    assert.equal(verdictOf("location", [venue, estimated("rent_level", "Average")]).verdict, "strong");
    assert.equal(verdictOf("location", [venue, estimated("rent_level", "Above average")]).verdict, "watch");
  });

  it("zona prime: watch si el dinero cubre, risk si va justo o no llega", () => {
    assert.equal(
      verdictOf("location", [venue, estimated("rent_level", "Prime location"), budget(200000), range("startup_cost_eur", 50000, 80000)]).reason,
      "location.prime",
    );
    assert.equal(
      verdictOf("location", [venue, estimated("rent_level", "Prime location"), budget(30000), range("startup_cost_eur", 50000, 80000)]).verdict,
      "risk",
    );
  });

  it("un nivel de alquiler descartado por Jev no cuenta", () => {
    assert.equal(verdictOf("location", [venue, estimated("rent_level", "Prime location", 0.1)]).verdict, "needs_info");
  });
});

describe("áreas que aparecen según los datos", () => {
  it("Regulation: custodiar fondos es risk; regulación pesada, watch", () => {
    assert.equal(verdictOf("regulation", [known("money_handling", "Holds or intermediates funds")]).verdict, "risk");
    assert.equal(verdictOf("regulation", [known("regulatory_load", "Heavy (health, finance, food)")]).verdict, "watch");
  });

  it("Dependencies: plataforma watch, proveedor crítico risk", () => {
    assert.equal(verdictOf("dependencies", [known("third_party_dependency", "Depends on a platform")]).verdict, "watch");
    assert.equal(verdictOf("dependencies", [known("third_party_dependency", "Critical dependency")]).verdict, "risk");
  });

  it("Team exigente: watch", () => {
    assert.equal(verdictOf("team", [known("team_requirement", "Large team")]).verdict, "watch");
  });
});

describe("Concept", () => {
  it("sin qué ofrece o cómo gana dinero: needs_info", () => {
    assert.deepEqual(verdictOf("concept", [known("offering_type", "Software")]).missing, ["revenue_model"]);
  });

  it("con diferenciador propio: strong", () => {
    const facts = [known("offering_type", "Software"), known("revenue_model", "Subscription"), known("differentiator", "Specialized niche")];
    assert.equal(verdictOf("concept", facts).verdict, "strong");
  });

  it("solo precio, solo calidad, ninguno o desconocido: watch, nunca risk", () => {
    const base = [known("offering_type", "Software"), known("revenue_model", "Subscription")];
    for (const differentiator of ["Price", "Quality or experience", "None identified"]) {
      assert.equal(verdictOf("concept", [...base, known("differentiator", differentiator)]).verdict, "watch", differentiator);
    }
    assert.equal(verdictOf("concept", base).verdict, "watch");
  });
});

describe("Market", () => {
  const consumers = known("customer_segment", "Consumers");

  it("sin cliente: needs_info", () => {
    assert.equal(verdictOf("market", []).verdict, "needs_info");
  });

  it("coherente: strong", () => {
    const facts = [consumers, known("geographic_scope", "Hyper-local"), estimated("acquisition_channel", "Foot traffic or location")];
    assert.equal(verdictOf("market", facts).verdict, "strong");
  });

  it("local físico con alcance online, o autoservicio para sector público: risk", () => {
    assert.equal(
      verdictOf("market", [consumers, known("geographic_scope", "Online"), known("acquisition_channel", "Foot traffic or location")]).verdict,
      "risk",
    );
    assert.equal(
      verdictOf("market", [known("customer_segment", "Public sector"), known("geographic_scope", "National"), known("acquisition_channel", "Online self-service")]).verdict,
      "risk",
    );
  });

  it("local con alcance nacional, cliente mixto, solo anuncios o datos que faltan: watch", () => {
    const local = (scope: string) => [consumers, known("geographic_scope", scope), known("acquisition_channel", "Foot traffic or location")];
    assert.equal(verdictOf("market", local("National")).verdict, "watch");
    assert.equal(verdictOf("market", [known("customer_segment", "Mixed segments"), known("geographic_scope", "Local"), known("acquisition_channel", "Direct sales")]).verdict, "watch");
    assert.equal(verdictOf("market", [consumers, known("geographic_scope", "Local"), known("acquisition_channel", "Paid advertising")]).verdict, "watch");
    assert.equal(verdictOf("market", [consumers, known("acquisition_channel", "Direct sales")]).verdict, "watch", "sin alcance");
  });
});

describe("Founder (You)", () => {
  it("sin experiencia o dedicación: needs_info", () => {
    assert.deepEqual(verdictOf("founder", []).missing, ["founder_experience", "time_commitment"]);
  });

  it("experiencia y dedicación suficientes: strong", () => {
    const facts = [known("founder_experience", "Over 5 years"), known("founder_profile", "Sector expert"), known("time_commitment", "Full time")];
    assert.equal(verdictOf("founder", facts).verdict, "strong");
  });

  it("menos de 10 h con lanzamiento en menos de 3 meses, o sin experiencia ni perfil: risk", () => {
    assert.equal(
      verdictOf("founder", [known("founder_experience", "Over 5 years"), known("time_commitment", "Under 10 h/week"), known("launch_timeline", "Under 3 months")]).verdict,
      "risk",
    );
    assert.equal(
      verdictOf("founder", [known("founder_experience", "None"), known("founder_profile", "No relevant background"), known("time_commitment", "Full time")]).verdict,
      "risk",
    );
  });

  it("poca experiencia, poca dedicación o equipo grande sin perfil de gestión: watch", () => {
    assert.equal(verdictOf("founder", [known("founder_experience", "Under 2 years"), known("time_commitment", "Full time")]).verdict, "watch");
    assert.equal(verdictOf("founder", [known("founder_experience", "Over 5 years"), known("time_commitment", "10-20 h/week")]).verdict, "watch");
    assert.equal(
      verdictOf("founder", [
        known("founder_experience", "Over 5 years"),
        known("founder_profile", "Technical"),
        known("time_commitment", "Full time"),
        known("team_requirement", "Large team"),
      ]).verdict,
      "watch",
    );
  });
});