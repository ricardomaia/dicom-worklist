/**
 * dicom-worklist — Node.js DICOM Modality Worklist (MWL) client.
 *
 * Uses dcmjs-dimse for C-FIND on the ModalityWorklistInformationModelFind
 * SOP Class (1.2.840.10008.5.1.4.31).
 */

const { Client, Dataset } = require('dcmjs-dimse');
const { CFindRequest } = require('dcmjs-dimse').requests;
const { Status, SopClass } = require('dcmjs-dimse').constants;

/**
 * Extracts privacy-compliant initials from a DICOM patient name (LAST^FIRST^MIDDLE).
 */
function getInitials(patientName) {
  if (!patientName) return '?';
  const parts = patientName.split('^').filter(Boolean);
  if (parts.length === 0) return '?';
  const lastName = parts[0] || '';
  const firstName = parts[1] || '';
  let initials = '';
  if (firstName) initials += firstName[0].toUpperCase() + '.';
  if (lastName) initials += lastName[0].toUpperCase() + '.';
  return initials || '?';
}

/**
 * Formats a DICOM time value (HHMMSS.ffffff) to HH:MM.
 */
function formatTime(dicomTime) {
  if (!dicomTime || dicomTime.length < 4) return '';
  return `${dicomTime.slice(0, 2)}:${dicomTime.slice(2, 4)}`;
}

/**
 * Extracts the patient name string from a DICOM PatientName value.
 * Handles both string and dcmjs structured format ({Alphabetic: "..."}).
 */
function getPatientName(dicomName) {
  if (!dicomName) return '';
  if (typeof dicomName === 'string') return dicomName;
  return dicomName[0]?.Alphabetic || '';
}

/**
 * Converts a dcmjs-dimse MWL response dataset into a plain JS object.
 */
function parseWorklistItem(ds) {
  const el = ds.getElements();

  const spsSeq = el.ScheduledProcedureStepSequence || [];
  const sps = Array.isArray(spsSeq) && spsSeq.length > 0
    ? spsSeq[0]
    : (typeof spsSeq === 'object' ? spsSeq : {});

  const patientName = getPatientName(el.PatientName);

  return {
    patient_name: patientName,
    patient_id: String(el.PatientID || ''),
    patient_birth_date: String(el.PatientBirthDate || ''),
    patient_sex: String(el.PatientSex || ''),
    patient_age: String(el.PatientAge || ''),
    patient_weight: String(el.PatientWeight || ''),
    modality: String(sps.Modality || ''),
    exam_description: String(
      sps.ScheduledProcedureStepDescription ||
      el.RequestedProcedureDescription || ''
    ),
    body_part: String(sps.BodyPartExamined || ''),
    station_name: String(sps.ScheduledStationName || ''),
    station_aet: String(sps.ScheduledStationAETitle || ''),
    scheduled_date: String(sps.ScheduledProcedureStepStartDate || ''),
    scheduled_time: formatTime(String(sps.ScheduledProcedureStepStartTime || '')),
    scheduled_procedure_step_id: String(sps.ScheduledProcedureStepID || ''),
    scheduled_procedure_step_status: String(sps.ScheduledProcedureStepStatus || ''),
    performing_physician: String(sps.ScheduledPerformingPhysicianName || ''),
    accession_number: String(el.AccessionNumber || ''),
    institution_name: String(el.InstitutionName || ''),
    referring_physician: String(el.ReferringPhysicianName || ''),
    requesting_physician: String(el.RequestingPhysician || ''),
    study_description: String(el.StudyDescription || ''),
    study_instance_uid: String(el.StudyInstanceUID || ''),
    requested_procedure_id: String(el.RequestedProcedureID || ''),
  };
}

