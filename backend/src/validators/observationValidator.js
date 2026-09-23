const VALID_TEST_TYPES = ['TDS', 'pH', 'turbidity', 'coliform'];

function validateObservation(data) {
  const errors = [];

  if (!data.clientId)    errors.push('clientId is required');
  if (!data.householdId) errors.push('householdId is required');

  if (!data.testType) {
    errors.push('testType is required');
  } else if (!VALID_TEST_TYPES.includes(data.testType)) {
    errors.push(`testType must be one of: ${VALID_TEST_TYPES.join(', ')}`);
  }

  if (data.result === undefined || data.result === null) {
    errors.push('result is required');
  } else if (typeof data.result !== 'number' || !isFinite(data.result)) {
    errors.push('result must be a finite number');
  }

  if (!data.testedAt) {
    errors.push('testedAt is required');
  } else if (isNaN(Date.parse(data.testedAt))) {
    errors.push('testedAt must be a valid ISO 8601 date');
  }

  if (!data.wardId) errors.push('wardId is required');

  if (data.location !== undefined && data.location !== null) {
    const { lat, lng } = data.location;
    if (lat === undefined || lng === undefined) {
      errors.push('location must include both lat and lng');
    } else {
      if (typeof lat !== 'number' || !isFinite(lat) || lat < -90 || lat > 90) {
        errors.push('location.lat must be a finite number between -90 and 90');
      }
      if (typeof lng !== 'number' || !isFinite(lng) || lng < -180 || lng > 180) {
        errors.push('location.lng must be a finite number between -180 and 180');
      }
    }
  }

  return errors;
}

module.exports = { validateObservation, VALID_TEST_TYPES };
