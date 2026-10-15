/**
 * Robust CSV parser and generator without heavy external dependencies.
 * Handles quoted fields, commas inside quotes, CRLF/LF line endings, and escaping.
 */

/**
 * Parse CSV text into array of objects using the first row as headers.
 * @param {string} csvText
 * @returns {Array<Record<string, string>>}
 */
export function parseCsv(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    return [];
  }

  // Normalize line endings
  const lines = [];
  let currentLine = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentLine += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip LF after CR
      }
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length === 0) {
    return [];
  }

  // Parse header
  const headers = splitCsvRow(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));

  const rows = [];
  for (let l = 1; l < lines.length; l++) {
    const rawValues = splitCsvRow(lines[l]);
    // Skip empty lines
    if (rawValues.length === 1 && rawValues[0].trim() === '') continue;

    const rowObj = {};
    headers.forEach((header, idx) => {
      let val = rawValues[idx] !== undefined ? rawValues[idx] : '';
      // Strip surrounding quotes
      val = val.trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      rowObj[header] = val.trim();
    });
    rows.push(rowObj);
  }

  return rows;
}

/**
 * Split a single CSV line honoring double quotes
 * @param {string} line
 * @returns {string[]}
 */
function splitCsvRow(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const next = line[i + 1];

    if (c === '"') {
      current += c;
      if (inQuotes && next === '"') {
        current += next;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Convert array of objects to CSV string
 * @param {Array<object>} data
 * @param {Array<{ key: string, label: string }>} columns
 * @returns {string}
 */
export function generateCsv(data, columns) {
  if (!Array.isArray(data) || data.length === 0) {
    return columns.map(c => escapeCsvValue(c.label)).join(',') + '\r\n';
  }

  const headerLine = columns.map(c => escapeCsvValue(c.label)).join(',');
  const rowLines = data.map(item => {
    return columns.map(c => {
      let val = item[c.key];
      if (Array.isArray(val)) {
        val = val.join('; ');
      }
      return escapeCsvValue(val);
    }).join(',');
  });

  return [headerLine, ...rowLines].join('\r\n') + '\r\n';
}

function escapeCsvValue(val) {
  if (val === null || val === undefined) {
    return '""';
  }
  const str = String(val);
  // If contains comma, quote, or newline, escape quotes and wrap in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}
