function clamp01(x) {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function mapEnum(value, map, fieldName) {
  if (!(value in map)) {
    const allowed = Object.keys(map).join(", ");
    throw new Error(`Invalid ${fieldName}. Allowed: ${allowed}`);
  }
  return map[value];
}

function validateInput(input) {
  const errors = [];

  const required = [
    "concept",
    "release_plan",
    "promo_rating_0_10",
    "social_activity",
    "gigs_last_12m",
    "ready_tracks_next_12m",
    "back_catalog",
    "team",
    "production_autonomy",
    "worldwide_potential",
  ];

  for (const k of required) {
    if (!(k in input)) errors.push(`Missing field: ${k}`);
  }

  if ("promo_rating_0_10" in input) {
    const v = input.promo_rating_0_10;
    if (typeof v !== "number" || Number.isNaN(v) || v < 0 || v > 10) {
      errors.push("promo_rating_0_10 must be a number in range 0..10");
    }
  }

  if ("gigs_last_12m" in input) {
    const v = input.gigs_last_12m;
    if (!Number.isInteger(v) || v < 0) errors.push("gigs_last_12m must be an integer >= 0");
  }

  if ("ready_tracks_next_12m" in input) {
    const v = input.ready_tracks_next_12m;
    if (!Number.isInteger(v) || v < 0)
      errors.push("ready_tracks_next_12m must be an integer >= 0");
  }

  if (errors.length > 0) {
    const err = new Error("ValidationError");
    err.code = "VALIDATION_ERROR";
    err.details = errors;
    throw err;
  }
}

function getSubscores(input) {
  validateInput(input);

  const ConceptScore = mapEnum(
    input.concept,
    { no: 0, weak: 0.5, yes: 1 },
    "concept"
  );

  const ReleasePlanScore = mapEnum(
    input.release_plan,
    { no: 0, draft: 0.5, yes: 1 },
    "release_plan"
  );

  const PromoRatingScore = clamp01(input.promo_rating_0_10 / 10);

  const SocialActivityScore = mapEnum(
    input.social_activity,
    { inactive: 0, low: 0.5, good: 1 },
    "social_activity"
  );

  const StageExperienceScore = input.gigs_last_12m >= 10 ? 1 : 0;

  let ReadyMaterialScore = 0;
  if (input.ready_tracks_next_12m >= 10) ReadyMaterialScore = 1;
  else if (input.ready_tracks_next_12m >= 5) ReadyMaterialScore = 0.5;

  const BackCatalogScore = mapEnum(
    input.back_catalog,
    { none: 0, "10_tracks_or_more": 0.5, "10_releases_or_more": 1 },
    "back_catalog"
  );

  const TeamScore = mapEnum(
    input.team,
    { none: 0, partial: 0.5, full: 1 },
    "team"
  );

  const ProductionAutonomyScore = mapEnum(
    input.production_autonomy,
    { does_not_write: 0, external_needed: 0.5, self_produces: 1 },
    "production_autonomy"
  );

  const WorldwidePotentialScore = mapEnum(
    input.worldwide_potential,
    { no: 0, yes: 1 },
    "worldwide_potential"
  );

  return {
    ConceptScore,
    ReleasePlanScore,
    PromoRatingScore,
    SocialActivityScore,
    StageExperienceScore,
    ReadyMaterialScore,
    BackCatalogScore,
    TeamScore,
    ProductionAutonomyScore,
    WorldwidePotentialScore,
  };
}

const WEIGHTS = {
  ConceptScore: 0.12,
  ReleasePlanScore: 0.08,
  PromoRatingScore: 0.12,
  SocialActivityScore: 0.10,
  StageExperienceScore: 0.06,
  ReadyMaterialScore: 0.10,
  BackCatalogScore: 0.06,
  TeamScore: 0.10,
  ProductionAutonomyScore: 0.12,
  WorldwidePotentialScore: 0.14,
};

function computeVerdictScore(subscores) {
  let sum = 0;
  for (const k of Object.keys(WEIGHTS)) {
    sum += WEIGHTS[k] * subscores[k];
  }
  const score = 100 * sum;
  return Math.round(score * 10) / 10;
}

function computeGates(subscores) {
  const gate_flags = {
    missing_concept: subscores.ConceptScore === 0,
    missing_release_plan: subscores.ReleasePlanScore === 0,
    inactive_socials: subscores.SocialActivityScore === 0,
    not_enough_ready_tracks: subscores.ReadyMaterialScore === 0,
    no_worldwide_potential: subscores.WorldwidePotentialScore === 0,
    gate_a_block: false,
    gate_b_block: false,
    full_cycle_blocked: false,
  };

  gate_flags.gate_a_block =
    gate_flags.missing_concept ||
    gate_flags.missing_release_plan ||
    gate_flags.inactive_socials ||
    gate_flags.not_enough_ready_tracks;

  gate_flags.gate_b_block = gate_flags.no_worldwide_potential;

  gate_flags.full_cycle_blocked = gate_flags.gate_a_block || gate_flags.gate_b_block;

  return gate_flags;
}

function computeDecision(score, gate_flags) {
  if (score >= 75 && !gate_flags.full_cycle_blocked) return "FULL_CYCLE";
  if (score >= 55) return "SERVICE_ONLY";
  if (score >= 40) return "WATCHLIST";
  return "REJECT";
}

function evaluate(input) {
  const subscores = getSubscores(input);
  const verdict_score = computeVerdictScore(subscores);
  const gate_flags = computeGates(subscores);
  const decision = computeDecision(verdict_score, gate_flags);

  return { verdict_score, decision, subscores, gate_flags };
}

module.exports = { evaluate, getSubscores, computeVerdictScore, computeDecision, computeGates };
