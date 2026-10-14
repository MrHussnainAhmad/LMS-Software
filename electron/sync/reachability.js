// Shared by API transports and the health monitor without importing the sync
// engine (which would introduce a circular dependency).
let lastResponseAt = 0;
function noteServerResponse(response) {
  // Auth errors still prove the API is reachable; server errors do not.
  if (response.status >= 200 && response.status < 500) lastResponseAt = Date.now();
}
function hasRecentServerResponse(maxAgeMs) {
  return lastResponseAt > 0 && Date.now() - lastResponseAt < maxAgeMs;
}
module.exports = { noteServerResponse, hasRecentServerResponse };
