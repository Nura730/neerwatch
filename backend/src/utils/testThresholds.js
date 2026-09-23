// Prototype demo thresholds — not real public-health guidelines.
// These exist solely to classify synthetic observations as passing or failing
// for demonstration purposes.
const FAIL_CHECKS = {
  TDS:       (r) => r > 500,
  pH:        (r) => r < 6.5 || r > 8.5,
  turbidity: (r) => r > 4,
  coliform:  (r) => r > 0,
};

function isFailing(testType, result) {
  const check = FAIL_CHECKS[testType];
  return check ? check(result) : false;
}

module.exports = { isFailing };
