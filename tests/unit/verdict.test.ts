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

describe("ninguna regla da watch", () => {
  it("con datos variados, solo verde, rojo o gris", () => {
    const facts = [
      known("offering_type", "Physical venue"), known("revenue_model", "Subscription"),
      known("customer_segment", "Mixed segments"), known("acquisition_channel", "Paid advertising"),
      known("founder_experience", "2-5 years"), known("time_commitment", "Full time"),
      known("validation_stage", "Prototype"), estimated("competition", "Few competitors"),
      known("regulatory_load", "Moderate (licenses, data protection)"), estimated("rent_level", "Average"),
    ];
    for (const v of areaVerdicts(facts)) assert.notEqual(v.verdict, "watch", v.area);
  });
});

describe("Money", () => {
  it("sin presupuesto o sin coste de arranque: needs_info con lo que falta", () => {
    const v = verdictOf("money", []);
    assert.equal(v.verdict, "needs_info");
    assert.deepEqual(v.missing, ["budget_band", "startup_cost_eur"]);
  });

  it("no llega o va justo: rojo", () => {
    assert.equal(verdictOf("money", [budget(30000), range("startup_cost_eur", 45000, 60000)]).reason, "money.short");
    const tight = verdictOf("money", [budget(50000), range("startup_cost_eur", 45000, 60000)]);
    assert.deepEqual([tight.verdict, tight.reason], ["risk", "money.tight"]);
  });

  it("cubre y aguanta hasta el primer ingreso: verde", () => {
    const v = verdictOf("money", [
      budget(100000),
      range("startup_cost_eur", 40000, 60000),
      range("monthly_fixed_costs_eur", 2000, 3000),
      known("time_to_revenue", "3-12 months"),
    ]);
    assert.equal(v.verdict, "strong");
    assert.equal(v.estimated, true);
  });

  it("cubre sin gastos fijos conocidos: verde, y los gastos quedan por concretar", () => {
    const v = verdictOf("money", [budget(100000), range("startup_cost_eur", 40000, 60000)]);
    assert.deepEqual([v.verdict, v.reason], ["strong", "money.runway_unknown"]);
    assert.ok(v.gaps.includes("monthly_fixed_costs_eur"));
    assert.equal(v.gaps.includes("budget_eur"), false, "el exacto es opcional");
  });
});

describe("Validation", () => {
  it("con clientes: verde", () => {
    assert.equal(verdictOf("validation", [known("validation_stage", "MVP with customers")]).verdict, "strong");
  });

  it("sin clientes que paguen: rojo, con el motivo según la inversión", () => {
    assert.equal(verdictOf("validation", [known("validation_stage", "Idea only")]).reason, "validation.idea_only");
    assert.equal(verdictOf("validation", [known("validation_stage", "Prototype")]).reason, "validation.partial");
    assert.equal(
      verdictOf("validation", [known("validation_stage", "Idea only"), range("startup_cost_eur", 30000, 80000)]).reason,
      "validation.unvalidated_investment",
    );
    assert.equal(verdictOf("validation", [known("validation_stage", "Idea only")]).verdict, "risk");
  });

  it("sin dato: needs_info", () => {
    assert.equal(verdictOf("validation", []).verdict, "needs_info");
  });
});

