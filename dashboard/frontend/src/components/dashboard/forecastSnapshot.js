const riskScores = { Low: 1, Moderate: 2, High: 3, Severe: 4, "No Travel": 5 };

export function getCheckpointForecast(checkpoint, offset) {
  return checkpoint?.forecast_48h?.find((forecast) => forecast.offset_hours === offset)
    ?? checkpoint?.forecast_48h?.[offset]
    ?? null;
}

export function buildForecastSnapshot(checkpoints = [], offset = 0) {
  const forecasts = checkpoints.map((checkpoint) => getCheckpointForecast(checkpoint, offset)).filter(Boolean);
  const available = forecasts.filter((forecast) => forecast.available && forecast.weather
    && [forecast.weather.wind_mph, forecast.weather.rain_in_hr, forecast.weather.snow_in_hr].every(Number.isFinite));
  const average = (key) => available.length
    ? available.reduce((total, forecast) => total + forecast.weather[key], 0) / available.length
    : null;
  const highestRisk = available.reduce((highest, forecast) =>
    (riskScores[forecast.risk_level] ?? 0) > (riskScores[highest] ?? 0) ? forecast.risk_level : highest, "Unknown");

  return {
    forecastTime: forecasts.find((forecast) => forecast.forecast_time)?.forecast_time ?? null,
    averageWindMph: average("wind_mph"),
    averageRainInHr: average("rain_in_hr"),
    averageSnowInHr: average("snow_in_hr"),
    overallRisk: highestRisk,
    availableCount: available.length,
    totalCheckpoints: checkpoints.length,
  };
}
