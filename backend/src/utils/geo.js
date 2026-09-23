function toGeoJSON(lat, lng) {
  return { type: 'Point', coordinates: [lng, lat] };
}

function fromGeoJSON(geoJson) {
  if (!geoJson || !Array.isArray(geoJson.coordinates) || geoJson.coordinates.length < 2) {
    return null;
  }
  const [lng, lat] = geoJson.coordinates;
  return { lat, lng };
}

// Haversine distance in metres between two lat/lng points
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { toGeoJSON, fromGeoJSON, haversineDistance };
