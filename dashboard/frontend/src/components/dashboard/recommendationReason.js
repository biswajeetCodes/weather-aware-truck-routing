import { formatDuration } from "./formatters.js";

const metricValue = (route, key) => Number(route?.risk_summary?.[key] ?? 0);

export function buildRecommendationReason(recommendedRoute, routes = []) {
  const comparisonRoute = routes
    .filter((route) => route.route_id !== recommendedRoute.route_id)
    .sort((first, second) => (first.rank ?? Number.MAX_SAFE_INTEGER) - (second.rank ?? Number.MAX_SAFE_INTEGER))[0];

  if (!comparisonRoute) {
    return "This is the only genuine route returned by the routing provider, so it is recommended by default.";
  }

  const severe = metricValue(recommendedRoute, "severe_miles");
  const otherSevere = metricValue(comparisonRoute, "severe_miles");
  if (severe !== otherSevere) {
    return `Route ${recommendedRoute.route_id} ranks first because it has ${severe} severe-risk miles versus ${otherSevere} mi on Route ${comparisonRoute.route_id}. Severe exposure is the first priority.`;
  }

  const high = metricValue(recommendedRoute, "high_miles");
  const otherHigh = metricValue(comparisonRoute, "high_miles");
  if (high !== otherHigh) {
    return `Both routes have ${severe} severe-risk miles. Route ${recommendedRoute.route_id} wins the next comparison with ${high} high-risk miles versus ${otherHigh} mi on Route ${comparisonRoute.route_id}.`;
  }

  const average = metricValue(recommendedRoute, "average_risk_score");
  const otherAverage = metricValue(comparisonRoute, "average_risk_score");
  if (average !== otherAverage) {
    return `Severe and high-risk mileage are equal. Route ${recommendedRoute.route_id} ranks first with the lower distance-weighted average risk: ${average}/5 versus ${otherAverage}/5 on Route ${comparisonRoute.route_id}.`;
  }

  const duration = Number(recommendedRoute.duration_minutes ?? 0);
  const otherDuration = Number(comparisonRoute.duration_minutes ?? 0);
  if (duration !== otherDuration) {
    return `The compared routes have equal severe miles, high-risk miles, and average weather risk. Shorter travel time breaks the tie: ${formatDuration(duration)} versus ${formatDuration(otherDuration)} on Route ${comparisonRoute.route_id}.`;
  }

  return "The compared routes are equal on all four required ranking metrics. The backend uses the provider route order only as a deterministic exact-tie fallback.";
}
