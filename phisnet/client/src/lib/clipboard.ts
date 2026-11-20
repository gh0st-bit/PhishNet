export async function copyText(text: string): Promise<boolean> {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch { /* Try the HTTP/LAN fallback below. */ }
  const field=document.createElement('textarea');field.value=text;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);
  const focused=document.activeElement instanceof HTMLElement?document.activeElement:null;
  try { field.select();return document.execCommand('copy'); } catch { return false; } finally { field.remove();focused?.focus(); }
}
