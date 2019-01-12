'use strict';

const { GDriveError, getItemId, fetchInfo } = require('./');
const test = require('tape');

const isUrl = str => /^https?:\/\//.test(str);

test('Extract item id from `open` link', t => {
  const id = '1ObJEVgO6Y4cFjfxszUb1LhdyeKrq_wGD';
  const url = `https://drive.google.com/open?id=${id}`;
  t.plan(1);
  t.equals(getItemId(url), id, `extracted id=${id}`);
});

test('Extract item id from `view` link', t => {
  const id = '1ObJEVgO6Y4cFjfxszUb1LhdyeKrq_wGD';
  const url = `https://drive.google.com/file/d/${id}/view?usp=sharing`;
  t.plan(1);
  t.equals(getItemId(url), id, `extracted id=${id}`);
});

test('Use invalid item id', async t => {
  t.plan(2);
  try {
    await fetchInfo('Invalid **video** id');
  } catch (err) {
    t.equals(err.name, TypeError.name, 'throws TypeError');
    t.equals(err.message, 'Invalid ID provided.', `with message: ${err.message}`);
  }
});

test('Fetch public video info', async t => {
  const id = '1ObJEVgO6Y4cFjfxszUb1LhdyeKrq_wGD';
  const url = `https://drive.google.com/open?id=${id}`;
  const expected = {
    disposition: 'TOO_LARGE',
    fileName: 'big-buck-bunny-720p-h264.mp4',
    scanResult: 'WARNING',
    sizeBytes: 158008374
  };
  const info = await fetchInfo(url);
  t.plan(3);
  t.equals(info && info.sizeBytes, expected.sizeBytes, 'correct file fetched (size match)');
  t.equals(info && info.fileName, expected.fileName, 'correct filename');
  const downloadUrl = info && info.downloadUrl;
  t.assert(
    downloadUrl && isUrl(downloadUrl) && downloadUrl.endsWith(id),
    `correct url=${downloadUrl}`
  );
});

test('Fetch missing video info', async t => {
  const url = 'https://drive.google.com/open?id=dummy_gO6Y4cFjfxszUb1LhdyeKrq_wGD';
  t.plan(2);
  try {
    await fetchInfo(url);
  } catch (err) {
    t.equals(err.name, GDriveError.name, 'throws GDriveError');
    t.equals(err.message, 'Item is not found.', `with message: ${err.message}`);
  }
});

test('Fetch private video info', async t => {
  const url = 'https://drive.google.com/open?id=1-AszYwYOagB6hkvJVgz9cfkwd4nVG4rd';
  t.plan(2);
  try {
    await fetchInfo(url);
  } catch (err) {
    t.equals(err.name, GDriveError.name, 'throws GDriveError');
    t.equals(err.message, 'Item is not accessible.', `with message: ${err.message}`);
  }
});

test('Fetch picture info', async t => {
  const id = '1X-1PiZWpgZrpmBcVpyUPSuz_7hI383LC';
  const url = `https://drive.google.com/open?id=${id}`;
  const expected = {
    disposition: 'SCAN_CLEAN',
    fileName: 'flower.png',
    scanResult: 'OK',
    sizeBytes: 114590
  };
  const info = await fetchInfo(url);
  t.plan(3);
  t.equals(info && info.sizeBytes, expected.sizeBytes, 'correct file fetched (size match)');
  t.equals(info && info.fileName, expected.fileName, 'correct filename');
  const downloadUrl = info && info.downloadUrl;
  t.assert(
    downloadUrl && isUrl(downloadUrl) && downloadUrl.endsWith(id),
    `correct url=${downloadUrl}`
  );
});

test('Fetch .txt file info', async t => {
  const id = '1oTQi2sxyTRHHhKoviK_YJCO6nPh7Obmf';
  const url = `https://drive.google.com/open?id=${id}`;
  const expected = {
    disposition: 'NO_SCAN_NEEDED',
    fileName: 'dummy.txt',
    scanResult: 'OK',
    sizeBytes: 0
  };
  const info = await fetchInfo(url);
  t.plan(3);
  t.equals(info && info.sizeBytes, expected.sizeBytes, 'correct file fetched (size match)');
  t.equals(info && info.fileName, expected.fileName, 'correct filename');
  const downloadUrl = info && info.downloadUrl;
  t.assert(
    downloadUrl && isUrl(downloadUrl) && downloadUrl.endsWith(id),
    `correct url=${downloadUrl}`
  );
});
