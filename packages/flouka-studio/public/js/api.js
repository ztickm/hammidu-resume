/**
 * Thin wrappers around the web server's JSON API.
 */

const API = {
  async validate(resume) {
    const r = await fetch('/api/validate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({resume}) });
    return r.json();
  },
  async generatePDFBlob(resume, config) {
    const r = await fetch('/api/generate-pdf', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({resume, config}) });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'PDF generation failed'); }
    return r.blob();
  },
  async generateHTMLBlob(resume, config) {
    const r = await fetch('/api/generate-html', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({resume, config}) });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'HTML generation failed'); }
    return r.blob();
  },
  async tailor(resume, jd, model, promptAddition) {
    const r = await fetch('/api/tailor', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({resume, jd, model, promptAddition}) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Tailoring failed');
    return data;
  },
  async chat(resume, jd, jdAnalysis, messages, model) {
    const r = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({resume, jd, jdAnalysis, messages, model}) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Chat failed');
    return data;
  },
};
