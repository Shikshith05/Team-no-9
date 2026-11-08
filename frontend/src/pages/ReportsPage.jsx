import { useState } from 'react';
import { apiDownload } from '../api/http.js';

export default function ReportsPage() {
  const [status, setStatus] = useState('');

  async function downloadReport(format) {
    setStatus(`Preparing ${format.toUpperCase()} report...`);

    try {
      // PWM-F-033. Token and 401 handling live in http.js, as for every other call.
      const blob = await apiDownload(
        `/api/reports/export/${format}`,
        format === 'pdf' ? 'application/pdf' : 'text/csv',
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `personal-wealth-report.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setStatus(`${format.toUpperCase()} report downloaded successfully.`);
    } catch (error) {
      setStatus(error.message || 'Unable to download the report.');
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1 tabIndex={-1}>Reports</h1>
        <p className="muted">
          Export your asset records and historical valuations for your records.
        </p>
      </header>

      <section className="card" aria-labelledby="export-heading">
        <h2 id="export-heading">Export portfolio</h2>
        <p className="muted">
          CSV is suitable for spreadsheets. PDF provides a report for reading
          and sharing.
        </p>

        <div className="actions">
          <button
            type="button"
            className="button"
            onClick={() => downloadReport('csv')}
          >
            Download CSV
          </button>

          <button
            type="button"
            className="button button-secondary"
            onClick={() => downloadReport('pdf')}
          >
            Download PDF
          </button>
        </div>

        {status && (
          <p role="status" className="form-note">
            {status}
          </p>
        )}
      </section>
    </main>
  );
}