class WorklistClient {
  /**
   * @param {Object} opts
   * @param {string} opts.host        - PACS hostname (default: 'localhost')
   * @param {number} opts.port        - DICOM port (default: 4242)
   * @param {string} opts.calledAet   - Called AE Title (default: 'ORTHANC')
   * @param {string} opts.callingAet  - Calling AE Title (default: 'WORKLIST_SCU')
   * @param {number} opts.timeout     - Timeout in ms (default: 30000)
   */
  constructor(opts = {}) {
    this.host = opts.host || 'localhost';
    this.port = opts.port || 4242;
    this.calledAet = opts.calledAet || 'ORTHANC';
    this.callingAet = opts.callingAet || 'WORKLIST_SCU';
    this.timeout = opts.timeout || 30000;
  }

  /**
   * Tests the DICOM association with a C-ECHO request.
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  echo() {
    return new Promise((resolve) => {
      const client = new Client();
      const { CEchoRequest } = require('dcmjs-dimse').requests;
      const request = new CEchoRequest();
      client.addRequest(request);

      client.on('associationRejected', () => {
        resolve({ ok: false, error: 'Association rejected' });
      });
      client.on('closed', () => {
        resolve({ ok: true });
      });
      client.on('networkError', (e) => {
        resolve({ ok: false, error: e.message || String(e) });
      });

      client.send(this.host, this.port, this.callingAet, this.calledAet, {
        connectTimeout: this.timeout,
        associationTimeout: this.timeout,
        pduTimeout: this.timeout,
      });
    });
  }

  /**
   * Queries the worklist (MWL C-FIND).
   *
   * @param {Object} [filters]
   * @param {string} [filters.date]       - Date in YYYYMMDD format (default: today)
   * @param {string} [filters.modality]   - Modality filter (e.g. 'CT', 'MR')
   * @param {string} [filters.stationAet] - Station AE Title filter
   * @returns {Promise<Array<Object>>}
   */
  queryWorklist(filters = {}) {
    return new Promise((resolve, reject) => {
      const today = filters.date ?? new Date().toISOString().slice(0, 10).replace(/-/g, '');

      // Manual CFindRequest construction — createWorklistFindRequest() adds
      // tags with incompatible VRs (e.g. PregnancyStatus with empty US value)
      // that cause DCMTK-based servers like Orthanc to abort the association.
      const request = new CFindRequest();
      request.setAffectedSopClassUid(SopClass.ModalityWorklistInformationModelFind);

      const ds = new Dataset({
        PatientName: '',
        PatientID: '',
        PatientBirthDate: '',
        PatientSex: '',
        AccessionNumber: '',
        InstitutionName: '',
        ReferringPhysicianName: '',
        StudyDescription: '',
        StudyInstanceUID: '',
        RequestedProcedureDescription: '',
        RequestedProcedureID: '',
        RequestingPhysician: '',
        PatientAge: '',
        PatientWeight: '',
        ScheduledProcedureStepSequence: [
          {
            ScheduledStationAETitle: filters.stationAet || '',
            ScheduledProcedureStepStartDate: today,
            ScheduledProcedureStepStartTime: '',
            Modality: filters.modality || '',
            ScheduledPerformingPhysicianName: '',
            ScheduledProcedureStepDescription: '',
            ScheduledStationName: '',
            BodyPartExamined: '',
            ScheduledProcedureStepStatus: '',
            ScheduledProcedureStepID: '',
          },
        ],
      });
      request.setDataset(ds);

      const results = [];

      request.on('response', (response) => {
        if (response.getStatus() === Status.Pending && response.hasDataset()) {
          results.push(parseWorklistItem(response.getDataset()));
        }
      });

      const client = new Client();
      client.addRequest(request);

      client.on('associationRejected', () => {
        reject(new Error('Association rejected by PACS'));
      });
      client.on('closed', () => {
        resolve(results);
      });
      client.on('networkError', (e) => {
        reject(new Error(`Network error: ${e.message || e}`));
      });

      client.send(this.host, this.port, this.callingAet, this.calledAet, {
        connectTimeout: this.timeout,
        associationTimeout: this.timeout,
        pduTimeout: this.timeout,
      });
    });
  }

  /**
   * Queries today's worklist (shortcut).
   * @returns {Promise<Array<Object>>}
   */
  queryToday() {
    return this.queryWorklist();
  }
}

module.exports = { WorklistClient, parseWorklistItem, getInitials, getPatientName, formatTime };
