'use strict';

const { URL } = require('url');
const got = require('got');

const { HTTPError } = got;
const r = got.extend({
  baseUrl: 'https://drive.google.com',
  headers: { 'x-drive-first-party': 'DriveWebUi' }
});

const JSON_PADDING = ')]}\'';

const isID = str => /^[a-zA-Z0-9_-]{8,64}$/.test(str);
const isUrl = str => /^https?:\/\//.test(str);
const isRedirect = code => code >= 300 & code < 400;

/**
 * Custom error class used for wrapping HTTP errors
 * @class GDriveError
 * @property {Error} reason original HTTP error
 * @augments Error
 */
class GDriveError extends Error {
  constructor(msg, reason) {
    super(msg);
    if (reason) this.reason = reason;
  }
}
Object.defineProperty(GDriveError.prototype, 'name', { value: GDriveError.name });

module.exports = {
  GDriveError,
  fetchInfo,
  getItemId
};

/**
 * @typedef {Object} FileInfo
 * @property {String} disposition Google Drive scan status
 * @property {String} fileName item filename
 * @property {String} downloadUrl generated direct download url
 * @property {String} scanResult Google Drive scan result
 * @property {Number} sizeBytes file size
 * @property {function(Dimensions): Promise<String>} thumbnailUrl
 */

/**
 * @typedef {Object} Dimensions
 * @property {Number} width
 * @property {Number} height
 */

/**
 * Fetch file info for given item id
 * @param {String} input Google Drive item view/open url or item id
 * @returns {Promise<FileInfo>} item info
 * @throws {GDriveError} throws on querying missing/private items
 * @throws {TypeError} throws on invalid ID provided
 *
 * @example
 * // fetch public video info
 * const info = await fetchInfo('https://drive.google.com/open?id=1ObJEVgO6Y4cFjfxszUb1LhdyeKrq_wGD');
 * console.log(info.downloadUrl);
 * //=> https://doc-00-6c-docs.googleusercontent.com/docs/securesc/…/1ObJEVgO6Y4cFjfxszUb1LhdyeKrq_wGD
 *
 * // generate poster url
 * const thumbnailUrl = await info.thumbnailUrl({ width: 1280, height: 720 });
 * //=> https://lh3.googleusercontent.com/9CwZKAQJ2U0CjjcIt5iZCqd-w-0d5ClJuYHVlS4olLrzt6AZr9rCdDu4jVzrz9b-tK5aswE4vdA=w1280-h720-p
 */
async function fetchInfo(input) {
  const id = isUrl(input) ? getItemId(input) : input;
  if (!isID(id)) throw new TypeError('Invalid ID provided.');
  const query = { id };
  try {
    const resp = await r.post('/uc', { query });
    const json = resp.body.replace(JSON_PADDING, '');
    const info = JSON.parse(json);
    info.thumbnailUrl = size => thumbnailUrl(id, size);
    return info;
  } catch (err) {
    if (!(err instanceof HTTPError)) throw err;
    if (err.statusCode === 404) {
      throw new GDriveError('Item is not found.', err);
    }
    if (redirectsTo(err, 'accounts.google.com')) {
      throw new GDriveError('Item is not accessible.', err);
    }
    throw new GDriveError('Failed to fetch info.', err);
  }
}

/**
 * Extract item id from Google Drive shareable link
 * @param {String} url Google Drive item view/open url
 * @returns {String} item id
 *
 * @example
 * // with _open_ link
 * const id = getItemId('https://drive.google.com/open?id=1ObJEVgO6Y4cFjfxszUb1LhdyeKrq_wGD');
 * //=> 1ObJEVgO6Y4cFjfxszUb1LhdyeKrq_wGD
 *
 * // with _view_ link
 * const id = getItemId('https://drive.google.com/file/d/1ObJEVgO6Y4cFjfxszUb1LhdyeKrq_wGD/view?usp=sharing');
 * //=> 1ObJEVgO6Y4cFjfxszUb1LhdyeKrq_wGD
 *
 * // with _edit_ link
 * const id = getItemId('https://docs.google.com/document/d/1OHA32KWVF21s0ahDMr8Qv2oDamQuLNoYkTN0N_RuRXA/edit');
 * // => 1OHA32KWVF21s0ahDMr8Qv2oDamQuLNoYkTN0N_RuRXA
 */
function getItemId(url) {
  const parsed = parseUrl(url);
  if (parsed.searchParams.has('id')) return parsed.searchParams.get('id');
  const segments = parsed.pathname.split('/');
  const index = segments.findIndex(it => it === 'd');
  if (index === -1) throw TypeError(`Failed to extract id from url: ${url}`, url);
  return segments[index + 1];
}

/**
 * Genearate thumbnail url for given item
 * @private
 * @param {String} id Google Drive item id
 * @param {Dimensions} options thumbnail dimensions
 * @returns {Promise<String>} thumbnail url
 * @throws {TypeError} throws on invalid dimensions provided
 */
async function thumbnailUrl(id, { width, height } = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new TypeError('Invalid dimensions provided.');
  }
  const sizingOptions = [`w${width}`, `h${height}`, 'p'].join('-');
  const query = { id, sz: sizingOptions };
  const resp = await r.get('/thumbnail', { query, followRedirect: false });
  return resp.headers.location;
}

function redirectsTo(err, hostname) {
  return isRedirect(err.statusCode) &&
    getHostname(err.response.headers.location) === hostname;
}

function getHostname(url) {
  const parsed = parseUrl(url);
  return parsed && parsed.hostname;
}

function parseUrl(url) {
  try {
    return new URL(url);
  } catch (err) {}
}