describe("Competition", () => {
  it("nicho o pocos: verde, sin depender del diferenciador", () => {
    assert.equal(verdictOf("competition", [known("competition", "Niche with no clear competitors")]).verdict, "strong");
    assert.equal(verdictOf("competition", [estimated("competition", "Few competitors")]).verdict, "strong");
  });

  it("saturado o dominado: rojo, tenga o no diferenciador", () => {
    for (const value of ["Crowded market", "Dominated by large players"]) {
      assert.equal(verdictOf("competition", [estimated("competition", value), known("differentiator", "Technology or IP")]).verdict, "risk");
    }
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

  it("normal o por debajo: verde; por encima o prime: rojo, sin mirar el dinero", () => {
    assert.equal(verdictOf("location", [venue, estimated("rent_level", "Average")]).verdict, "strong");
    assert.equal(verdictOf("location", [venue, estimated("rent_level", "Above average")]).verdict, "risk");
    assert.equal(
      verdictOf("location", [venue, estimated("rent_level", "Prime location"), budget(500000), range("startup_cost_eur", 50000, 80000)]).reason,
      "location.prime",
    );
  });

  it("un nivel de alquiler descartado por Jev no cuenta", () => {
    assert.equal(verdictOf("location", [venue, estimated("rent_level", "Prime location", 0.1)]).verdict, "needs_info");
  });
});

describe("áreas que aparecen según los datos", () => {
  it("Regulation: moderada verde; pesada, crítica o custodia de fondos, rojo", () => {
    assert.equal(verdictOf("regulation", [known("regulatory_load", "Moderate (licenses, data protection)")]).verdict, "strong");
    assert.equal(verdictOf("regulation", [known("regulatory_load", "Heavy (health, finance, food)")]).reason, "regulation.heavy");
    assert.equal(verdictOf("regulation", [known("money_handling", "Holds or intermediates funds")]).verdict, "risk");
  });

  it("Dependencies y Team: si aparecen, rojo", () => {
    assert.equal(verdictOf("dependencies", [known("third_party_dependency", "Depends on a platform")]).verdict, "risk");
    assert.equal(verdictOf("dependencies", [known("third_party_dependency", "Critical dependency")]).reason, "dependencies.critical");
    assert.equal(verdictOf("team", [known("team_requirement", "Specialized profiles required")]).verdict, "risk");
  });
});

describe("Concept", () => {
  const base = [known("offering_type", "Software"), known("revenue_model", "Subscription")];

  it("sin qué ofrece o cómo gana dinero: needs_info", () => {
    assert.deepEqual(verdictOf("concept", [known("offering_type", "Software")]).missing, ["revenue_model"]);
  });

  it("precio, calidad o algo propio: verde; diferenciador desconocido queda por concretar", () => {
    for (const differentiator of ["Price", "Quality or experience", "Specialized niche"]) {
      assert.equal(verdictOf("concept", [...base, known("differentiator", differentiator)]).verdict, "strong", differentiator);
    }
    const unknown = verdictOf("concept", base);
    assert.equal(unknown.verdict, "strong");
    assert.ok(unknown.gaps.includes("differentiator"));
  });

  it("sin nada propio (sabido): rojo", () => {
    assert.equal(verdictOf("concept", [...base, known("differentiator", "None identified")]).reason, "concept.no_differentiator");
  });
});

describe("Market", () => {
  const consumers = known("customer_segment", "Consumers");

  it("sin cliente: needs_info", () => {
    assert.equal(verdictOf("market", []).verdict, "needs_info");
  });

  it("coherente, mezclado, con anuncios o con datos que faltan: verde", () => {
    assert.equal(verdictOf("market", [consumers, known("geographic_scope", "Hyper-local"), estimated("acquisition_channel", "Foot traffic or location")]).verdict, "strong");
    assert.equal(verdictOf("market", [known("customer_segment", "Mixed segments"), known("acquisition_channel", "Paid advertising")]).verdict, "strong");
    const partial = verdictOf("market", [consumers]);
    assert.equal(partial.verdict, "strong");
    assert.deepEqual(partial.gaps, ["geographic_scope", "acquisition_channel"]);
  });

  it("combinaciones que no encajan: rojo", () => {
    const local = (scope: string) => [consumers, known("geographic_scope", scope), known("acquisition_channel", "Foot traffic or location")];
    assert.equal(verdictOf("market", local("Online")).verdict, "risk");
    assert.equal(verdictOf("market", local("National")).verdict, "risk");
    assert.equal(
      verdictOf("market", [known("customer_segment", "Public sector"), known("acquisition_channel", "Online self-service")]).verdict,
      "risk",
    );
  });
});

describe("Founder (You)", () => {
  it("sin experiencia o dedicación: needs_info", () => {
    assert.deepEqual(verdictOf("founder", []).missing, ["founder_experience", "time_commitment"]);
  });

  it("experiencia y dedicación suficientes: verde; perfil desconocido por concretar", () => {
    const v = verdictOf("founder", [known("founder_experience", "Over 5 years"), known("time_commitment", "Full time")]);
    assert.equal(v.verdict, "strong");
    assert.ok(v.gaps.includes("founder_profile"));
  });

  it("poca experiencia, menos de 20 h o equipo grande sin perfil de gestión: rojo", () => {
    assert.equal(verdictOf("founder", [known("founder_experience", "Under 2 years"), known("time_commitment", "Full time")]).verdict, "risk");
    assert.equal(verdictOf("founder", [known("founder_experience", "Over 5 years"), known("time_commitment", "10-20 h/week")]).verdict, "risk");
    assert.equal(
      verdictOf("founder", [
        known("founder_experience", "Over 5 years"),
        known("founder_profile", "Technical"),
        known("time_commitment", "Full time"),
        known("team_requirement", "Large team"),
      ]).verdict,
      "risk",
    );
  });
});