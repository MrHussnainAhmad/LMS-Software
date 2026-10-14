const { getMeta } = require('../db');
const { API_BASE_URL } = require('../config');
const { noteServerResponse } = require('./reachability');

const BASE_URL = API_BASE_URL;

async function remoteRequest(method, endpoint, body, tokenOverride) {
  const token = tokenOverride || getMeta('auth_token');
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const config = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, config);
  noteServerResponse(response);
  const contentType = response.headers.get('content-type') || '';

  let data = null;
  if (response.status !== 204) {
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
  }

  if (!response.ok) {
    const error = new Error(
      (data && (data.error || data.message)) || `Remote request failed (${response.status})`
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

module.exports = { remoteRequest, BASE_URL };
