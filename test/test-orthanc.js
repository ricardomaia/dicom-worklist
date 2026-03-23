/**
 * Integration test: query worklist from Orthanc via C-FIND MWL.
 *
 * Prerequisites:
 *   1. PACS with Worklist plugin running (e.g. Orthanc on port 4242)
 *   2. Worklist files (.wl) loaded in the PACS
 *
 * Usage: node test/test-orthanc.js [host] [port]
 */

const { WorklistClient } = require('../src/index');

const host = process.argv[2] || 'localhost';
const port = parseInt(process.argv[3] || '4242', 10);

async function main() {
  const client = new WorklistClient({
    host,
    port,
    calledAet: 'ORTHANC',
    callingAet: 'WORKLIST_SCU',
    timeout: 10000,
  });

  // 1. Connection test (C-ECHO)
  console.log(`\n=== C-ECHO to ${host}:${port} ===`);
  const echoResult = await client.echo();
  if (!echoResult.ok) {
    console.error(`FAILED: ${echoResult.error}`);
    console.error('Make sure the PACS is running (e.g. Orthanc on port 4242)');
    process.exit(1);
  }
  console.log('OK - DICOM association established\n');

  // 2. Query today's worklist
  console.log('=== MWL C-FIND (today) ===');
  const todayResults = await client.queryToday();
  console.log(`Found: ${todayResults.length} scheduled procedures for today\n`);

  // 3. Query worklist (all dates)
  console.log('=== MWL C-FIND (all dates) ===');
  const results = await client.queryWorklist({ date: '' });
  console.log(`Found: ${results.length} scheduled procedures\n`);

  if (results.length === 0) {
    console.log('No items in the worklist.');
    console.log('Make sure there are .wl files configured in the PACS.');
    return;
  }

  // 4. Display table
  console.log(
    'Time'.padEnd(6) +
    'Init.'.padEnd(6) +
    'Mod'.padEnd(5) +
    'Station'.padEnd(18) +
    'Exam'.padEnd(45) +
    'Accession'
  );
  console.log('-'.repeat(95));

  const sorted = results.sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));

  for (const item of sorted) {
    console.log(
      (item.scheduled_time || '--:--').padEnd(6) +
      item.initials.padEnd(6) +
      item.modality.padEnd(5) +
      item.station_name.padEnd(18) +
      item.exam_description.slice(0, 43).padEnd(45) +
      item.accession_number
    );
  }

  // 5. Test with modality filter
  console.log('\n=== MWL C-FIND (Modality=CT) ===');
  const ctResults = await client.queryWorklist({ modality: 'CT' });
  console.log(`Found: ${ctResults.length} CT procedures\n`);

  for (const item of ctResults) {
    console.log(
      `  ${item.scheduled_time} | ${item.initials} | ${item.station_name} | ${item.exam_description}`
    );
  }

  console.log('\nTest completed successfully!');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
