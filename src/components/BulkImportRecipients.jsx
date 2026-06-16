import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Upload, X, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { findRecipientMatch, mergeRecipientPayload, recipientPayloadFromForm } from '@/lib/recipientMatching';

const EXAMPLE_CSV = `name,relationship,interests,love_language,notes
Mum,parent,"cooking, gardening, reading",acts_of_service,Loves anything homemade
Jake,friend,"gaming, hiking",quality_time,Prefers experiences over things
Emma,sister,"art, yoga, coffee",gifts,Coffee snob - always oat milk
Dad,parent,"woodworking, cricket",words_of_affirmation,`;

const LOVE_LANGUAGE_VALUES = ['words_of_affirmation','quality_time','gifts','acts_of_service','physical_touch'];

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    // handle quoted fields
    const vals = [];
    let cur = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { vals.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
}

function validateRow(row) {
  const errors = [];
  if (!row.name) errors.push('Missing name');
  if (row.love_language && !LOVE_LANGUAGE_VALUES.includes(row.love_language))
    errors.push(`Love language must be one of: ${LOVE_LANGUAGE_VALUES.join(', ')}`);
  return errors;
}

export default function BulkImportRecipients({ onClose }) {
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState({});
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [duplicateActions, setDuplicateActions] = useState({});
  const queryClient = useQueryClient();

  const { data: existingRecipients = [] } = useQuery({
    queryKey: ['recipients'],
    queryFn: () => base44.entities.Recipient.list('name'),
  });

  const process = (text) => {
    const parsed = parseCSV(text);
    const errs = {};
    parsed.forEach((row, i) => {
      const e = validateRow(row);
      if (e.length) errs[i] = e;
    });
    setRows(parsed);
    setErrors(errs);
    setDuplicateActions({});
  };

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => process(e.target.result);
    reader.readAsText(file);
  };

  const validRows = rows.filter((_, i) => !errors[i]);
  const duplicateMatches = rows.map((row, i) => errors[i] ? null : findRecipientMatch(row.name, existingRecipients));
  const duplicateCount = duplicateMatches.filter(Boolean).length;

  const rowPayload = (row) => recipientPayloadFromForm({
    name: row.name,
    age: row.age,
    birthday_month: row.birthday_month,
    birthday_day: row.birthday_day,
    relationship: row.relationship || '',
    interests: row.interests || '',
    love_language: LOVE_LANGUAGE_VALUES.includes(row.love_language) ? row.love_language : '',
    notes: row.notes || '',
  });

  const handleImport = async () => {
    if (!validRows.length) return;
    setImporting(true);
    try {
      const rowsToCreate = [];
      const updates = [];

      rows.forEach((row, i) => {
        if (errors[i]) return;
        const payload = rowPayload(row);
        const match = duplicateMatches[i];
        const action = duplicateActions[i] || (match ? 'merge' : 'create');

        if (match && action === 'merge') {
          const merged = mergeRecipientPayload(match.recipient, payload);
          if (Object.keys(merged).length) {
            updates.push(base44.entities.Recipient.update(match.recipient.id, merged));
          }
        } else {
          rowsToCreate.push(payload);
        }
      });

      if (rowsToCreate.length) await base44.entities.Recipient.bulkCreate(rowsToCreate);
      if (updates.length) await Promise.all(updates);
      queryClient.invalidateQueries({ queryKey: ['recipients'] });
      setDone(true);
      toast.success(`${validRows.length} people processed`);
    } catch {
      toast.error('Import failed — please try again');
    }
    setImporting(false);
  };

  const downloadExample = () => {
    const blob = new Blob([EXAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'recipients_import_example.csv'; a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-card rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" style={{ paddingBottom: 'var(--safe-bottom)' }}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-heading font-bold text-lg text-foreground">Bulk Import People</h2>
            <p className="text-sm text-muted-foreground">Add everyone you care about at once</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-all">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Benefit banner */}
        <div className="mx-5 mt-5 bg-moss/10 border border-moss/20 rounded-2xl p-4">
          <p className="font-heading font-semibold text-sm text-foreground mb-1">💛 The most thoughtful 2 minutes you'll spend today</p>
          <p className="text-xs text-muted-foreground leading-relaxed">Add your family, friends & colleagues all at once. Include their interests, love language & relationship — and How Thoughtful will use it to suggest genuinely personal gift ideas every time.</p>
        </div>

        {done ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-moss mx-auto" />
            <h3 className="font-heading font-bold text-xl text-foreground">{validRows.length} people added!</h3>
            <p className="text-sm text-muted-foreground">They're now in your People list.</p>
            <button onClick={onClose} className="bg-terracotta text-white px-6 py-3 rounded-full font-heading font-semibold hover:bg-terracotta-dark transition-all">Done</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <button onClick={downloadExample} className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-border rounded-2xl text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all">
              <Download className="w-4 h-4" /> Download example CSV template
            </button>

            <div
              onDrop={e => { e.preventDefault(); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]); }}
              onDragOver={e => e.preventDefault()}
              className="border-2 border-dashed border-border rounded-2xl p-6 text-center hover:border-terracotta/40 transition-all cursor-pointer"
              onClick={() => document.getElementById('recipients-csv').click()}
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-heading font-semibold text-foreground">Drop CSV here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Columns: name, relationship, interests, love_language, notes</p>
              <input id="recipients-csv" type="file" accept=".csv" className="hidden" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or paste CSV text</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <textarea
              rows={5}
              placeholder={EXAMPLE_CSV}
              onChange={e => process(e.target.value)}
              className="w-full border border-border rounded-2xl px-4 py-3 text-xs font-mono text-foreground bg-muted focus:outline-none focus:ring-2 focus:ring-terracotta/50 resize-none"
            />

            {rows.length > 0 && (
              <div>
                <p className="text-sm font-heading font-semibold text-foreground mb-2">
                  Preview: {validRows.length} valid / {rows.length - validRows.length} with errors
                </p>
                {duplicateCount > 0 && (
                  <p className="text-xs text-butter-dark bg-butter/30 border border-butter rounded-xl px-3 py-2 mb-2">
                    {duplicateCount} possible duplicate{duplicateCount !== 1 ? 's' : ''} found. By default these will update existing people.
                  </p>
                )}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {rows.map((row, i) => {
                    const match = duplicateMatches[i];
                    const action = duplicateActions[i] || (match ? 'merge' : 'create');
                    return (
                      <div key={i} className={`flex items-start gap-2 p-3 rounded-xl text-sm ${errors[i] ? 'bg-destructive/5 border border-destructive/20' : match ? 'bg-butter/20 border border-butter' : 'bg-moss/5 border border-moss/20'}`}>
                        {errors[i] ? <AlertCircle className="w-4 h-4 text-destructive flex-none mt-0.5" /> : <CheckCircle2 className={`w-4 h-4 flex-none mt-0.5 ${match ? 'text-butter-dark' : 'text-moss'}`} />}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">{row.name || '—'} · {row.relationship || 'no relationship'}</p>
                          {row.interests && <p className="text-xs text-muted-foreground">{row.interests}</p>}
                          {errors[i] && <p className="text-xs text-destructive mt-0.5">{errors[i].join(', ')}</p>}
                          {match && !errors[i] && (
                            <div className="mt-2 space-y-2">
                              <p className="text-xs text-muted-foreground">
                                Similar to <span className="font-medium text-foreground">{match.recipient.name}</span>
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setDuplicateActions(a => ({ ...a, [i]: 'merge' }))}
                                  className={`rounded-full px-3 py-1.5 text-xs font-heading font-semibold transition-all ${action === 'merge' ? 'bg-moss text-white' : 'bg-card border border-border text-foreground'}`}
                                >
                                  Update existing
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDuplicateActions(a => ({ ...a, [i]: 'create' }))}
                                  className={`rounded-full px-3 py-1.5 text-xs font-heading font-semibold transition-all ${action === 'create' ? 'bg-terracotta text-white' : 'bg-card border border-border text-foreground'}`}
                                >
                                  Create separate
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {validRows.length > 0 && (
              <button onClick={handleImport} disabled={importing} className="w-full bg-terracotta text-white py-4 rounded-full font-heading font-semibold hover:bg-terracotta-dark transition-all hover:-translate-y-0.5 disabled:opacity-60">
                {importing ? 'Importing...' : `Import ${validRows.length} person${validRows.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
