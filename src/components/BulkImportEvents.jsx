import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Upload, X, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { computeBuyDates } from '@/lib/dateUtils';

const OCCASIONS = ['birthday','anniversary','holiday','graduation','baby_shower','wedding','housewarming','thank_you','just_because','other'];

const EXAMPLE_CSV = `recipient_name,occasion,event_date,budget,priority,recurring
Mum,birthday,2025-08-14,100,high,true
Jake,anniversary,2025-09-01,150,medium,true
Emma,graduation,2025-11-20,80,high,false
Dad,birthday,2025-03-22,100,high,true
Sarah,wedding,2025-06-07,200,high,false`;

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
}

function validateRow(row) {
  const errors = [];
  if (!row.recipient_name) errors.push('Missing name');
  if (!row.event_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.event_date)) errors.push('Invalid date (use YYYY-MM-DD)');
  if (row.occasion && !OCCASIONS.includes(row.occasion)) errors.push(`Unknown occasion (use: ${OCCASIONS.join(', ')})`);
  if (row.priority && !['high','medium','low','free'].includes(row.priority)) errors.push('Priority must be high/medium/low/free');
  return errors;
}

export default function BulkImportEvents({ onClose }) {
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState({});
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const queryClient = useQueryClient();

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCSV(e.target.result);
      const errs = {};
      parsed.forEach((row, i) => {
        const e = validateRow(row);
        if (e.length) errs[i] = e;
      });
      setRows(parsed);
      setErrors(errs);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handlePaste = (e) => {
    const text = e.target.value;
    const parsed = parseCSV(text);
    const errs = {};
    parsed.forEach((row, i) => {
      const v = validateRow(row);
      if (v.length) errs[i] = v;
    });
    setRows(parsed);
    setErrors(errs);
  };

  const validRows = rows.filter((_, i) => !errors[i]);

  const handleImport = async () => {
    if (!validRows.length) return;
    setImporting(true);
    try {
      await base44.entities.Event.bulkCreate(
        validRows.map(row => ({
          recipient_name: row.recipient_name,
          occasion: OCCASIONS.includes(row.occasion) ? row.occasion : 'other',
          event_date: row.event_date,
          budget: row.budget ? parseFloat(row.budget) : 0,
          priority: ['high','medium','low','free'].includes(row.priority) ? row.priority : 'medium',
          recurring: row.recurring?.toLowerCase() === 'true',
          ...computeBuyDates(row.event_date),
        }))
      );
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setDone(true);
      toast.success(`${validRows.length} events imported!`);
    } catch (err) {
      toast.error('Import failed — please try again');
    }
    setImporting(false);
  };

  const downloadExample = () => {
    const blob = new Blob([EXAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'howthoughtful_import_example.csv';
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div
        className="bg-card rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <div className="p-5 border-b border-sand-200 flex items-center justify-between">
          <div>
            <h2 className="font-heading font-bold text-lg text-ink">Bulk Import Occasions</h2>
            <p className="text-sm text-ink-soft">Add everyone at once — never miss a moment</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-sand-100 transition-all">
            <X className="w-5 h-5 text-ink-soft" />
          </button>
        </div>

        {/* Benefit banner */}
        <div className="mx-5 mt-5 bg-moss/10 border border-moss/20 rounded-2xl p-4">
          <p className="font-heading font-semibold text-sm text-ink mb-1">🎁 Set it up once, stay thoughtful all year</p>
          <p className="text-xs text-ink-soft leading-relaxed">Import all your important dates in seconds — birthdays, anniversaries, graduations. How Thoughtful will remind you at exactly the right time so you're never caught off guard again.</p>
        </div>

        {done ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-moss mx-auto" />
            <h3 className="font-heading font-bold text-xl text-ink">{validRows.length} events added!</h3>
            <p className="text-sm text-ink-soft">Your occasions are now in the app.</p>
            <button onClick={onClose} className="bg-terracotta text-white px-6 py-3 rounded-full font-heading font-semibold hover:bg-terracotta-dark transition-all">
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Example download */}
            <button
              onClick={downloadExample}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-sand-300 rounded-2xl text-sm text-ink-soft hover:text-ink hover:border-ink/30 transition-all"
            >
              <Download className="w-4 h-4" />
              Download example CSV template
            </button>

            {/* File drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              className="border-2 border-dashed border-sand-300 rounded-2xl p-6 text-center hover:border-terracotta/40 transition-all cursor-pointer"
              onClick={() => document.getElementById('csv-file').click()}
            >
              <Upload className="w-8 h-8 text-ink-soft mx-auto mb-2" />
              <p className="text-sm font-heading font-semibold text-ink">Drop CSV here or click to browse</p>
              <p className="text-xs text-ink-soft mt-1">Columns: recipient_name, occasion, event_date, budget, priority, recurring</p>
              <input
                id="csv-file"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => e.target.files[0] && handleFile(e.target.files[0])}
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-sand-200" />
              <span className="text-xs text-ink-soft">or paste CSV text</span>
              <div className="flex-1 h-px bg-sand-200" />
            </div>

            <textarea
              rows={5}
              placeholder={EXAMPLE_CSV}
              onChange={handlePaste}
              className="w-full border border-sand-300 rounded-2xl px-4 py-3 text-xs font-mono text-ink bg-sand-50 focus:outline-none focus:ring-2 focus:ring-terracotta/50 resize-none"
            />

            {/* Preview table */}
            {rows.length > 0 && (
              <div>
                <p className="text-sm font-heading font-semibold text-ink mb-2">
                  Preview: {validRows.length} valid / {rows.length - validRows.length} with errors
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {rows.map((row, i) => (
                    <div key={i} className={`flex items-start gap-2 p-3 rounded-xl text-sm ${errors[i] ? 'bg-destructive/5 border border-destructive/20' : 'bg-moss/5 border border-moss/20'}`}>
                      {errors[i]
                        ? <AlertCircle className="w-4 h-4 text-destructive flex-none mt-0.5" />
                        : <CheckCircle2 className="w-4 h-4 text-moss flex-none mt-0.5" />
                      }
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{row.recipient_name || '—'} · {row.occasion} · {row.event_date}</p>
                        {errors[i] && <p className="text-xs text-destructive mt-0.5">{errors[i].join(', ')}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {validRows.length > 0 && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full bg-terracotta text-white py-4 rounded-full font-heading font-semibold hover:bg-terracotta-dark transition-all hover:-translate-y-0.5 disabled:opacity-60"
              >
                {importing ? 'Importing...' : `Import ${validRows.length} event${validRows.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}