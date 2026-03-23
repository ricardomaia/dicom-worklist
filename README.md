# dicom-worklist

DICOM Modality Worklist (MWL) client for Node.js.

Query scheduled procedures from any PACS that supports the **Modality Worklist Information Model - FIND** SOP Class (`1.2.840.10008.5.1.4.31`).

Built on top of [dcmjs-dimse](https://github.com/PantelisGeorgiadis/dcmjs-dimse).

## Install

```bash
npm install dicom-worklist
```

## Quick Start

```js
const { WorklistClient } = require('dicom-worklist');

const client = new WorklistClient({
  host: 'localhost',
  port: 4242,
  calledAet: 'ORTHANC',
  callingAet: 'MY_SCU',
});

// Query today's scheduled procedures
const items = await client.queryToday();

for (const item of items) {
  console.log(
    `${item.scheduled_time} | ${item.modality} | ${item.station_name} | ${item.exam_description}`
  );
}
```

## API

### `new WorklistClient(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `host` | string | `'localhost'` | PACS hostname or IP |
| `port` | number | `4242` | DICOM port |
| `calledAet` | string | `'ORTHANC'` | Called AE Title (PACS) |
| `callingAet` | string | `'WORKLIST_SCU'` | Calling AE Title (this client) |
| `timeout` | number | `30000` | Timeout in ms |

### `client.echo()`

Tests the DICOM association with a C-ECHO request.

Returns `Promise<{ ok: boolean, error?: string }>`.

### `client.queryWorklist(filters?)`

Performs a MWL C-FIND query.

| Filter | Type | Default | Description |
|---|---|---|---|
| `date` | string | today (`YYYYMMDD`) | Scheduled date filter |
| `modality` | string | `''` (all) | Filter by modality (e.g. `'CT'`, `'MR'`) |
| `stationAet` | string | `''` (all) | Filter by station AE Title |

Returns `Promise<Array<WorklistItem>>`.

### `client.queryToday()`

Shortcut for `queryWorklist()` with today's date.

### WorklistItem

Each item returned by `queryWorklist` has the following shape:

```js
{
  initials: 'J.S.',           // Patient initials (LGPD-compliant)
  patient_id: 'WL-001',
  modality: 'CT',
  exam_description: 'CT CHEST WITHOUT CONTRAST',
  body_part: 'CHEST',
  station_name: 'CT-SIEMENS-01',
  station_aet: 'CT_SIEMENS_01',
  scheduled_date: '20260101',
  scheduled_time: '08:30',
  accession_number: 'ACC001',
}
```

> **Note:** `initials` returns only the first letter of given name + last name (e.g. `J.S.`), not the full patient name. This is intentional for LGPD/GDPR compliance.

## PACS Configuration

Your PACS must:

1. Have the **Worklist plugin** enabled
2. List this client's AE Title in its allowed modalities

### Orthanc example (`orthanc.json`)

```json
{
  "Worklists": {
    "Enable": true,
    "Database": "/var/lib/orthanc/worklists"
  },
  "DicomModalities": {
    "my_client": ["MY_SCU", "*", 11112]
  }
}
```

## Testing

With Orthanc running on `localhost:4242`:

```bash
npm test
```

## How It Works

This library performs a DICOM C-FIND at the MWL level using the `ModalityWorklistInformationModelFind` SOP Class. The query dataset is built manually (not via `CFindRequest.createWorklistFindRequest()`) to avoid encoding issues with certain VR types that cause DCMTK-based servers to abort the association.

## License

MIT
