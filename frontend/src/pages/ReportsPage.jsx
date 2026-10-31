import { useState } from 'react';

export default function ReportsPage() {
  const [status, setStatus] = useState('');

  async function downloadReport(format) {
    setStatus(`Preparing ${format.toUpperCase()} report...`);

    try {
      const token = localStorage.getItem('token');

      if (!token) {
        setStatus(
          'Authentication is not connected yet. Sign-in must provide a valid token before exporting.'
        );
        return;
      }

      const response = await fetch(`/api/reports/export/${format}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: format === 'pdf' ? 'application/pdf' : 'text/csv',
        },
      });

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? 'Your session is missing or expired. Please sign in again.'
            : `Export failed (HTTP ${response.status}).`
        );
      }

      const blob = await response.blob();
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